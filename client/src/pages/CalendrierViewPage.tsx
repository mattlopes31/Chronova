import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Filter,
  Download,
} from 'lucide-react';
import { pointagesApi, salariesApi, congesApi } from '@/services/api';
import { Card, Spinner, Select, Badge, Button } from '@/components/ui';
import { 
  getWeek, 
  getYear, 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths, 
  eachDayOfInterval, 
  isSameMonth,
  addDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMondayOfWeek } from '@/utils/dates';
import type { SalariePointage, Salarie, SalarieCp, ValidationSemaine } from '@/types';

const HEURES_SEMAINE_NORMALE = 35;
const HEURES_CP_PAR_JOUR = 7;
const MAX_HEURES_DECLAREES = 45; // Maximum d'heures déclarées par semaine

interface SemaineData {
  year: number;
  week: number;
  salarie: Salarie;
  pointages: SalariePointage[];
  conges: SalarieCp | null;
  validation: ValidationSemaine | null;
  joursFeries: any[];
}

export const CalendrierViewPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSalarie, setSelectedSalarie] = useState<string>('');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Récupérer tous les salariés actifs
  const { data: salaries = [], isLoading: isLoadingSalaries } = useQuery({
    queryKey: ['salaries-actifs'],
    queryFn: () => salariesApi.getAll({ actif: true }),
  });

  // Calculer les semaines du mois
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const firstDay = startOfWeek(monthStart, { weekStartsOn: 1 });
  const lastDay = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: firstDay, end: lastDay });

  // Extraire les semaines uniques
  const uniqueWeeks = useMemo(() => {
    const weekSet = new Set<string>();
    calendarDays.forEach((day) => {
      const week = getWeek(day, { weekStartsOn: 1, locale: fr });
      const year = getYear(day);
      weekSet.add(`${year}-${week}`);
    });
    return Array.from(weekSet).map((key) => {
      const [year, week] = key.split('-').map(Number);
      return { year, week };
    });
  }, [calendarDays]);

  // Récupérer les données pour chaque semaine du salarié sélectionné
  const { data: semainesData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['calendrier-view', currentYear, currentMonth, selectedSalarie, uniqueWeeks],
    queryFn: async () => {
      if (!selectedSalarie) return [];
      
      const allData: SemaineData[] = [];
      const salarie = salaries.find((s: Salarie) => s.id === selectedSalarie);
      
      if (!salarie) return [];

      for (const { year, week } of uniqueWeeks) {
        try {
          // Récupérer les pointages de la semaine
          const pointages = await pointagesApi.getAll({
            salarie_id: salarie.id,
            annee: year,
            semaine: week,
          });

          // Récupérer les congés
          const congesListe = await congesApi.getAll({ 
            salarie_id: salarie.id,
            annee: year,
          });
          const conges = congesListe.find((c: SalarieCp) => c.semaine === week) || null;

          // Récupérer la validation
          const validation = null; // À implémenter si nécessaire

          // Récupérer les jours fériés
          const joursFeries: any[] = []; // À récupérer si nécessaire

          allData.push({
            year,
            week,
            salarie,
            pointages: pointages || [],
            conges,
            validation,
            joursFeries,
          });
        } catch (error) {
          console.error(`Erreur récupération données semaine ${week}/${year} pour ${salarie.nom}:`, error);
        }
      }

      return allData;
    },
    enabled: uniqueWeeks.length > 0 && selectedSalarie !== '',
  });

  // Calculer les données pour une semaine
  const calculateWeekData = (data: SemaineData) => {
    const { pointages, conges } = data;

    // Calculer les heures par jour
    const heuresParJour = {
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
    };

    pointages.forEach((p: SalariePointage) => {
      heuresParJour.lundi += Number(p.heure_lundi || 0);
      heuresParJour.mardi += Number(p.heure_mardi || 0);
      heuresParJour.mercredi += Number(p.heure_mercredi || 0);
      heuresParJour.jeudi += Number(p.heure_jeudi || 0);
      heuresParJour.vendredi += Number(p.heure_vendredi || 0);
      heuresParJour.samedi += Number(p.heure_samedi || 0);
      heuresParJour.dimanche += Number(p.heure_dimanche || 0);
    });

    // Total heures travaillées
    const heuresTravaillees = Object.values(heuresParJour).reduce((sum, h) => sum + h, 0);

    // Calculer les congés
    let joursCP = 0;
    let joursMaladie = 0;
    
    if (conges) {
      // Vérifier chaque jour avec son type spécifique si disponible
      const typeLundi = (conges as any).type_lundi || conges.type_conge;
      const typeMardi = (conges as any).type_mardi || conges.type_conge;
      const typeMercredi = (conges as any).type_mercredi || conges.type_conge;
      const typeJeudi = (conges as any).type_jeudi || conges.type_conge;
      const typeVendredi = (conges as any).type_vendredi || conges.type_conge;

      if (conges.cp_lundi) {
        if (typeLundi === 'CP') joursCP++;
        if (typeLundi === 'Maladie') joursMaladie++;
      }
      if (conges.cp_mardi) {
        if (typeMardi === 'CP') joursCP++;
        if (typeMardi === 'Maladie') joursMaladie++;
      }
      if (conges.cp_mercredi) {
        if (typeMercredi === 'CP') joursCP++;
        if (typeMercredi === 'Maladie') joursMaladie++;
      }
      if (conges.cp_jeudi) {
        if (typeJeudi === 'CP') joursCP++;
        if (typeJeudi === 'Maladie') joursMaladie++;
      }
      if (conges.cp_vendredi) {
        if (typeVendredi === 'CP') joursCP++;
        if (typeVendredi === 'Maladie') joursMaladie++;
      }
    }

    const heuresCP = joursCP * HEURES_CP_PAR_JOUR;
    const heuresMaladie = joursMaladie * HEURES_CP_PAR_JOUR;

    // Total semaine = heures travaillées + CP
    const totalSemaine = heuresTravaillees + heuresCP;

    // Heures normales (max 35h par semaine)
    const heuresNormales = Math.min(totalSemaine, HEURES_SEMAINE_NORMALE);

    // Heures supplémentaires (au-delà de 35h)
    const heuresSup = Math.max(0, totalSemaine - HEURES_SEMAINE_NORMALE);

    // Heures dues (si moins de 35h)
    const heuresDues = Math.max(0, HEURES_SEMAINE_NORMALE - totalSemaine) + heuresMaladie;

    // Heures déclarées (limitées à MAX_HEURES_DECLAREES)
    const heuresDeclarees = Math.min(totalSemaine, MAX_HEURES_DECLAREES);

    // Solde à déclarer (différence entre total et heures déclarées)
    const soldeADeclarer = totalSemaine - heuresDeclarees;

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
      heuresDeclarees,
      soldeADeclarer,
    };
  };

  // Trier les semaines par ordre chronologique
  const semainesTriees = useMemo(() => {
    return [...semainesData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });
  }, [semainesData]);

  // Calculer les totaux du mois
  const totalsMois = useMemo(() => {
    return semainesTriees.reduce((acc, semaineData) => {
      const calculs = calculateWeekData(semaineData);
      return {
        totalHeures: acc.totalHeures + calculs.heuresTravaillees,
        totalCP: acc.totalCP + calculs.heuresCP,
        totalMaladie: acc.totalMaladie + calculs.heuresMaladie,
        totalSup: acc.totalSup + calculs.heuresSup,
        totalDues: acc.totalDues + calculs.heuresDues,
        totalDeclarees: acc.totalDeclarees + calculs.heuresDeclarees,
      };
    }, {
      totalHeures: 0,
      totalCP: 0,
      totalMaladie: 0,
      totalSup: 0,
      totalDues: 0,
      totalDeclarees: 0,
    });
  }, [semainesTriees]);

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (isLoadingSalaries || isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const selectedSalarieData = salaries.find((s: Salarie) => s.id === selectedSalarie);

  return (
    <div className="space-y-6">
      {/* En-tête amélioré */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vue Calendrier</h1>
            <p className="text-gray-600 mt-1">Consultez les pointages détaillés par semaine</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'cards' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              <Calendar className="w-4 h-4" />
              Cartes
            </Button>
            <Button
              variant={viewMode === 'table' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <Filter className="w-4 h-4" />
              Tableau
            </Button>
          </div>
        </div>

        {/* Contrôles de navigation améliorés */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                <Select
                  value={selectedSalarie}
                  onChange={(e) => {
                    setSelectedSalarie(e.target.value);
                    setExpandedWeek(null);
                  }}
                  options={[
                    { value: '', label: 'Tous les salariés' },
                    ...salaries.map((s: Salarie) => ({
                      value: s.id,
                      label: `${s.prenom} ${s.nom}`,
                    })),
                  ]}
                  className="w-64"
                />
              </div>
              {selectedSalarieData && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary-700">
                      {selectedSalarieData.prenom?.[0]}{selectedSalarieData.nom?.[0]}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedSalarieData.prenom} {selectedSalarieData.nom}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                title="Mois précédent"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
                <span className="font-semibold text-gray-900 min-w-[140px] text-center">
                  {format(currentDate, 'MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                title="Mois suivant"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Aujourd'hui
              </Button>
            </div>
          </div>
        </Card>

        {/* Résumé du mois */}
        {selectedSalarie && semainesTriees.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Heures totales</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{totalsMois.totalHeures.toFixed(1)}h</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500">Heures sup</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{totalsMois.totalSup.toFixed(1)}h</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500">Heures dues</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{totalsMois.totalDues.toFixed(1)}h</div>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-gray-500">Congés payés</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">{totalsMois.totalCP.toFixed(1)}h</div>
            </Card>
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500">Maladie</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{totalsMois.totalMaladie.toFixed(1)}h</div>
            </Card>
            <Card className="p-4 bg-indigo-50 border-indigo-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-indigo-600" />
                <span className="text-xs text-gray-500">Déclarées</span>
              </div>
              <div className="text-2xl font-bold text-indigo-600">{totalsMois.totalDeclarees.toFixed(1)}h</div>
            </Card>
          </div>
        )}
      </div>

      {/* Vue des semaines */}
      {!selectedSalarie ? (
        <Card className="p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg text-gray-500 mb-2">Sélectionnez un salarié</p>
          <p className="text-sm text-gray-400">Choisissez un salarié dans le menu déroulant pour afficher ses pointages</p>
        </Card>
      ) : semainesTriees.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg text-gray-500 mb-2">Aucune donnée disponible</p>
          <p className="text-sm text-gray-400">Aucun pointage trouvé pour ce mois</p>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {semainesTriees.map((semaineData) => {
            const calculs = calculateWeekData(semaineData);
            const { year, week, salarie } = semaineData;
            const monday = getMondayOfWeek(year, week);
            const sunday = addDays(monday, 6);
            const weekKey = `${year}-${week}`;
            const isExpanded = expandedWeek === weekKey;
            const hasIssues = calculs.heuresDues > 0 || calculs.soldeADeclarer > 0;

            return (
              <Card
                key={weekKey}
                className={clsx(
                  'p-5 transition-all hover:shadow-lg cursor-pointer',
                  isExpanded && 'ring-2 ring-primary-500',
                  hasIssues && 'border-l-4 border-l-amber-400'
                )}
                onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
              >
                {/* En-tête de la semaine */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-700">S{week}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Semaine {week} - {year}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {format(monday, 'dd MMM', { locale: fr })} - {format(sunday, 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {calculs.heuresDues > 0 && (
                      <Badge variant="danger" className="text-xs">
                        <AlertCircle className="w-3 h-3" />
                        {calculs.heuresDues.toFixed(1)}h dues
                      </Badge>
                    )}
                    {calculs.heuresSup > 0 && (
                      <Badge variant="success" className="text-xs">
                        <TrendingUp className="w-3 h-3" />
                        +{calculs.heuresSup.toFixed(1)}h
                      </Badge>
                    )}
                    {semaineData.validation?.status === 'Valide' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {semaineData.validation?.status === 'Soumis' && (
                      <Clock className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                </div>

                {/* Résumé principal */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Total</div>
                    <div className="text-xl font-bold text-blue-700">{calculs.totalSemaine.toFixed(1)}h</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Normales</div>
                    <div className="text-xl font-bold text-green-700">{calculs.heuresNormales.toFixed(1)}h</div>
                  </div>
                  <div className="text-center p-3 bg-indigo-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Déclarées</div>
                    <div className="text-xl font-bold text-indigo-700">{calculs.heuresDeclarees.toFixed(1)}h</div>
                  </div>
                </div>

                {/* Détails des jours (toujours visibles) */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((jour, idx) => {
                    const heures = Object.values(calculs.heuresParJour)[idx];
                    return (
                      <div key={jour} className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{jour}</div>
                        <div className={clsx(
                          'text-sm font-semibold p-2 rounded',
                          heures > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-400'
                        )}>
                          {heures.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Détails expandables */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 transition-all duration-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Congés payés</div>
                        <div className="text-lg font-semibold text-amber-700">
                          {calculs.joursCP > 0 ? `${calculs.joursCP}j (${calculs.heuresCP}h)` : '0'}
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Maladie</div>
                        <div className="text-lg font-semibold text-blue-700">
                          {calculs.joursMaladie > 0 ? `${calculs.joursMaladie}j (${calculs.heuresMaladie}h)` : '0'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Heures dues</div>
                        <div className="text-lg font-semibold text-red-700">
                          {calculs.heuresDues > 0 ? `-${calculs.heuresDues.toFixed(1)}h` : '0h'}
                        </div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Solde à déclarer</div>
                        <div className={clsx(
                          'text-lg font-semibold',
                          calculs.soldeADeclarer > 0 ? 'text-orange-700' : 'text-gray-600'
                        )}>
                          {calculs.soldeADeclarer > 0 ? `+${calculs.soldeADeclarer.toFixed(1)}h` : '0h'}
                        </div>
                      </div>
                    </div>
                    {semaineData.validation && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Statut</div>
                        <Badge variant={
                          semaineData.validation.status === 'Valide' ? 'success' :
                          semaineData.validation.status === 'Soumis' ? 'info' :
                          semaineData.validation.status === 'Rejete' ? 'danger' : 'default'
                        }>
                          {semaineData.validation.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Indicateur d'expansion */}
                <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                  <span className="text-xs text-gray-400">
                    {isExpanded ? 'Cliquer pour réduire' : 'Cliquer pour voir les détails'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r">Semaine</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">L</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">M</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">M</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">J</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">V</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">S</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 border-r">D</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Normales</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Sup</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">CP</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Maladie</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Dues</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-blue-50 border-r">Déclarées</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {semainesTriees.map((semaineData) => {
                  const calculs = calculateWeekData(semaineData);
                  const { year, week } = semaineData;
                  const monday = getMondayOfWeek(year, week);
                  const sunday = addDays(monday, 6);

                  return (
                    <tr key={`${year}-${week}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-r">
                        <div className="font-medium text-gray-900">S{week}</div>
                        <div className="text-xs text-gray-500">
                          {format(monday, 'dd/MM', { locale: fr })} - {format(sunday, 'dd/MM', { locale: fr })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.lundi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.mardi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.mercredi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.jeudi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.vendredi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.samedi.toFixed(1) || '0'}</td>
                      <td className="px-3 py-3 text-center border-r">{calculs.heuresParJour.dimanche.toFixed(1) || '0'}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.totalSemaine.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.heuresNormales.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.heuresSup.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right border-r">
                        {calculs.joursCP > 0 ? `${calculs.joursCP}j` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right border-r">
                        {calculs.joursMaladie > 0 ? `${calculs.joursMaladie}j` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium border-r">
                        <span className={calculs.heuresDues > 0 ? 'text-red-600' : 'text-gray-600'}>
                          {calculs.heuresDues > 0 ? `-${calculs.heuresDues.toFixed(1)}` : '0'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium bg-blue-50 text-blue-700 border-r">
                        {calculs.heuresDeclarees.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={calculs.soldeADeclarer > 0 ? 'text-orange-600' : 'text-gray-600'}>
                          {calculs.soldeADeclarer > 0 ? `+${calculs.soldeADeclarer.toFixed(1)}` : '0'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
