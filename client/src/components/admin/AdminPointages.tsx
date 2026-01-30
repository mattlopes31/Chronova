import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Users,
  FolderKanban,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Umbrella,
  Stethoscope,
  Plane,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pointagesApi, salariesApi, projetsApi, dashboardApi, congesApi } from '@/services/api';
import { Card, Badge, Button, Select, Modal, Spinner } from '@/components/ui';
import { getCurrentWeek, getWeekDays, formatWeekLabel, getWeeksOfYear, getYears, getMondayOfWeek } from '@/utils/dates';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Constantes
const HEURES_SEMAINE_NORMALE = 35;

interface PointageResume {
  salarieId: string;
  salarieNom: string;
  salariePrenom: string;
  projetId: string;
  projetNom: string;
  projetCode: string;
  heuresPointees: number;
  heuresEstimees: number;
  status: 'Brouillon' | 'Soumis' | 'Valide' | 'Rejete';
  validationId?: string;
}

interface SemaineValidation {
  annee: number;
  semaine: number;
  totalHeures: number;
  heuresSup?: number;
  heuresDues?: number;
  heuresRattrapees?: number;
}

interface SalarieResume {
  id: string;
  nom: string;
  prenom: string;
  totalHeures: number;
  heuresNormales: number;
  heuresSup: number;
  heuresDues: number;
  joursCP: number;
  status: 'Brouillon' | 'Soumis' | 'Valide' | 'Rejete';
  projets: {
    id: string;
    nom: string;
    code: string;
    heures: number;
  }[];
  annee?: number;
  semaine?: number;
  semaines?: SemaineValidation[]; // Pour regrouper plusieurs semaines
}

