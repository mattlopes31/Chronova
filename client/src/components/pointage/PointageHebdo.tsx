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
const HEURES_OTHER_PAR_JOUR = 0;


const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const JOURS_OUVRABLES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;

interface PointageLigne {
  id?: string;
  projet_id: string;
  projet?: Projet;
  tache_projet_id?: string;
  heures: Record<typeof JOURS[number], number>;
  commentaire?: string;
  isNew?: boolean;
}

interface CongesState {
  lundi: boolean;
  mardi: boolean;
  mercredi: boolean;
  jeudi: boolean;
  vendredi: boolean;
  type_conge: CongeType;
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
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    type_conge: 'CP',
  });
  
  // Modal ajout projet
  const [showAddProjet, setShowAddProjet] = useState(false);
  const [selectedProjetId, setSelectedProjetId] = useState('');

  // Récupérer les jours de la semaine
  const joursSemaine = useMemo(() => getWeekDays(annee, semaine), [annee, semaine]);

  // Queries - Récupérer les projets assignés au salarié
  const { data: mesProjets = [], isLoading: projetsLoading } = useQuery({
    queryKey: ['mes-projets', user?.id],
    queryFn: () => projetsApi.getMesProjets(),
  });

  // Liste des projets assignés avec leurs tâches
  const projetsDisponibles = useMemo(() => {
    return mesProjets.map((p: any) => ({
      ...p,
      // Filtrer les tâches pour ne garder que celles assignées au salarié
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
          tache_type_id: p.tache_type_id?.toString() || p.tache_type?.id?.toString(),  // AJOUTÉ
          tache_type: p.tache_type,  // AJOUTÉ
          heures: {
            lundi: p.heure_lundi || 0,
            mardi: p.heure_mardi || 0,
            mercredi: p.heure_mercredi || 0,
            jeudi: p.heure_jeudi || 0,
            vendredi: p.heure_vendredi || 0,
            samedi: p.heure_samedi || 0,
            dimanche: p.heure_dimanche || 0,
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
      setConges({
        lundi: semaineData.conges.cp_lundi || false,
        mardi: semaineData.conges.cp_mardi || false,
        mercredi: semaineData.conges.cp_mercredi || false,
        jeudi: semaineData.conges.cp_jeudi || false,
        vendredi: semaineData.conges.cp_vendredi || false,
        type_conge: semaineData.conges.type_conge || 'CP',
      });
    } else {
      setConges({
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        type_conge: 'CP',
      });
    }
  }, [semaineData]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Sauvegarder chaque ligne de pointage
      for (const ligne of lignes) {
        if (ligne.projet_id) {
          await pointagesApi.create({
            projet_id: ligne.projet_id,
            tache_projet_id: ligne.tache_projet_id,
            annee,
            semaine,
            heure_lundi: ligne.heures.lundi || undefined,
            heure_mardi: ligne.heures.mardi || undefined,
            heure_mercredi: ligne.heures.mercredi || undefined,
            heure_jeudi: ligne.heures.jeudi || undefined,
            heure_vendredi: ligne.heures.vendredi || undefined,
            heure_samedi: ligne.heures.samedi || undefined,
            heure_dimanche: ligne.heures.dimanche || undefined,
            commentaire: ligne.commentaire,
          });
        }
      }
      // Sauvegarder les congés
      await congesApi.create({
        annee,
        semaine,
        cp_lundi: conges.lundi,
        cp_mardi: conges.mardi,
        cp_mercredi: conges.mercredi,
        cp_jeudi: conges.jeudi,
        cp_vendredi: conges.vendredi,
        type_conge: conges.type_conge,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointage-semaine'] });
      toast.success('Pointage enregistré');
    },
    onError: (error: any) => {
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

  // Navigation
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
  
  // Trouver le projet dans projetsDisponibles
  const projet = projetsDisponibles.find((p: any) => p.id?.toString() === selectedProjetId);
  
  if (!projet) {
    toast.error('Projet non trouvé');
    return;
  }
  
  console.log('Ajout projet:', projet);
  
  setLignes([...lignes, {
    projet_id: selectedProjetId,
    projet,
    heures: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0, samedi: 0, dimanche: 0 },
    isNew: true,
  }]);
  setShowAddProjet(false);
  setSelectedProjetId('');
};

  const removeLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const updateHeures = (index: number, jour: typeof JOURS[number], value: number) => {
    // Vérifier si c'est un jour de congé
    if (JOURS_OUVRABLES.includes(jour as any) && conges[jour as keyof CongesState] === true) {
      toast.error('Ce jour est marqué comme congé');
      return;
    }
    
    const newLignes = [...lignes];
    newLignes[index].heures[jour] = Math.max(0, Math.min(24, value));
    setLignes(newLignes);
  };

  const toggleConge = (jour: typeof JOURS_OUVRABLES[number]) => {
    // Vérifier si des heures sont pointées ce jour
    const heuresJour = lignes.reduce((sum, l) => sum + (l.heures[jour] || 0), 0);
    if (heuresJour > 0 && !conges[jour]) {
      toast.error('Supprimez d\'abord les heures pointées ce jour');
      return;
    }
    setConges({ ...conges, [jour]: !conges[jour] });
  };

  // Calculs
  const calculs = useMemo(() => {
    // Heures travaillées par jour
    const heuresParJour = JOURS.reduce((acc, jour) => {
      acc[jour] = lignes.reduce((sum, l) => sum + (l.heures[jour] || 0), 0);
      return acc;
    }, {} as Record<string, number>);

    // Total heures travaillées
    const heuresTravaillees = Object.values(heuresParJour).reduce((sum, h) => sum + h, 0);

    // Jours de congé
    const joursCP = JOURS_OUVRABLES.filter(j => conges[j]).length;
    const heuresCP = joursCP * HEURES_CP_PAR_JOUR;

    //jour de maladie non payé
    const joursMaladie = JOURS_OUVRABLES.filter(j => conges[j]).length;
    const heuresMaladie = joursMaladie * HEURES_OTHER_PAR_JOUR;

    // Total semaine (travail + CP)
    const totalSemaine = heuresTravaillees + heuresCP;

    // Heures normales, sup, dues
    const heuresNormales = Math.min(totalSemaine, HEURES_SEMAINE_NORMALE);
    const heuresSup = Math.max(0, totalSemaine - HEURES_SEMAINE_NORMALE);
    const heuresDues = Math.max(0, HEURES_SEMAINE_NORMALE - totalSemaine);

    return {
      heuresParJour,
      heuresTravaillees,
      joursCP,
      heuresCP,
      joursMaladie,
      heuresMaladie,
      totalSemaine,
      heuresNormales,
      heuresSup,
      heuresDues,
    };
  }, [lignes, conges]);

  // Status de la semaine
  const validationStatus = semaineData?.validation?.status || 'Brouillon';
  const isLocked = validationStatus === 'Valide' || validationStatus === 'Soumis';

  // Projets disponibles pour ajout (pas encore dans les lignes)
  const projetsNonAjoutes = projetsDisponibles.filter(
    (p: any) => !lignes.some(l => l.projet_id === p.id?.toString())
  );

  if (projetsLoading || semaineLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pointage hebdomadaire</h1>
          <p className="text-gray-500">Saisissez vos heures par projet</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={
            validationStatus === 'Valide' ? 'success' :
            validationStatus === 'Soumis' ? 'info' :
            validationStatus === 'Rejete' ? 'danger' : 'default'
          }>
            {validationStatus}
          </Badge>
        </div>
      </div>

      {/* Sélecteur de semaine */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Select
                value={semaine}
                onChange={(e) => setSemaine(Number(e.target.value))}
                options={getWeeksOfYear(annee)}
                className="w-40"
              />
              <Select
                value={annee}
                onChange={(e) => setAnnee(Number(e.target.value))}
                options={getYears()}
                className="w-24"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              <Calendar className="w-4 h-4" />
              Semaine actuelle
            </Button>
          </div>
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">
          {formatWeekLabel(annee, semaine)}
        </p>
      </Card>

      {/* Tableau de pointage */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-64">
                  Projet / Tâche
                </th>
                {JOURS.map((jour, index) => {
                  const date = joursSemaine[index];
                  const jourFerie = joursFeries.find(jf => 
                    formatDate(jf.date, 'yyyy-MM-dd') === formatDate(date, 'yyyy-MM-dd')
                  );
                  const isWeekend = index >= 5;
                  const isCP = JOURS_OUVRABLES.includes(jour as any) && conges[jour as keyof CongesState];

                  return (
                    <th 
                      key={jour} 
                      className={clsx(
                        'px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20',
                        isWeekend ? 'bg-gray-100 text-gray-400' : '',
                        jourFerie ? 'bg-red-50 text-red-600' : '',
                        isCP ? 'bg-amber-50 text-amber-600' : 'text-gray-600'
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
              {/* Ligne Congés */}
              <tr className="bg-amber-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-700">Congés payés</span>
                  </div>
                  <Select
                    value={conges.type_conge}
                    onChange={(e) => setConges({ ...conges, type_conge: e.target.value as CongeType })}
                    options={[
                      { value: 'CP', label: 'Congé payé' },
                      { value: 'RTT', label: 'RTT' },
                      { value: 'Maladie', label: 'Maladie' },
                      { value: 'Sans_solde', label: 'Sans solde' },
                      { value: 'Autre', label: 'Autre' },
                    ]}
                    className="mt-1 text-xs"
                    disabled={isLocked}
                  />
                </td>
                {JOURS.map((jour, index) => {
                  const isOuvrable = JOURS_OUVRABLES.includes(jour as any);
                  const isChecked = isOuvrable && conges[jour as keyof CongesState];
                  
                  return (
                    <td key={jour} className="px-2 py-3 text-center">
                      {isOuvrable ? (
                        <label className="flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked as boolean}
                            onChange={() => toggleConge(jour as typeof JOURS_OUVRABLES[number])}
                            disabled={isLocked}
                            className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                        </label>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-semibold text-amber-700">
                  {calculs.heuresCP}h
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
                    <div className="text-xs text-gray-500">
                      {ligne.projet?.code_projet}
                    </div>
                  </td>
                  {JOURS.map((jour, jourIndex) => {
                    const isWeekend = jourIndex >= 5;
                    const isCP = JOURS_OUVRABLES.includes(jour as any) && conges[jour as keyof CongesState];
                    const jourFerie = joursFeries.find(jf => 
                      formatDate(jf.date, 'yyyy-MM-dd') === formatDate(joursSemaine[jourIndex], 'yyyy-MM-dd')
                    );
                    
                    return (
                      <td key={jour} className={clsx(
                        'px-2 py-3 text-center',
                        isWeekend && 'bg-gray-50',
                        isCP && 'bg-amber-50',
                        jourFerie && 'bg-red-50'
                      )}>
                        <input
                          type="number"
                          value={ligne.heures[jour] || ''}
                          onChange={(e) => updateHeures(index, jour, parseFloat(e.target.value) || 0)}
                          disabled={isLocked || isCP || !!jourFerie}
                          min="0"
                          max="24"
                          step="0.5"
                          className={clsx(
                            'w-14 px-2 py-1 text-center rounded border text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500',
                            isLocked || isCP || jourFerie
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                              : 'border-gray-300 hover:border-gray-400'
                          )}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-semibold">
                    {Object.values(ligne.heures).reduce((s, h) => s + h, 0)}h
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Heures travaillées</div>
          <div className="text-2xl font-bold text-gray-900">{calculs.heuresTravaillees}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Heures Maladie ({calculs.joursCP}j)</div>
          <div className="text-2xl font-bold text-amber-600">{calculs.heuresMaladie}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Heures CP ({calculs.joursMaladie}j)</div>
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
            -{calculs.heuresDues}h
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
        onClose={() => setShowAddProjet(false)}
        title="Ajouter un projet"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Projet"
            value={selectedProjetId}
            onChange={(e) => setSelectedProjetId(e.target.value)}
            options={[
              { value: '', label: 'Sélectionner un projet' },
              ...projetsNonAjoutes.map((p: any) => ({
                value: p.id?.toString(),
                label: `${p.code_projet} - ${p.nom}`,
              })),
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddProjet(false)}>
              Annuler
            </Button>
            <Button onClick={addLigne} disabled={!selectedProjetId}>
              Ajouter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
