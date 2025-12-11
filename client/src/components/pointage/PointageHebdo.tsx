import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Coffee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { pointagesApi, projetsApi, congesApi } from '@/services/api';
import { Button, Card, Badge, Select, Spinner, Modal, Input } from '@/components/ui';
import {
  getCurrentWeek,
  getNextWeek,
  getPreviousWeek,
  formatWeekLabel,
  getWeekDays,
  formatDate,
  getDayName,
  getWeeksOfYear,
  getYears,
  isHoliday,
  getHolidayName,
} from '@/utils/dates';
import type { Projet, SalariePointage, JourFerie, CongeType } from '@/types';

const HEURES_SEMAINE_NORMALE = 35;
const HEURES_CP_PAR_JOUR = 7;

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const JOURS_OUVRABLES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;

interface PointageLigne {
  id?: string;
  projet_id: string;
  projet?: Projet;
  tache_projet_id?: string;
  tache_type_id?: string;
  tache_type?: any;
  heures: Record<typeof JOURS[number], number>;
  commentaire?: string;
  isNew?: boolean;
}

// Structure pour gérer les absences par jour avec leur type
interface AbsenceJour {
  actif: boolean;
  type: CongeType;
}

interface CongesState {
  lundi: AbsenceJour;
  mardi: AbsenceJour;
  mercredi: AbsenceJour;
  jeudi: AbsenceJour;
  vendredi: AbsenceJour;
}

