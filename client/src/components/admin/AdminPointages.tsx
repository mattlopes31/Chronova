import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pointagesApi, salariesApi, projetsApi } from '@/services/api';
import { Card, Badge, Button, Select, Modal, Spinner } from '@/components/ui';
import { getCurrentWeek, getWeekDays, formatWeekLabel, getWeeksOfYear, getYears } from '@/utils/dates';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Constantes
const HEURES_SEMAINE_NORMALE = 35;

interface PointageResume {
  salarieId: number;
  salarieNom: string;
  salariePrenom: string;
  projetId: number;
  projetNom: string;
  projetCode: string;
  heuresPointees: number;
  heuresEstimees: number;
  status: 'Brouillon' | 'Soumis' | 'Valide' | 'Rejete';
  validationId?: number;
}

interface SalarieResume {
  id: number;
  nom: string;
  prenom: string;
  totalHeures: number;
  heuresNormales: number;
  heuresSup: number;
  heuresDues: number;
  joursCP: number;
  status: 'Brouillon' | 'Soumis' | 'Valide' | 'Rejete';
  projets: {
    id: number;
    nom: string;
    code: string;
    heures: number;
  }[];
}

export const AdminPointages = () => {
  const queryClient = useQueryClient();
  const currentWeek = getCurrentWeek();
  
  const [annee, setAnnee] = useState(currentWeek.year);
  const [semaine, setSemaine] = useState(currentWeek.week);
  const [filtreProjet, setFiltreProjet] = useState<string>('');
  const [filtreSalarie, setFiltreSalarie] = useState<string>('');
  const [selectedValidation, setSelectedValidation] = useState<{salarieId: number; action: 'valider' | 'rejeter'} | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');

  // Queries
  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries'],
    queryFn: salariesApi.getAll,
  });

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: projetsApi.getAll,
  });

  const { data: pointagesData, isLoading } = useQuery({
    queryKey: ['admin-pointages', annee, semaine],
    queryFn: () => pointagesApi.getAll({ annee, semaine }),
  });

  // Mutations
  const validerMutation = useMutation({
    mutationFn: ({ salarie_id, annee, semaine }: { salarie_id: string; annee: number; semaine: number }) => 
      pointagesApi.valider(salarie_id, annee, semaine),
    onSuccess: () => {
      toast.success('Semaine validée');
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
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
      setSelectedValidation(null);
      setCommentaireRejet('');
    },
    onError: () => toast.error('Erreur lors du rejet'),
  });

  // Calcul des résumés par salarié
  const salariesResume = useMemo<SalarieResume[]>(() => {
    // L'API renvoie directement un tableau de pointages
    const pointages = Array.isArray(pointagesData) ? pointagesData : [];
    
    if (pointages.length === 0) return [];

    const resumeMap = new Map<number, SalarieResume>();

    pointages.forEach((p: any) => {
      const salarieId = parseInt(p.salarie_id);
      
      if (!resumeMap.has(salarieId)) {
        const salarie = salaries.find((s: any) => parseInt(s.id) === salarieId);
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
      const projetId = parseInt(p.projet_id);
      const projetIndex = resume.projets.findIndex(pr => pr.id === projetId);
      if (projetIndex >= 0) {
        resume.projets[projetIndex].heures += heures;
      } else {
        const projet = projets.find((pr: any) => parseInt(pr.id) === projetId);
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
    resumeMap.forEach((resume) => {
      resume.heuresNormales = Math.min(resume.totalHeures, HEURES_SEMAINE_NORMALE);
      resume.heuresSup = Math.max(0, resume.totalHeures - HEURES_SEMAINE_NORMALE);
      resume.heuresDues = Math.max(0, HEURES_SEMAINE_NORMALE - resume.totalHeures);
    });

    return Array.from(resumeMap.values());
  }, [pointagesData, salaries, projets]);

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

  const handleValidation = (salarieId: number, action: 'valider' | 'rejeter') => {
    setSelectedValidation({ salarieId, action });
  };

  const confirmAction = () => {
    if (!selectedValidation) return;
    
    if (selectedValidation.action === 'valider') {
      validerMutation.mutate({ 
        salarie_id: selectedValidation.salarieId.toString(), 
        annee, 
        semaine 
      });
    } else {
      if (!commentaireRejet.trim()) {
        toast.error('Veuillez indiquer un motif de rejet');
        return;
      }
      rejeterMutation.mutate({ 
        salarie_id: selectedValidation.salarieId.toString(), 
        annee, 
        semaine, 
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

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Pointages</h1>
          <p className="text-gray-500">Validez les heures de vos équipes</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Navigation semaine */}
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
                value: w.week.toString(),
                label: `S${w.week}`,
              }))}
              className="w-24"
            />
            <Select
              value={annee.toString()}
              onChange={(e) => setAnnee(parseInt(e.target.value))}
              options={getYears().map(y => ({
                value: y.toString(),
                label: y.toString(),
              }))}
              className="w-28"
            />
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Aujourd'hui
            </Button>
          </div>
        </div>
      </Card>

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

      {/* Tableau des pointages */}
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
                  <tr key={salarie.id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-gray-900">
                        {salarie.totalHeures.toFixed(1)}h
                      </span>
                    </td>
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
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(salarie.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {salarie.status === 'Soumis' && (
                          <>
                            <button
                              onClick={() => handleValidation(salarie.id, 'valider')}
                              className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="Valider"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleValidation(salarie.id, 'rejeter')}
                              className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              title="Rejeter"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
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
    </div>
  );
};