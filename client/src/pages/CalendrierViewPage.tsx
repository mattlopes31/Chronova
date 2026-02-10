import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { pointagesApi, salariesApi, congesApi } from '@/services/api';
import { Card, Spinner, Select } from '@/components/ui';
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

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier View</h1>
          <p className="text-gray-600">Vue détaillée des pointages par semaine et par salarié</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedSalarie}
            onChange={(e) => setSelectedSalarie(e.target.value)}
            options={[
              { value: '', label: 'Sélectionner un salarié' },
              ...salaries.map((s: Salarie) => ({
                value: s.id,
                label: `${s.prenom} ${s.nom}`,
              })),
            ]}
            className="w-48"
          />
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mois et année */}
      <div className="flex items-center gap-2 text-xl font-semibold text-gray-800">
        <Calendar className="w-6 h-6" />
        <span>{format(currentDate, 'MMMM yyyy', { locale: fr })}</span>
      </div>

      {/* Tableau des semaines */}
      {!selectedSalarie ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Sélectionnez un salarié pour afficher ses pointages</p>
        </Card>
      ) : semainesTriees.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Aucune donnée disponible pour ce mois</p>
        </Card>
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
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Total Heures normales</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Total Heures supplémentaires</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Total heure semaine</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">CP</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Maladie</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Total semaine</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r">Heures dues</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-blue-50 border-r">Heures déclarées</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Solde à déclarer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {semainesTriees.map((semaineData) => {
                  const calculs = calculateWeekData(semaineData);
                  const { year, week, salarie } = semaineData;
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
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.heuresNormales.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.heuresSup.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.totalSemaine.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right border-r">
                        {calculs.joursCP > 0 ? `${calculs.joursCP}j (${calculs.heuresCP}h)` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right border-r">
                        {calculs.joursMaladie > 0 ? `${calculs.joursMaladie}j (${calculs.heuresMaladie}h)` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium border-r">{calculs.totalSemaine.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium border-r">
                        <span className={calculs.heuresDues > 0 ? 'text-red-600' : 'text-gray-600'}>
                          {calculs.heuresDues > 0 ? `-${calculs.heuresDues.toFixed(1)}` : '0'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium bg-blue-50 text-blue-700 border-r">
                        {calculs.heuresDeclarees.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={calculs.soldeADeclarer > 0 ? 'text-orange-600' : calculs.soldeADeclarer < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {calculs.soldeADeclarer > 0 ? `+${calculs.soldeADeclarer.toFixed(1)}` : calculs.soldeADeclarer < 0 ? calculs.soldeADeclarer.toFixed(1) : '0'}
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