export const PointageHebdo = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // État de la semaine sélectionnée
  const [annee, setAnnee] = useState(getCurrentWeek().year);
  const [semaine, setSemaine] = useState(getCurrentWeek().week);
  
  // État du pointage
  const [lignes, setLignes] = useState<PointageLigne[]>([]);
  const [conges, setConges] = useState<CongesState>({
    lundi: { actif: false, type: 'CP' },
    mardi: { actif: false, type: 'CP' },
    mercredi: { actif: false, type: 'CP' },
    jeudi: { actif: false, type: 'CP' },
    vendredi: { actif: false, type: 'CP' },
  });
  
  // Modal ajout projet
  const [showAddProjet, setShowAddProjet] = useState(false);
  const [selectedProjetId, setSelectedProjetId] = useState('');
  const [selectedTacheTypeId, setSelectedTacheTypeId] = useState('');

  // Récupérer les jours de la semaine
  const joursSemaine = useMemo(() => {
    try {
      if (!annee || !semaine) return [];
      return getWeekDays(annee, semaine);
    } catch (e) {
      console.error('Erreur getWeekDays:', e);
      return [];
    }
  }, [annee, semaine]);

  // Queries - Récupérer les projets assignés au salarié
  const { data: mesProjets = [], isLoading: projetsLoading } = useQuery({
    queryKey: ['mes-projets', user?.id],
    queryFn: () => projetsApi.getMesProjets(),
  });

  // Liste des projets assignés avec leurs tâches
  const projetsDisponibles = useMemo(() => {
    return mesProjets.map((p: any) => ({
      ...p,
      tachesAssignees: p.affectations
        ?.filter((a: any) => a.salarie_id === user?.id)
        .map((a: any) => a.tache_projet) || [],
    }));
  }, [mesProjets, user?.id]);

  const { data: semaineData, isLoading: semaineLoading, refetch } = useQuery({
    queryKey: ['pointage-semaine', annee, semaine],
    queryFn: () => pointagesApi.getSemaine(annee, semaine),
  });

  const { data: joursFeries = [] } = useQuery({
    queryKey: ['jours-feries', annee],
    queryFn: () => congesApi.getJoursFeries(annee),
  });

  // Initialiser les lignes avec les données existantes
  useEffect(() => {
    console.log('=== useEffect semaineData ===');
    console.log('semaineData:', semaineData);
    
    if (semaineData?.pointages) {
      console.log('Pointages reçus:', semaineData.pointages);
      
      const lignesExistantes: PointageLigne[] = semaineData.pointages.map((p: any) => {
        const ligne = {
          id: p.id,
          projet_id: p.projet_id?.toString(),
          projet: p.projet,
          tache_projet_id: p.tache_projet_id,
          tache_type_id: p.tache_type_id?.toString() || p.tache_type?.id?.toString(),
          tache_type: p.tache_type,
          heures: {
            lundi: Number(p.heure_lundi) || 0,
            mardi: Number(p.heure_mardi) || 0,
            mercredi: Number(p.heure_mercredi) || 0,
            jeudi: Number(p.heure_jeudi) || 0,
            vendredi: Number(p.heure_vendredi) || 0,
            samedi: Number(p.heure_samedi) || 0,
            dimanche: Number(p.heure_dimanche) || 0,
          },
          commentaire: p.commentaire,
        };
        console.log('Ligne créée:', ligne);
        return ligne;
      });
      setLignes(lignesExistantes);
    } else {
      setLignes([]);
    }

    if (semaineData?.conges) {
      const typeConge = semaineData.conges.type_conge || 'CP';
      setConges({
        lundi: { actif: semaineData.conges.cp_lundi || false, type: semaineData.conges.type_lundi || typeConge },
        mardi: { actif: semaineData.conges.cp_mardi || false, type: semaineData.conges.type_mardi || typeConge },
        mercredi: { actif: semaineData.conges.cp_mercredi || false, type: semaineData.conges.type_mercredi || typeConge },
        jeudi: { actif: semaineData.conges.cp_jeudi || false, type: semaineData.conges.type_jeudi || typeConge },
        vendredi: { actif: semaineData.conges.cp_vendredi || false, type: semaineData.conges.type_vendredi || typeConge },
      });
    } else {
      setConges({
        lundi: { actif: false, type: 'CP' },
        mardi: { actif: false, type: 'CP' },
        mercredi: { actif: false, type: 'CP' },
        jeudi: { actif: false, type: 'CP' },
        vendredi: { actif: false, type: 'CP' },
      });
    }
  }, [semaineData]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Sauvegarder chaque ligne de pointage
      for (const ligne of lignes) {
        if (ligne.projet_id && ligne.tache_type_id) {
          console.log('Sauvegarde ligne:', {
            projet_id: ligne.projet_id,
            tache_type_id: ligne.tache_type_id,
            annee,
            semaine,
            heures: ligne.heures
          });
          
          await pointagesApi.create({
            projet_id: ligne.projet_id,
            tache_type_id: ligne.tache_type_id,
            annee,
            semaine,
            heure_lundi: ligne.heures.lundi || 0,
            heure_mardi: ligne.heures.mardi || 0,
            heure_mercredi: ligne.heures.mercredi || 0,
            heure_jeudi: ligne.heures.jeudi || 0,
            heure_vendredi: ligne.heures.vendredi || 0,
            heure_samedi: ligne.heures.samedi || 0,
            heure_dimanche: ligne.heures.dimanche || 0,
            commentaire: ligne.commentaire,
          });
        } else {
          console.warn('Ligne sans tache_type_id ignorée:', ligne);
        }
      }
      // Sauvegarder les congés avec les types par jour
      await congesApi.create({
        annee,
        semaine,
        cp_lundi: conges.lundi.actif,
        cp_mardi: conges.mardi.actif,
        cp_mercredi: conges.mercredi.actif,
        cp_jeudi: conges.jeudi.actif,
        cp_vendredi: conges.vendredi.actif,
        type_lundi: conges.lundi.type,
        type_mardi: conges.mardi.type,
        type_mercredi: conges.mercredi.type,
        type_jeudi: conges.jeudi.type,
        type_vendredi: conges.vendredi.type,
        type_conge: conges.lundi.actif ? conges.lundi.type :
                    conges.mardi.actif ? conges.mardi.type :
                    conges.mercredi.actif ? conges.mercredi.type :
                    conges.jeudi.actif ? conges.jeudi.type :
                    conges.vendredi.actif ? conges.vendredi.type : 'CP',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
      toast.success('Pointage enregistré');
    },
    onError: (error: any) => {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => pointagesApi.soumettre(annee, semaine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
      toast.success('Pointage soumis pour validation');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la soumission');
    },
  });

  // Navigation semaine
  const goToPreviousWeek = () => {
    const prev = getPreviousWeek(annee, semaine);
    setAnnee(prev.year);
    setSemaine(prev.week);
  };

  const goToNextWeek = () => {
    const next = getNextWeek(annee, semaine);
    setAnnee(next.year);
    setSemaine(next.week);
  };

  const goToCurrentWeek = () => {
    const current = getCurrentWeek();
    setAnnee(current.year);
    setSemaine(current.week);
  };

  // Gestion des lignes
  const addLigne = () => {
    if (!selectedProjetId) {
      toast.error('Sélectionnez un projet');
      return;
    }
    
    if (!selectedTacheTypeId) {
      toast.error('Sélectionnez une tâche');
      return;
    }
    
    const projet = projetsDisponibles.find((p: any) => p.id?.toString() === selectedProjetId);
    
    if (!projet) {
      toast.error('Projet non trouvé');
      return;
    }
    
    const affectation = projet.affectations?.find((a: any) => 
      a.tache_type_id?.toString() === selectedTacheTypeId
    );
    
    console.log('Ajout ligne avec tâche:', { projet, tache_type_id: selectedTacheTypeId, affectation });
    
    setLignes([...lignes, {
      projet_id: selectedProjetId,
      projet,
      tache_type_id: selectedTacheTypeId,
      tache_type: affectation?.tache_type || affectation?.tache_projet?.tache_type,
      heures: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0, samedi: 0, dimanche: 0 },
      isNew: true,
    }]);
    setShowAddProjet(false);
    setSelectedProjetId('');
    setSelectedTacheTypeId('');
  };

  const removeLigne = (index: number) => {
    const newLignes = [...lignes];
    newLignes.splice(index, 1);
    setLignes(newLignes);
  };

  const updateHeures = (index: number, jour: typeof JOURS[number], value: number) => {
    const newLignes = [...lignes];
    newLignes[index].heures[jour] = Math.max(0, Math.min(24, value));
    setLignes(newLignes);
  };

  const toggleConge = (jour: typeof JOURS_OUVRABLES[number], type: CongeType = 'CP') => {
    const heuresJour = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
    const jourData = conges[jour];
    
    if (heuresJour > 0 && !jourData.actif) {
      toast.error('Supprimez d\'abord les heures pointées ce jour');
      return;
    }
    
    setConges({ 
      ...conges, 
      [jour]: { 
        actif: !jourData.actif, 
        type: type 
      } 
    });
  };

  const setTypeConge = (jour: typeof JOURS_OUVRABLES[number], type: CongeType) => {
    const jourData = conges[jour];
    setConges({ 
      ...conges, 
      [jour]: { 
        ...jourData, 
        type: type 
      } 
    });
  };

  // Calculs
  const calculs = useMemo(() => {
    // Heures travaillées par jour
    const heuresParJour = JOURS.reduce((acc, jour) => {
      acc[jour] = lignes.reduce((sum, l) => sum + (Number(l.heures[jour]) || 0), 0);
      return acc;
    }, {} as Record<string, number>);

    // Total heures travaillées
    const heuresTravaillees = Object.values(heuresParJour).reduce((sum, h) => sum + Number(h), 0);

    // Jours de congé payé (CP et RTT uniquement)
    const joursCP = JOURS_OUVRABLES.filter(j => {
      const jourData = conges[j];
      return jourData.actif && (jourData.type === 'CP' || jourData.type === 'RTT');
    }).length;
    const heuresCP = joursCP * HEURES_CP_PAR_JOUR;

    // Jours de maladie
    const joursMaladie = JOURS_OUVRABLES.filter(j => {
      const jourData = conges[j];
      return jourData.actif && jourData.type === 'Maladie';
    }).length;
    const heuresMaladie = joursMaladie * HEURES_CP_PAR_JOUR;

    // Jours de déplacement (comptés comme travaillés)
    const joursDeplacement = JOURS_OUVRABLES.filter(j => {
      const jourData = conges[j];
      return jourData.actif && jourData.type === 'Deplacement';
    }).length;
    const heuresDeplacement = joursDeplacement * HEURES_CP_PAR_JOUR;

    // Total semaine = travail + CP + déplacement (maladie = heures dues)
    const totalSemaine = heuresTravaillees + heuresCP + heuresDeplacement;

    // Heures normales, sup, dues
    // Maladie = heures dues (non travaillées mais justifiées)
    const heuresNormales = Math.min(totalSemaine, HEURES_SEMAINE_NORMALE);
    const heuresSup = Math.max(0, totalSemaine - HEURES_SEMAINE_NORMALE);
    const heuresDues = heuresMaladie; // Les heures maladie sont les heures dues

    return {
      heuresParJour,
      heuresTravaillees,
      joursCP,
      heuresCP,
      joursMaladie,
      heuresMaladie,
      joursDeplacement,
      heuresDeplacement,
      totalSemaine,
      heuresNormales,
      heuresSup,
      heuresDues,
    };
  }, [lignes, conges]);

  // Status de la semaine
  const validationStatus = semaineData?.validation?.status || 'Brouillon';
  const isLocked = validationStatus === 'Valide' || validationStatus === 'Soumis';

  const statusConfig: Record<string, { label: string; color: string }> = {
    Brouillon: { label: 'Brouillon', color: 'gray' },
    Soumis: { label: 'En attente de validation', color: 'yellow' },
    Valide: { label: 'Validé', color: 'green' },
    Rejete: { label: 'Rejeté', color: 'red' },
  };

  if (semaineLoading || projetsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Vérifier que les jours de la semaine sont disponibles
  if (joursSemaine.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pointage hebdomadaire</h1>
          <p className="text-gray-600">Saisissez vos heures par projet</p>
        </div>
        <Badge variant={statusConfig[validationStatus]?.color as any}>
          {statusConfig[validationStatus]?.label}
        </Badge>
      </div>

      {/* Navigation semaine */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Select
                value={semaine.toString()}
                onChange={(e) => setSemaine(parseInt(e.target.value))}
                options={getWeeksOfYear(annee).map(w => ({
                  value: w.value.toString(),
                  label: w.label,
                }))}
                className="w-32"
              />
              <Select
                value={annee.toString()}
                onChange={(e) => setAnnee(parseInt(e.target.value))}
                options={getYears().map(y => ({
                  value: y.value.toString(),
                  label: y.label,
                }))}
                className="w-24"
              />
            </div>

            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center text-sm text-gray-600">
            {formatWeekLabel(annee, semaine)}
          </div>

          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            <Calendar className="w-4 h-4" />
            Semaine actuelle
          </Button>
        </div>
      </Card>

      {/* Tableau de pointage */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                  Projet / Tâche
                </th>
                {JOURS.map((jour, index) => {
                  const date = joursSemaine[index];
                  const jourFerie = joursFeries.find((jf: JourFerie) => 
                    formatDate(jf.date, 'yyyy-MM-dd') === formatDate(date, 'yyyy-MM-dd')
                  );
                  const isWeekend = index >= 5;
                  const jourData = JOURS_OUVRABLES.includes(jour as any) 
                    ? conges[jour as keyof CongesState]
                    : null;
                  const isAbsent = jourData?.actif || false;
                  const absenceType = jourData?.type;

                  return (
                    <th 
                      key={jour} 
                      className={clsx(
                        'px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20',
                        isWeekend ? 'bg-gray-100 text-gray-400' : '',
                        jourFerie ? 'bg-red-50 text-red-600' : '',
                        isAbsent && absenceType === 'Maladie' ? 'bg-blue-50 text-blue-600' : '',
                        isAbsent && absenceType === 'Deplacement' ? 'bg-purple-50 text-purple-600' : '',
                        isAbsent && absenceType !== 'Maladie' && absenceType !== 'Deplacement' ? 'bg-amber-50 text-amber-600' : '',
                        !isWeekend && !jourFerie && !isAbsent ? 'text-gray-600' : ''
                      )}
                    >
                      <div>{getDayName(index)}</div>
                      <div className="text-[10px] font-normal">
                        {formatDate(date, 'dd/MM')}
                      </div>
                      {jourFerie && (
                        <div className="text-[9px] font-normal truncate" title={jourFerie.libelle}>
                          {jourFerie.libelle}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                  Total
                </th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Ligne Congés / Absences */}
              <tr className="bg-gradient-to-r from-amber-50/50 to-blue-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-gray-700">Absences</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">CP</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Maladie</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Déplacement</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Formation</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">Sans solde</span>
                  </div>
                </td>
                {JOURS.map((jour, index) => {
                  const isOuvrable = JOURS_OUVRABLES.includes(jour as any);
                  const jourData = isOuvrable ? conges[jour as keyof CongesState] : null;
                  const isChecked = jourData?.actif || false;
                  const typeConge = jourData?.type || 'CP';
                  
                  // Couleur selon le type
                  const getTypeColor = (type: string) => {
                    switch(type) {
                      case 'Maladie': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', checkbox: 'text-blue-600 focus:ring-blue-500' };
                      case 'Deplacement': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', checkbox: 'text-purple-600 focus:ring-purple-500' };
                      case 'Formation': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', checkbox: 'text-green-600 focus:ring-green-500' };
                      case 'Sans_solde': return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', checkbox: 'text-gray-600 focus:ring-gray-500' };
                      case 'RTT': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', checkbox: 'text-orange-600 focus:ring-orange-500' };
                      default: return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', checkbox: 'text-amber-600 focus:ring-amber-500' };
                    }
                  };
                  const colors = getTypeColor(typeConge);
                  
                  return (
                    <td key={jour} className="px-2 py-3 text-center">
                      {isOuvrable ? (
                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleConge(jour as typeof JOURS_OUVRABLES[number], typeConge)}
                              disabled={isLocked}
                              className={clsx(
                                'w-5 h-5 rounded focus:ring-2',
                                colors.border,
                                colors.checkbox
                              )}
                            />
                          </label>
                          {isChecked && (
                            <select
                              value={typeConge}
                              onChange={(e) => setTypeConge(jour as typeof JOURS_OUVRABLES[number], e.target.value as CongeType)}
                              disabled={isLocked}
                              className={clsx(
                                'text-[10px] px-1 py-0.5 rounded border-0 font-medium',
                                colors.bg,
                                colors.text
                              )}
                            >
                              <option value="CP">CP</option>
                              <option value="Maladie">Maladie</option>
                              <option value="Deplacement">Déplacement</option>
                              <option value="Formation">Formation</option>
                              <option value="Sans_solde">Sans solde</option>
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col gap-1">
                    {calculs.heuresCP > 0 && (
                      <span className="text-amber-700 font-semibold text-xs">{calculs.heuresCP}h CP</span>
                    )}
                    {calculs.heuresMaladie > 0 && (
                      <span className="text-blue-700 font-semibold text-xs">{calculs.heuresMaladie}h Mal.</span>
                    )}
                    {calculs.heuresDeplacement > 0 && (
                      <span className="text-purple-700 font-semibold text-xs">{calculs.heuresDeplacement}h Dépl.</span>
                    )}
                    {calculs.heuresCP === 0 && calculs.heuresMaladie === 0 && calculs.heuresDeplacement === 0 && (
                      <span className="text-gray-400">0h</span>
                    )}
                  </div>
                </td>
                <td></td>
              </tr>

              {/* Lignes de pointage */}
              {lignes.map((ligne, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {ligne.projet?.nom || 'Projet inconnu'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{ligne.projet?.code_projet}</span>
                      {ligne.tache_type && (
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: ligne.tache_type.couleur ? `${ligne.tache_type.couleur}20` : '#3B82F620',
                            color: ligne.tache_type.couleur || '#3B82F6'
                          }}
                        >
                          {ligne.tache_type.tache_type || ligne.tache_type}
                        </span>
                      )}
                    </div>
                  </td>
                  {JOURS.map((jour, jourIndex) => {
                    const isWeekend = jourIndex >= 5;
                    const jourData = JOURS_OUVRABLES.includes(jour as any) 
                      ? conges[jour as keyof CongesState]
                      : null;
                    const isAbsent = jourData?.actif || false;
                    const absenceType = jourData?.type;
                    const jourFerie = joursFeries.find((jf: JourFerie) => 
                      formatDate(jf.date, 'yyyy-MM-dd') === formatDate(joursSemaine[jourIndex], 'yyyy-MM-dd')
                    );
                    
                    // Déplacement permet de pointer (on est en déplacement mais on travaille)
                    const cannotEdit = isAbsent && absenceType !== 'Deplacement';
                    
                    return (
                      <td key={jour} className={clsx(
                        'px-2 py-3 text-center',
                        isWeekend && 'bg-gray-50',
                        isAbsent && absenceType === 'Maladie' && 'bg-blue-50',
                        isAbsent && absenceType === 'Deplacement' && 'bg-purple-50',
                        isAbsent && absenceType !== 'Maladie' && absenceType !== 'Deplacement' && 'bg-amber-50',
                        jourFerie && 'bg-red-50'
                      )}>
                        <input
                          type="number"
                          value={ligne.heures[jour] || ''}
                          onChange={(e) => updateHeures(index, jour, parseFloat(e.target.value) || 0)}
                          disabled={isLocked || cannotEdit || !!jourFerie}
                          min="0"
                          max="24"
                          step="0.5"
                          className={clsx(
                            'w-14 px-2 py-1 text-center rounded border text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500',
                            isLocked || cannotEdit || jourFerie
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                              : 'border-gray-300 hover:border-gray-400'
                          )}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-semibold">
                    {Object.values(ligne.heures).reduce((s, h) => s + Number(h), 0)}h
                  </td>
                  <td className="px-2 py-3">
                    {!isLocked && (
                      <button
                        onClick={() => removeLigne(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* Bouton ajouter projet */}
              {!isLocked && (
                <tr>
                  <td colSpan={10} className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddProjet(true)}
                      className="text-primary-600"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un projet
                    </Button>
                  </td>
                </tr>
              )}

              {/* Ligne total par jour */}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-4 py-3 text-gray-700">
                  Total journalier
                </td>
                {JOURS.map((jour) => (
                  <td key={jour} className="px-2 py-3 text-center text-gray-700">
                    {calculs.heuresParJour[jour]}h
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-primary-700">
                  {calculs.heuresTravaillees}h
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Résumé de la semaine */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Heures travaillées</div>
          <div className="text-2xl font-bold text-gray-900">{calculs.heuresTravaillees}h</div>
        </Card>
        <Card className={clsx('p-4', calculs.joursMaladie > 0 && 'bg-blue-50 border-blue-200')}>
          <div className="text-sm text-gray-500">Heures Maladie ({calculs.joursMaladie}j)</div>
          <div className="text-2xl font-bold text-blue-600">{calculs.heuresMaladie}h</div>
        </Card>
        <Card className={clsx('p-4', calculs.joursCP > 0 && 'bg-amber-50 border-amber-200')}>
          <div className="text-sm text-gray-500">Heures CP ({calculs.joursCP}j)</div>
          <div className="text-2xl font-bold text-amber-600">{calculs.heuresCP}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total semaine</div>
          <div className="text-2xl font-bold text-primary-600">{calculs.totalSemaine}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Heures normales</div>
          <div className="text-2xl font-bold text-gray-900">{calculs.heuresNormales}h</div>
        </Card>
        <Card className={clsx('p-4', calculs.heuresSup > 0 && 'bg-green-50 border-green-200')}>
          <div className="text-sm text-gray-500">Heures sup</div>
          <div className={clsx(
            'text-2xl font-bold',
            calculs.heuresSup > 0 ? 'text-green-600' : 'text-gray-400'
          )}>
            +{calculs.heuresSup}h
          </div>
        </Card>
        <Card className={clsx('p-4', calculs.heuresDues > 0 && 'bg-red-50 border-red-200')}>
          <div className="text-sm text-gray-500">Heures dues</div>
          <div className={clsx(
            'text-2xl font-bold',
            calculs.heuresDues > 0 ? 'text-red-600' : 'text-gray-400'
          )}>
            {calculs.heuresDues > 0 ? `-${calculs.heuresDues}h` : '0h'}
          </div>
        </Card>
      </div>

      {/* Boutons d'action */}
      {!isLocked && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            isLoading={submitMutation.isPending}
            disabled={calculs.totalSemaine === 0}
          >
            <Send className="w-4 h-4" />
            Soumettre pour validation
          </Button>
        </div>
      )}

      {/* Message si validé */}
      {validationStatus === 'Valide' && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Cette semaine a été validée</span>
          </div>
        </Card>
      )}

      {/* Message si rejeté */}
      {validationStatus === 'Rejete' && semaineData?.validation?.commentaire_rejet && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Semaine rejetée : {semaineData.validation.commentaire_rejet}</span>
          </div>
        </Card>
      )}

      {/* Modal ajout projet */}
      <Modal
        isOpen={showAddProjet}
        onClose={() => {
          setShowAddProjet(false);
          setSelectedProjetId('');
          setSelectedTacheTypeId('');
        }}
        title="Ajouter un projet"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Projet"
            value={selectedProjetId}
            onChange={(e) => {
              setSelectedProjetId(e.target.value);
              setSelectedTacheTypeId('');
            }}
            options={[
              { value: '', label: 'Sélectionner un projet' },
              ...projetsDisponibles.map((p: any) => ({
                value: p.id?.toString(),
                label: `${p.code_projet} - ${p.nom}`,
              })),
            ]}
          />
          
          {selectedProjetId && (
            <Select
              label="Tâche"
              value={selectedTacheTypeId}
              onChange={(e) => setSelectedTacheTypeId(e.target.value)}
              options={[
                { value: '', label: 'Sélectionner une tâche' },
                ...(projetsDisponibles
                  .find((p: any) => p.id?.toString() === selectedProjetId)
                  ?.affectations?.map((a: any) => ({
                    value: a.tache_type_id?.toString(),
                    label: a.tache_type?.tache_type || a.tache_projet?.tache_type?.tache_type || 'Tâche',
                  })) || []),
              ]}
            />
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => {
              setShowAddProjet(false);
              setSelectedProjetId('');
              setSelectedTacheTypeId('');
            }}>
              Annuler
            </Button>
            <Button onClick={addLigne} disabled={!selectedProjetId || !selectedTacheTypeId}>
              Ajouter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};