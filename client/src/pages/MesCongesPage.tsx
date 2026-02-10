import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Calendar,
  Filter,
  Plane,
  Stethoscope,
  Umbrella,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { congesApi } from '@/services/api';
import { Card, Badge, Select, Spinner } from '@/components/ui';
import { formatDate, getMondayOfWeek } from '@/utils/dates';
import type { CongeType, SalarieCp } from '@/types';

const HEURES_PAR_JOUR = 7;

// Configuration des types d'absence
const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  CP: { label: 'Congé Payé', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Umbrella },
  Maladie: { label: 'Maladie', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Stethoscope },
  Deplacement: { label: 'Déplacement', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Plane },
  Sans_solde: { label: 'Sans solde', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Calendar },
  Autre: { label: 'Autre', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Calendar },
};

const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

export const MesCongesPage = () => {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();
  
  // Filtres
  const [annee, setAnnee] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Récupérer tous les congés
  const { data: conges = [], isLoading } = useQuery({
    queryKey: ['mes-conges', annee],
    queryFn: () => congesApi.getAll({ annee }),
  });

  // Transformer les données pour l'affichage
  const absencesHistorique = useMemo(() => {
    const absences: Array<{
      id: string;
      annee: number;
      semaine: number;
      type: CongeType;
      jours: string[];
      nbJours: number;
      dateDebut: Date;
      dateFin: Date;
    }> = [];

    conges.forEach((conge: SalarieCp) => {
      const monday = getMondayOfWeek(conge.annee, conge.semaine);
      const joursAbsence: string[] = [];
      
      if (conge.cp_lundi) joursAbsence.push('Lundi');
      if (conge.cp_mardi) joursAbsence.push('Mardi');
      if (conge.cp_mercredi) joursAbsence.push('Mercredi');
      if (conge.cp_jeudi) joursAbsence.push('Jeudi');
      if (conge.cp_vendredi) joursAbsence.push('Vendredi');

      if (joursAbsence.length > 0) {
        // Calculer les dates de début et fin
        const jourIndices = {
          'Lundi': 0, 'Mardi': 1, 'Mercredi': 2, 'Jeudi': 3, 'Vendredi': 4
        };
        const premierJour = Math.min(...joursAbsence.map(j => jourIndices[j as keyof typeof jourIndices]));
        const dernierJour = Math.max(...joursAbsence.map(j => jourIndices[j as keyof typeof jourIndices]));
        
        const dateDebut = new Date(monday);
        dateDebut.setDate(dateDebut.getDate() + premierJour);
        
        const dateFin = new Date(monday);
        dateFin.setDate(dateFin.getDate() + dernierJour);

        absences.push({
          id: conge.id,
          annee: conge.annee,
          semaine: conge.semaine,
          type: conge.type_conge,
          jours: joursAbsence,
          nbJours: joursAbsence.length,
          dateDebut,
          dateFin,
        });
      }
    });

    // Trier par date décroissante
    return absences.sort((a, b) => {
      if (a.annee !== b.annee) return b.annee - a.annee;
      return b.semaine - a.semaine;
    });
  }, [conges]);

  // Filtrer par type
  const absencesFiltrees = useMemo(() => {
    if (!typeFilter) return absencesHistorique;
    return absencesHistorique.filter(a => a.type === typeFilter);
  }, [absencesHistorique, typeFilter]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    const result: Record<string, { jours: number; heures: number }> = {
      CP: { jours: 0, heures: 0 },
      Maladie: { jours: 0, heures: 0 },
      Deplacement: { jours: 0, heures: 0 },
      Sans_solde: { jours: 0, heures: 0 },
      Autre: { jours: 0, heures: 0 },
    };

    absencesHistorique.forEach(absence => {
      if (result[absence.type]) {
        result[absence.type].jours += absence.nbJours;
        result[absence.type].heures += absence.nbJours * HEURES_PAR_JOUR;
      }
    });

    return result;
  }, [absencesHistorique]);

  // Total général
  const totalJours = Object.values(stats).reduce((sum, s) => sum + s.jours, 0);
  const totalHeures = totalJours * HEURES_PAR_JOUR;

  // Toggle détails ligne
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Années disponibles
  const annees = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Absences</h1>
          <p className="text-gray-600">Historique de vos congés, maladies et déplacements</p>
        </div>
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtres :</span>
          </div>
          
          <Select
            value={annee.toString()}
            onChange={(e) => setAnnee(parseInt(e.target.value))}
            options={annees.map(y => ({ value: y.toString(), label: y.toString() }))}
            className="w-28"
          />

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: '', label: 'Tous les types' },
              { value: 'CP', label: '🏖️ Congé Payé' },
              { value: 'Maladie', label: '🏥 Maladie' },
              { value: 'Deplacement', label: '✈️ Déplacement' },
              { value: 'Sans_solde', label: '📋 Sans solde' },
            ]}
            className="w-44"
          />

          <div className="ml-auto text-sm text-gray-500">
            {absencesFiltrees.length} absence(s) trouvée(s)
          </div>
        </div>
      </Card>

      {/* Cartes de résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* CP */}
        <Card className={clsx('p-4', stats.CP.jours > 0 && 'bg-amber-50 border-amber-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Umbrella className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-gray-600">Congés Payés</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{stats.CP.jours}j</div>
          <div className="text-xs text-gray-500">{stats.CP.heures}h</div>
        </Card>

        {/* Maladie */}
        <Card className={clsx('p-4', stats.Maladie.jours > 0 && 'bg-blue-50 border-blue-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Maladie</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.Maladie.jours}j</div>
          <div className="text-xs text-gray-500">{stats.Maladie.heures}h</div>
        </Card>

        {/* Déplacement */}
        <Card className={clsx('p-4', stats.Deplacement.jours > 0 && 'bg-purple-50 border-purple-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Plane className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Déplacements</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{stats.Deplacement.jours}j</div>
          <div className="text-xs text-gray-500">{stats.Deplacement.heures}h</div>
        </Card>

        {/* Sans solde */}
        <Card className={clsx('p-4', stats.Sans_solde.jours > 0 && 'bg-gray-100 border-gray-300')}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Sans solde</span>
          </div>
          <div className="text-2xl font-bold text-gray-600">{stats.Sans_solde.jours}j</div>
          <div className="text-xs text-gray-500">{stats.Sans_solde.heures}h</div>
        </Card>

        {/* Total */}
        <Card className="p-4 bg-gray-50 border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Total {annee}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalJours}j</div>
          <div className="text-xs text-gray-500">{totalHeures}h</div>
        </Card>
      </div>

      {/* Tableau historique */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="font-semibold text-gray-900">Historique des absences</h2>
        </div>
        
        {absencesFiltrees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune absence enregistrée pour {annee}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Période
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Durée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Semaine
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Jours
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {absencesFiltrees.map((absence) => {
                  const config = TYPE_CONFIG[absence.type] || TYPE_CONFIG.Autre;
                  const Icon = config.icon;
                  const isExpanded = expandedRows.has(absence.id);

                  return (
                    <>
                      <tr 
                        key={absence.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRow(absence.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {formatDate(absence.dateDebut, 'dd MMM')}
                            {absence.nbJours > 1 && (
                              <span> → {formatDate(absence.dateFin, 'dd MMM yyyy')}</span>
                            )}
                            {absence.nbJours === 1 && (
                              <span className="text-gray-500"> {absence.annee}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                              config.bgColor,
                              config.color
                            )}>
                              <Icon className="w-3.5 h-3.5" />
                              {config.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-gray-900">
                            {absence.nbJours} jour{absence.nbJours > 1 ? 's' : ''}
                          </span>
                          <div className="text-xs text-gray-500">
                            {absence.nbJours * HEURES_PAR_JOUR}h
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="gray">S{absence.semaine}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            {JOURS_SEMAINE.map((jour, index) => (
                              <span
                                key={jour}
                                className={clsx(
                                  'w-6 h-6 rounded text-[10px] font-medium flex items-center justify-center',
                                  absence.jours.includes(jour)
                                    ? `${config.bgColor} ${config.color}`
                                    : 'bg-gray-100 text-gray-400'
                                )}
                                title={jour}
                              >
                                {jour.charAt(0)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${absence.id}-details`} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Date début :</span>
                                <span className="ml-2 font-medium">
                                  {formatDate(absence.dateDebut, 'EEEE dd MMMM yyyy')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Date fin :</span>
                                <span className="ml-2 font-medium">
                                  {formatDate(absence.dateFin, 'EEEE dd MMMM yyyy')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Jours concernés :</span>
                                <span className="ml-2 font-medium">
                                  {absence.jours.join(', ')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Heures :</span>
                                <span className="ml-2 font-medium">
                                  {absence.nbJours * HEURES_PAR_JOUR}h
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Légende */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Légende des types d'absence</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TYPE_CONFIG).slice(0, 5).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <span
                key={key}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  config.bgColor,
                  config.color
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </span>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t text-sm text-gray-600">
          <p><strong>Note :</strong> Les absences de type "Maladie" génèrent des heures dues, tandis que les "Déplacements" comptent comme du temps travaillé.</p>
        </div>
      </Card>
    </div>
  );
};

export default MesCongesPage;