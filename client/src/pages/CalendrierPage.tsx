import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { pointagesApi, salariesApi } from '@/services/api';
import { Card, Spinner } from '@/components/ui';
import { getWeek, getYear, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { SalariePointage, Salarie } from '@/types';

// Générer une couleur unique pour chaque salarié basée sur son ID
const getColorForSalarie = (salarieId: string): string => {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-300',
    'bg-green-100 text-green-800 border-green-300',
    'bg-purple-100 text-purple-800 border-purple-300',
    'bg-pink-100 text-pink-800 border-pink-300',
    'bg-yellow-100 text-yellow-800 border-yellow-300',
    'bg-indigo-100 text-indigo-800 border-indigo-300',
    'bg-red-100 text-red-800 border-red-300',
    'bg-teal-100 text-teal-800 border-teal-300',
    'bg-orange-100 text-orange-800 border-orange-300',
    'bg-cyan-100 text-cyan-800 border-cyan-300',
    'bg-lime-100 text-lime-800 border-lime-300',
    'bg-rose-100 text-rose-800 border-rose-300',
  ];
  
  // Utiliser l'ID pour sélectionner une couleur de manière cohérente
  const index = parseInt(salarieId.slice(-2), 16) % colors.length;
  return colors[index];
};

export const CalendrierPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Calculer les semaines du mois
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Récupérer tous les salariés actifs
  const { data: salaries = [], isLoading: isLoadingSalaries } = useQuery({
    queryKey: ['salaries-actifs'],
    queryFn: () => salariesApi.getAll({ actif: true }),
  });
  
  // Créer un map pour accéder rapidement aux salariés par ID
  const salariesMap = useMemo(() => {
    const map = new Map<string, Salarie>();
    salaries.forEach((s: Salarie) => {
      map.set(s.id, s);
    });
    return map;
  }, [salaries]);
  
  // Générer les jours du calendrier (toutes les semaines qui touchent le mois)
  const calendarDays = useMemo(() => {
    const firstDay = startOfWeek(monthStart, { weekStartsOn: 1 });
    const lastDay = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: firstDay, end: lastDay });
  }, [monthStart, monthEnd]);
  
  // Organiser les jours en semaines
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);
  
  // Récupérer toutes les semaines uniques du calendrier
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
  
  // Récupérer tous les pointages du mois
  const { data: pointages = [], isLoading: isLoadingPointages } = useQuery({
    queryKey: ['pointages-mois', currentYear, currentMonth],
    queryFn: async () => {
      // Récupérer les pointages pour toutes les semaines du calendrier
      const allPointages: SalariePointage[] = [];
      
      for (const { year, week } of uniqueWeeks) {
        try {
          const pointagesSemaine = await pointagesApi.getAll({
            annee: year,
            semaine: week,
          });
          allPointages.push(...pointagesSemaine);
        } catch (error) {
          console.error(`Erreur récupération pointages semaine ${week}/${year}:`, error);
        }
      }
      
      return allPointages;
    },
    enabled: uniqueWeeks.length > 0,
  });
  
  // Organiser les pointages par jour
  const pointagesByDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // date -> salarieId -> heures
    
    pointages.forEach((pointage: SalariePointage) => {
      const salarieId = pointage.salarie_id || '';
      
      // Pour chaque jour de la semaine du pointage
      const jours = [
        { key: 'lundi', date: pointage.date_lundi, heures: pointage.heure_lundi || 0 },
        { key: 'mardi', date: '', heures: pointage.heure_mardi || 0 },
        { key: 'mercredi', date: '', heures: pointage.heure_mercredi || 0 },
        { key: 'jeudi', date: '', heures: pointage.heure_jeudi || 0 },
        { key: 'vendredi', date: '', heures: pointage.heure_vendredi || 0 },
        { key: 'samedi', date: '', heures: pointage.heure_samedi || 0 },
        { key: 'dimanche', date: '', heures: pointage.heure_dimanche || 0 },
      ];
      
      // Calculer les dates de chaque jour à partir du lundi
      if (pointage.date_lundi) {
        const lundi = parseISO(pointage.date_lundi);
        jours.forEach((jour, index) => {
          const date = addDays(lundi, index);
          const dateKey = format(date, 'yyyy-MM-dd');
          
          if (jour.heures > 0) {
            if (!map.has(dateKey)) {
              map.set(dateKey, new Map());
            }
            
            const dayMap = map.get(dateKey)!;
            const currentHeures = dayMap.get(salarieId) || 0;
            dayMap.set(salarieId, currentHeures + jour.heures);
          }
        });
      }
    });
    
    return map;
  }, [pointages]);
  
  // Obtenir les salariés qui ont pointé un jour donné
  const getPointagesForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayPointages = pointagesByDay.get(dateKey);
    if (!dayPointages) return [];
    
    const result: Array<{ salarie: Salarie; heures: number }> = [];
    
    dayPointages.forEach((heures, salarieId) => {
      const salarie = salariesMap.get(salarieId);
      if (salarie && heures > 0) {
        result.push({ salarie, heures });
      }
    });
    
    return result;
  };
  
  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const isLoading = isLoadingSalaries || isLoadingPointages;
  
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendrier des pointages</h1>
          <p className="text-gray-500 mt-1">Vue calendrier mensuelle avec pointages par jour</p>
        </div>
        <div className="flex items-center gap-3">
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
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner />
        </div>
      ) : (
        <Card className="overflow-hidden">
          {/* En-tête des jours de la semaine */}
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
              Sem.
            </div>
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour) => (
              <div
                key={jour}
                className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r last:border-r-0"
              >
                {jour}
              </div>
            ))}
          </div>
          
          {/* Grille du calendrier */}
          <div className="grid grid-cols-8 divide-x divide-y divide-gray-200">
            {calendarWeeks.map((week, weekIndex) => {
              const weekNumber = getWeek(week[0], { weekStartsOn: 1, locale: fr });
              const weekYear = getYear(week[0]);
              
              return (
                <>
                  {/* Colonne numéro de semaine */}
                  <div
                    key={`week-${weekIndex}`}
                    className="min-h-[120px] p-2 bg-gray-50 border-r flex items-start justify-center"
                  >
                    <div className="text-sm font-semibold text-gray-700">
                      S{weekNumber}
                    </div>
                  </div>
                  
                  {/* Jours de la semaine */}
                  {week.map((day, dayIndex) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    const pointagesJour = getPointagesForDay(day);
                    
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={clsx(
                          'min-h-[120px] p-2 bg-white',
                          !isCurrentMonth && 'bg-gray-50',
                          isToday && 'bg-blue-50 border-2 border-blue-400'
                        )}
                      >
                        {/* Numéro du jour */}
                        <div
                          className={clsx(
                            'text-sm font-medium mb-1',
                            isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                            isToday && 'text-blue-600 font-bold'
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                        
                        {/* Liste des personnes qui ont pointé */}
                        <div className="space-y-1">
                          {pointagesJour.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">Aucun pointage</div>
                          ) : (
                            pointagesJour.map(({ salarie, heures }) => {
                              const colorClass = getColorForSalarie(salarie.id);
                              return (
                                <div
                                  key={salarie.id}
                                  className={clsx(
                                    'px-1.5 py-0.5 rounded text-xs font-medium truncate',
                                    colorClass
                                  )}
                                  title={`${salarie.prenom} ${salarie.nom} - ${heures}h`}
                                >
                                  <span className="font-semibold">
                                    {salarie.prenom.charAt(0)}.{salarie.nom}
                                  </span>
                                  <span className="ml-1 opacity-75">{heures}h</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