export const AdminPointages = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const currentWeek = getCurrentWeek();
  const isValidationsPage = location.pathname === '/validations';
  
  const [annee, setAnnee] = useState(currentWeek.year);
  const [semaine, setSemaine] = useState(currentWeek.week);
  const [filtreProjet, setFiltreProjet] = useState<string>('');
  const [filtreSalarie, setFiltreSalarie] = useState<string>('');
  const [selectedValidation, setSelectedValidation] = useState<{salarieId: string; annee: number; semaine: number; action: 'valider' | 'rejeter'} | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');
  const [selectedSemaineDetails, setSelectedSemaineDetails] = useState<{salarieId: string; salarieNom: string; salariePrenom: string; annee: number; semaine: number} | null>(null);

  // Queries
  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries'],
    queryFn: () => salariesApi.getAll(),
  });

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: () => projetsApi.getAll(),
  });

  // Si on est sur la page Validations, récupérer toutes les validations en attente
  const { data: validationsEnAttente = [] } = useQuery({
    queryKey: ['validations-pending'],
    queryFn: () => dashboardApi.getValidations(),
    enabled: isValidationsPage,
    refetchInterval: 60000, // Rafraîchir toutes les 1 minute (60000 ms)
  });

  // Sinon, récupérer les pointages de la semaine sélectionnée
  const { data: pointagesData, isLoading } = useQuery({
    queryKey: ['admin-pointages', annee, semaine],
    queryFn: () => pointagesApi.getAll({ annee, semaine }),
    enabled: !isValidationsPage,
    refetchInterval: 60000, // Rafraîchir toutes les 1 minute (60000 ms)
  });

  // Récupérer les pointages détaillés d'une semaine pour le modal
  const { data: semaineDetailsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['semaine-details', selectedSemaineDetails?.salarieId, selectedSemaineDetails?.annee, selectedSemaineDetails?.semaine],
    queryFn: () => pointagesApi.getAll({ 
      salarie_id: selectedSemaineDetails!.salarieId, 
      annee: selectedSemaineDetails!.annee, 
      semaine: selectedSemaineDetails!.semaine 
    }),
    enabled: !!selectedSemaineDetails,
  });

  // Récupérer les congés de la semaine pour le modal
  const { data: congesSemaine = [] } = useQuery({
    queryKey: ['conges-semaine', selectedSemaineDetails?.salarieId, selectedSemaineDetails?.annee, selectedSemaineDetails?.semaine],
    queryFn: () => congesApi.getAll({ 
      salarie_id: selectedSemaineDetails!.salarieId, 
      annee: selectedSemaineDetails!.annee 
    }),
    enabled: !!selectedSemaineDetails,
    select: (data) => data.filter((c: any) => c.semaine === selectedSemaineDetails!.semaine),
  });

  // Helper pour obtenir le type de congé d'un jour
  const getCongeForDay = (dayIndex: number) => {
    if (!congesSemaine || congesSemaine.length === 0) return null;
    const dayFields = ['cp_lundi', 'cp_mardi', 'cp_mercredi', 'cp_jeudi', 'cp_vendredi', 'cp_samedi', 'cp_dimanche'];
    const dayField = dayFields[dayIndex];
    
    for (const conge of congesSemaine as any[]) {
      if (conge[dayField]) {
        return conge.type_conge;
      }
    }
    return null;
  };

  // Helper pour obtenir la configuration d'affichage d'un type de congé
  const getCongeConfig = (type: string) => {
    switch (type) {
      case 'CP':
        return { label: 'CP', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Umbrella };
      case 'Maladie':
        return { label: 'Maladie', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Stethoscope };
      case 'Deplacement':
        return { label: 'Déplacement', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Plane };
      case 'Formation':
        return { label: 'Formation', color: 'text-green-700', bgColor: 'bg-green-100', icon: Clock };
      case 'Sans_solde':
        return { label: 'Sans solde', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Clock };
      default:
        return { label: type, color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Clock };
    }
  };

  // Mutations
  const validerMutation = useMutation({
    mutationFn: ({ salarie_id, annee, semaine }: { salarie_id: string; annee: number; semaine: number }) => 
      pointagesApi.valider(salarie_id, annee, semaine),
    onSuccess: () => {
      toast.success('Semaine validée');
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      queryClient.invalidateQueries({ queryKey: ['validations-pending'] });
      setSelectedValidation(null);
    },
    onError: () => toast.error('Erreur lors de la validation'),
  });

  const rejeterMutation = useMutation({
    mutationFn: ({ salarie_id, annee, semaine, commentaire }: { salarie_id: string; annee: number; semaine: number; commentaire: string }) => 
      pointagesApi.rejeter(salarie_id, annee, semaine, commentaire),
    onSuccess: () => {
      toast.success('Semaine rejetée');
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      queryClient.invalidateQueries({ queryKey: ['validations-pending'] });
      setSelectedValidation(null);
      setCommentaireRejet('');
    },
    onError: () => toast.error('Erreur lors du rejet'),
  });

  // Si on est sur la page Validations, convertir les validations en attente en format SalarieResume
  // Regrouper par salarié
  const validationsResume = useMemo<SalarieResume[]>(() => {
    if (!isValidationsPage || !validationsEnAttente || validationsEnAttente.length === 0) return [];
    
    // Regrouper par salarié
    const resumeMap = new Map<string, SalarieResume>();
    
    validationsEnAttente.forEach((v: any) => {
      const salarieId = String(v.salarie_id);
      const totalHeures = Number(v.total_heures_travaillees || v.total_heures || 0);
      
      if (!resumeMap.has(salarieId)) {
        resumeMap.set(salarieId, {
          id: salarieId,
          nom: v.salarie?.nom || 'Inconnu',
          prenom: v.salarie?.prenom || '',
          totalHeures: 0,
          heuresNormales: 0,
          heuresSup: 0,
          heuresDues: 0,
          joursCP: 0,
          status: 'Soumis' as const,
          projets: [],
          semaines: [],
        });
      }
      
      const resume = resumeMap.get(salarieId)!;
      resume.totalHeures += totalHeures;
      resume.semaines!.push({
        annee: v.annee,
        semaine: v.semaine,
        totalHeures,
        heuresSup: Number(v.heures_sup || 0),
        heuresDues: Number(v.heures_dues || 0),
        heuresRattrapees: Number(v.heures_rattrapees || 0),
      });
    });
    
    // Calculer les totaux pour chaque salarié
    resumeMap.forEach((resume) => {
      resume.heuresNormales = Math.min(resume.totalHeures, HEURES_SEMAINE_NORMALE * (resume.semaines?.length || 1));
      resume.heuresSup = Math.max(0, resume.totalHeures - HEURES_SEMAINE_NORMALE * (resume.semaines?.length || 1));
      resume.heuresDues = Math.max(0, HEURES_SEMAINE_NORMALE * (resume.semaines?.length || 1) - resume.totalHeures);
    });
    
    return Array.from(resumeMap.values());
  }, [validationsEnAttente, isValidationsPage]);

  // Calcul des résumés par salarié (pour la page normale)
  const salariesResume = useMemo<SalarieResume[]>(() => {
    // Si on est sur la page Validations, utiliser validationsResume
    if (isValidationsPage) {
      return validationsResume;
    }
    
    // L'API renvoie directement un tableau de pointages
    const pointages = Array.isArray(pointagesData) ? pointagesData : [];
    
    if (pointages.length === 0) return [];

    const resumeMap = new Map<string, SalarieResume>();

    pointages.forEach((p: any) => {
      const salarieId = String(p.salarie_id);
      
      if (!resumeMap.has(salarieId)) {
        const salarie = salaries.find((s: any) => String(s.id) === salarieId);
        resumeMap.set(salarieId, {
          id: salarieId,
          nom: salarie?.nom || p.salarie?.nom || 'Inconnu',
          prenom: salarie?.prenom || p.salarie?.prenom || '',
          totalHeures: 0,
          heuresNormales: 0,
          heuresSup: 0,
          heuresDues: 0,
          joursCP: 0,
          status: 'Brouillon',
          projets: [],
        });
      }

      const resume = resumeMap.get(salarieId)!;
      
      // Calculer les heures depuis les champs heure_xxx
      const heures = 
        Number(p.heure_lundi || 0) +
        Number(p.heure_mardi || 0) +
        Number(p.heure_mercredi || 0) +
        Number(p.heure_jeudi || 0) +
        Number(p.heure_vendredi || 0) +
        Number(p.heure_samedi || 0) +
        Number(p.heure_dimanche || 0);
      
      resume.totalHeures += heures;

      // Ajouter au projet existant ou créer
      const projetId = String(p.projet_id);
      const projetIndex = resume.projets.findIndex(pr => pr.id === projetId);
      if (projetIndex >= 0) {
        resume.projets[projetIndex].heures += heures;
      } else {
        const projet = projets.find((pr: any) => String(pr.id) === projetId);
        resume.projets.push({
          id: projetId,
          nom: projet?.nom || p.projet?.nom || 'Projet inconnu',
          code: projet?.code_projet || p.projet?.code_projet || '',
          heures,
        });
      }
      
      // Mettre à jour le status depuis le pointage
      if (p.validation_status && p.validation_status !== 'Brouillon') {
        resume.status = p.validation_status;
      }
    });

    // Calculer heures normales/sup/dues pour chaque salarié
    // Pour chaque salarié, récupérer le cumul des heures dues des semaines précédentes
    resumeMap.forEach(async (resume) => {
      // Récupérer le cumul des heures dues des semaines précédentes pour ce salarié
      // Note: Cette requête devrait être faite côté serveur, mais pour l'instant on calcule côté client
      // Les heures dues = max(0, 35 - totalHeures)
      const heuresDuesSemaine = Math.max(0, HEURES_SEMAINE_NORMALE - resume.totalHeures);
      
      // Pour l'affichage admin, on montre les heures dues de la semaine uniquement
      // Le cumul complet devrait être calculé côté serveur
      resume.heuresNormales = Math.min(resume.totalHeures, HEURES_SEMAINE_NORMALE);
      resume.heuresSup = Math.max(0, resume.totalHeures - HEURES_SEMAINE_NORMALE);
      resume.heuresDues = heuresDuesSemaine;
    });

    return Array.from(resumeMap.values());
  }, [pointagesData, salaries, projets, isValidationsPage, validationsResume]);

  // Filtrage
  const filteredResume = useMemo(() => {
    return salariesResume.filter(s => {
      if (filtreSalarie && s.id.toString() !== filtreSalarie) return false;
      if (filtreProjet && !s.projets.some(p => p.id.toString() === filtreProjet)) return false;
      return true;
    });
  }, [salariesResume, filtreSalarie, filtreProjet]);

  // Stats globales
  const stats = useMemo(() => {
    const total = filteredResume.reduce((acc, s) => acc + s.totalHeures, 0);
    const enAttente = filteredResume.filter(s => s.status === 'Soumis').length;
    const valides = filteredResume.filter(s => s.status === 'Valide').length;
    const heuresSup = filteredResume.reduce((acc, s) => acc + s.heuresSup, 0);
    return { total, enAttente, valides, heuresSup, nbSalaries: filteredResume.length };
  }, [filteredResume]);

  // Navigation
  const goToPreviousWeek = () => {
    if (semaine === 1) {
      setAnnee(annee - 1);
      setSemaine(52);
    } else {
      setSemaine(semaine - 1);
    }
  };

  const goToNextWeek = () => {
    if (semaine === 52) {
      setAnnee(annee + 1);
      setSemaine(1);
    } else {
      setSemaine(semaine + 1);
    }
  };

  const goToCurrentWeek = () => {
    setAnnee(currentWeek.year);
    setSemaine(currentWeek.week);
  };

  const weekDays = getWeekDays(annee, semaine);

  const handleValidation = (salarieId: string, action: 'valider' | 'rejeter', anneeVal?: number, semaineVal?: number) => {
    const anneeToUse = anneeVal ?? annee;
    const semaineToUse = semaineVal ?? semaine;
    setSelectedValidation({ salarieId, annee: anneeToUse, semaine: semaineToUse, action });
  };

  const confirmAction = () => {
    if (!selectedValidation) return;
    
    if (selectedValidation.action === 'valider') {
      validerMutation.mutate({ 
        salarie_id: selectedValidation.salarieId.toString(), 
        annee: selectedValidation.annee, 
        semaine: selectedValidation.semaine 
      });
    } else {
      if (!commentaireRejet.trim()) {
        toast.error('Veuillez indiquer un motif de rejet');
        return;
      }
      rejeterMutation.mutate({ 
        salarie_id: selectedValidation.salarieId.toString(), 
        annee: selectedValidation.annee, 
        semaine: selectedValidation.semaine, 
        commentaire: commentaireRejet 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Valide':
        return <Badge variant="success">Validé</Badge>;
      case 'Soumis':
        return <Badge variant="info">En attente</Badge>;
      case 'Rejete':
        return <Badge variant="danger">Rejeté</Badge>;
      default:
        return <Badge variant="default">Brouillon</Badge>;
    }
  };


  const isLoadingValidations = isValidationsPage && !validationsEnAttente;

  if (isLoading || isLoadingValidations) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isValidationsPage ? 'Validations en attente' : 'Gestion des Pointages'}
          </h1>
          <p className="text-gray-500">
            {isValidationsPage ? 'Validez les pointages soumis par vos équipes' : 'Validez les heures de vos équipes'}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Navigation semaine - masquée sur la page Validations */}
      {!isValidationsPage && (
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[280px]">
              <h2 className="text-lg font-semibold text-gray-900">
                {formatWeekLabel(annee, semaine)}
              </h2>
              <p className="text-sm text-gray-500">
                {format(weekDays[0], 'dd MMM', { locale: fr })} - {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={semaine.toString()}
              onChange={(e) => setSemaine(parseInt(e.target.value))}
              options={getWeeksOfYear(annee).map(w => ({
                value: w.value.toString(),
                label: w.label,
              }))}
              className="w-24"
            />
            <Select
              value={annee.toString()}
              onChange={(e) => setAnnee(parseInt(e.target.value))}
              options={getYears().map(y => ({
                value: y.value.toString(),
                label: y.label,
              }))}
              className="w-28"
            />
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Aujourd'hui
            </Button>
          </div>
        </div>
      </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.nbSalaries}</p>
              <p className="text-xs text-gray-500">Salariés</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total.toFixed(1)}h</p>
              <p className="text-xs text-gray-500">Total heures</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 ${stats.enAttente > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.enAttente}</p>
              <p className="text-xs text-gray-500">En attente</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.valides}</p>
              <p className="text-xs text-gray-500">Validés</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-600">{stats.heuresSup.toFixed(1)}h</p>
              <p className="text-xs text-gray-500">Heures sup</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtres */}
      {!isValidationsPage && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filtres:</span>
            </div>
            <Select
              value={filtreSalarie}
              onChange={(e) => setFiltreSalarie(e.target.value)}
              options={[
                { value: '', label: 'Tous les salariés' },
                ...salaries.map((s: any) => ({
                  value: s.id.toString(),
                  label: `${s.prenom} ${s.nom}`,
                })),
              ]}
              className="w-48"
            />
            <Select
              value={filtreProjet}
              onChange={(e) => setFiltreProjet(e.target.value)}
              options={[
                { value: '', label: 'Tous les projets' },
                ...projets.map((p: any) => ({
                  value: p.id.toString(),
                  label: `${p.code_projet} - ${p.nom}`,
                })),
              ]}
              className="w-64"
            />
            {(filtreSalarie || filtreProjet) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltreSalarie('');
                  setFiltreProjet('');
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Affichage en cartes pour les validations */}
      {isValidationsPage ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredResume.length === 0 ? (
            <Card className="col-span-full p-12 text-center">
              <p className="text-gray-500">Aucune validation en attente</p>
            </Card>
          ) : (
            filteredResume.map((salarie) => (
              <Card key={`${salarie.id}`} className="p-5 hover:shadow-lg transition-shadow">
                {/* En-tête du salarié */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-semibold text-primary-700">
                        {salarie.prenom[0]}{salarie.nom[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        {salarie.prenom} {salarie.nom}
                      </p>
                      <p className="text-sm text-gray-500">
                        {salarie.semaines?.length || 0} semaine{(salarie.semaines?.length || 0) > 1 ? 's' : ''} en attente
                      </p>
                    </div>
                  </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(salarie.totalHeures)}h
                      </div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                </div>

                {/* Liste des semaines */}
                {salarie.semaines && salarie.semaines.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {salarie.semaines.map((sem) => (
                      <div
                        key={`${sem.annee}-${sem.semaine}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200"
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => setSelectedSemaineDetails({
                            salarieId: salarie.id,
                            salarieNom: salarie.nom,
                            salariePrenom: salarie.prenom,
                            annee: sem.annee,
                            semaine: sem.semaine
                          })}
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-900">
                              S{sem.semaine}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Semaine {sem.semaine} - {sem.annee}
                            </p>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-gray-600">
                                Total: <span className="font-semibold text-gray-900">{sem.totalHeures.toFixed(1)}h</span>
                              </p>
                              {sem.heuresSup !== undefined && sem.heuresSup > 0 && (
                                <p className="text-xs text-green-600">
                                  Heures sup: <span className="font-semibold">{sem.heuresSup.toFixed(1)}h</span>
                                </p>
                              )}
                              {sem.heuresDues !== undefined && sem.heuresDues > 0 && (
                                <p className="text-xs text-red-600">
                                  Heures dues: <span className="font-semibold">{sem.heuresDues.toFixed(1)}h</span>
                                </p>
                              )}
                              {sem.heuresRattrapees !== undefined && sem.heuresRattrapees > 0 && (
                                <p className="text-xs text-blue-600">
                                  Heures rattrapées: <span className="font-semibold">{sem.heuresRattrapees.toFixed(1)}h</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleValidation(salarie.id, 'valider', sem.annee, sem.semaine)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors text-sm font-medium"
                            title={`Valider la semaine ${sem.semaine} de ${sem.annee}`}
                          >
                            <Check className="w-4 h-4" />
                            Valider
                          </button>
                          <button
                            onClick={() => handleValidation(salarie.id, 'rejeter', sem.annee, sem.semaine)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors text-sm font-medium"
                            title={`Rejeter la semaine ${sem.semaine} de ${sem.annee}`}
                          >
                            <X className="w-4 h-4" />
                            Rejeter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status badge */}
                <div className="flex items-center justify-center pt-3 border-t border-gray-100">
                  {getStatusBadge(salarie.status)}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* Tableau pour la page normale */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Salarié
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Projets
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Heures
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Normales
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sup
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dues
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredResume.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Aucun pointage pour cette semaine
                    </td>
                  </tr>
                ) : (
                  filteredResume.map((salarie) => (
                  <tr key={`${salarie.id}-${salarie.annee}-${salarie.semaine}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary-700">
                            {salarie.prenom[0]}{salarie.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {salarie.prenom} {salarie.nom}
                          </p>
                        </div>
                      </div>
                    </td>
                    {isValidationsPage && salarie.semaines && salarie.semaines.length > 0 && (
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 mb-1">
                            {salarie.semaines.length} semaine{salarie.semaines.length > 1 ? 's' : ''} en attente
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {salarie.semaines.map((sem) => (
                              <div
                                key={`${sem.annee}-${sem.semaine}`}
                                className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-blue-900">
                                    Semaine {sem.semaine}/{sem.annee}
                                  </span>
                                  <span className="text-xs font-semibold text-blue-900">
                                    {sem.totalHeures.toFixed(1)}h
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {sem.heuresSup !== undefined && sem.heuresSup > 0 && (
                                    <span className="text-green-600">
                                      Sup: {sem.heuresSup.toFixed(1)}h
                                    </span>
                                  )}
                                  {sem.heuresDues !== undefined && sem.heuresDues > 0 && (
                                    <span className="text-red-600">
                                      Dues: {sem.heuresDues.toFixed(1)}h
                                    </span>
                                  )}
                                  {sem.heuresRattrapees !== undefined && sem.heuresRattrapees > 0 && (
                                    <span className="text-blue-600">
                                      Rattrapées: {sem.heuresRattrapees.toFixed(1)}h
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    )}
                    {isValidationsPage && (!salarie.semaines || salarie.semaines.length === 0) && salarie.annee && salarie.semaine && (
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-700">
                          S{salarie.semaine} - {salarie.annee}
                        </span>
                      </td>
                    )}
                    {!isValidationsPage && (
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {salarie.projets.map((projet) => (
                            <div key={projet.id} className="flex items-center gap-2 text-sm">
                              <FolderKanban className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">{projet.code}</span>
                              <span className="text-gray-400">-</span>
                              <span className="font-medium text-gray-900">{projet.heures}h</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-gray-900">
                          {salarie.totalHeures.toFixed(1)}h
                        </span>
                        {isValidationsPage && salarie.semaines && salarie.semaines.length > 1 && (
                          <span className="text-xs text-gray-500 mt-1">
                            sur {salarie.semaines.length} semaine{salarie.semaines.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    {!isValidationsPage && (
                      <>
                        <td className="px-6 py-4 text-center">
                          <span className="text-gray-600">
                            {salarie.heuresNormales.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {salarie.heuresSup > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <TrendingUp className="w-4 h-4" />
                              +{salarie.heuresSup.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {salarie.heuresDues > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <TrendingDown className="w-4 h-4" />
                              -{salarie.heuresDues.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(salarie.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {salarie.status === 'Soumis' && (
                          <div className="space-y-2">
                            {salarie.semaines && salarie.semaines.length > 0 ? (
                              salarie.semaines.map((sem) => (
                                <div 
                                  key={`${sem.annee}-${sem.semaine}`} 
                                  className="flex items-center gap-2 justify-center"
                                >
                                  <span className="text-xs text-gray-500 w-16 text-right">
                                    S{sem.semaine}/{sem.annee}:
                                  </span>
                                  <button
                                    onClick={() => handleValidation(salarie.id, 'valider', sem.annee, sem.semaine)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-sm font-medium"
                                    title={`Valider la semaine ${sem.semaine} de ${sem.annee}`}
                                  >
                                    <Check className="w-4 h-4" />
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => handleValidation(salarie.id, 'rejeter', sem.annee, sem.semaine)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm font-medium"
                                    title={`Rejeter la semaine ${sem.semaine} de ${sem.annee}`}
                                  >
                                    <X className="w-4 h-4" />
                                    Rejeter
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  onClick={() => handleValidation(salarie.id, 'valider', salarie.annee, salarie.semaine)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-sm font-medium"
                                  title="Valider"
                                >
                                  <Check className="w-4 h-4" />
                                  Valider
                                </button>
                                <button
                                  onClick={() => handleValidation(salarie.id, 'rejeter', salarie.annee, salarie.semaine)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm font-medium"
                                  title="Rejeter"
                                >
                                  <X className="w-4 h-4" />
                                  Rejeter
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {salarie.status === 'Brouillon' && (
                          <span className="text-xs text-gray-400">Non soumis</span>
                        )}
                        {salarie.status === 'Valide' && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                        {salarie.status === 'Rejete' && (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Modal confirmation */}
      <Modal
        isOpen={selectedValidation !== null}
        onClose={() => {
          setSelectedValidation(null);
          setCommentaireRejet('');
        }}
        title={selectedValidation?.action === 'valider' ? 'Valider la semaine' : 'Rejeter la semaine'}
        size="sm"
      >
        <div className="space-y-4">
          {selectedValidation?.action === 'valider' ? (
            <p className="text-gray-600">
              Êtes-vous sûr de vouloir valider cette semaine de pointage ?
            </p>
          ) : (
            <>
              <p className="text-gray-600">
                Veuillez indiquer le motif du rejet :
              </p>
              <textarea
                value={commentaireRejet}
                onChange={(e) => setCommentaireRejet(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={3}
                placeholder="Ex: Heures non conformes au planning..."
              />
            </>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedValidation(null);
                setCommentaireRejet('');
              }}
            >
              Annuler
            </Button>
            <Button
              variant={selectedValidation?.action === 'valider' ? 'primary' : 'danger'}
              onClick={confirmAction}
              isLoading={validerMutation.isPending || rejeterMutation.isPending}
            >
              {selectedValidation?.action === 'valider' ? 'Valider' : 'Rejeter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Détails Semaine */}
      <Modal
        isOpen={!!selectedSemaineDetails}
        onClose={() => setSelectedSemaineDetails(null)}
        title={`Détails de la semaine ${selectedSemaineDetails?.semaine}/${selectedSemaineDetails?.annee} - ${selectedSemaineDetails?.salariePrenom} ${selectedSemaineDetails?.salarieNom}`}
        size="lg"
      >
        {isLoadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : selectedSemaineDetails ? (
          <div className="space-y-6">
            {/* Mini calendrier */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Calendrier de la semaine</h3>
              <div className="grid grid-cols-7 gap-2">
                {getWeekDays(selectedSemaineDetails.annee, selectedSemaineDetails.semaine).map((day, index) => {
                  const dayName = format(day, 'EEE', { locale: fr });
                  const dayNumber = format(day, 'd');
                  const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
                  const dayNameFr = dayNames[index];
                  const heureField = `heure_${dayNameFr}`;
                  
                  // Calculer le total des heures pour ce jour en parcourant tous les pointages
                  const totalHeures = semaineDetailsData?.reduce((sum: number, p: any) => {
                    return sum + (Number(p[heureField]) || 0);
                  }, 0) || 0;
                  
                  // Récupérer les pointages qui ont des heures pour ce jour
                  const dayPointages = semaineDetailsData?.filter((p: any) => {
                    return (Number(p[heureField]) || 0) > 0;
                  }) || [];

                  // Vérifier s'il y a un congé pour ce jour
                  const congeType = getCongeForDay(index);
                  const congeConfig = congeType ? getCongeConfig(congeType) : null;

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 text-center ${
                        congeConfig
                          ? `${congeConfig.bgColor} border-${congeConfig.color.replace('text-', '')}`
                          : totalHeures > 0
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-600 mb-1">{dayName}</div>
                      <div className="text-lg font-bold text-gray-900 mb-1">{dayNumber}</div>
                      {congeConfig && (
                        <div className={`text-xs font-semibold ${congeConfig.color} mb-1 flex items-center justify-center gap-1`}>
                          {congeConfig.icon && <congeConfig.icon className="w-3 h-3" />}
                          {congeConfig.label}
                        </div>
                      )}
                      {totalHeures > 0 && (
                        <div className="text-xs font-semibold text-blue-700">{totalHeures.toFixed(1)}h</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Détails par jour */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pointages détaillés</h3>
              <div className="space-y-4">
                {getWeekDays(selectedSemaineDetails.annee, selectedSemaineDetails.semaine).map((day, dayIndex) => {
                  const dayName = format(day, 'EEEE d MMMM yyyy', { locale: fr });
                  const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
                  const dayNameFr = dayNames[dayIndex];
                  const heureField = `heure_${dayNameFr}`;
                  
                  // Récupérer les pointages qui ont des heures pour ce jour
                  const dayPointages = semaineDetailsData?.filter((p: any) => {
                    return (Number(p[heureField]) || 0) > 0;
                  }) || [];

                  const totalHeures = dayPointages.reduce((sum: number, p: any) => sum + (Number(p[heureField]) || 0), 0);

                  // Vérifier s'il y a un congé pour ce jour
                  const congeType = getCongeForDay(dayIndex);
                  const congeConfig = congeType ? getCongeConfig(congeType) : null;

                  if (totalHeures === 0 && !congeConfig) {
                    return null;
                  }

                  return (
                    <div key={dayIndex} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{dayName}</h4>
                          {(() => {
                            const congeType = getCongeForDay(dayIndex);
                            const congeConfig = congeType ? getCongeConfig(congeType) : null;
                            return congeConfig ? (
                              <Badge className={`${congeConfig.bgColor} ${congeConfig.color} border-0 flex items-center gap-1`}>
                                {congeConfig.icon && <congeConfig.icon className="w-3 h-3" />}
                                {congeConfig.label}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                        {totalHeures > 0 && (
                          <span className="text-sm font-semibold text-blue-700">
                            Total: {totalHeures.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      {dayPointages.length > 0 ? (
                        <div className="space-y-2">
                          {dayPointages.map((pointage: any, idx: number) => {
                            const heures = Number(pointage[heureField]) || 0;
                            if (heures === 0) return null;
                            
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: pointage.tache_type?.couleur || '#10B981'
                                    }}
                                  />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {pointage.projet?.nom || 'Projet inconnu'}
                                      {pointage.projet?.code_projet && (
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({pointage.projet.code_projet})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {pointage.tache_type?.tache_type || 'Tâche inconnue'}
                                      {pointage.tache_type?.code && (
                                        <span className="ml-1">({pointage.tache_type.code})</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                  {heures.toFixed(1)}h
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucun pointage pour ce jour</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};