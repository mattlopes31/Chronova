import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getWeek,
  getYear,
  eachDayOfInterval,
  parseISO,
  addDays,
  setWeek,
  setYear,
  isWeekend,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// Obtenir le lundi d'une semaine donnée
export const getMondayOfWeek = (year: number, week: number): Date => {
  // Créer une date dans l'année souhaitée
  let date = new Date(year, 0, 4); // 4 janvier est toujours en semaine 1
  date = setYear(date, year);
  date = setWeek(date, week, { weekStartsOn: 1, locale: fr });
  return startOfWeek(date, { weekStartsOn: 1 });
};

// Obtenir les jours de la semaine (lundi à dimanche)
export const getWeekDays = (year: number, week: number): Date[] => {
  const monday = getMondayOfWeek(year, week);
  return eachDayOfInterval({
    start: monday,
    end: addDays(monday, 6),
  });
};

// Obtenir semaine et année actuelles
export const getCurrentWeek = (): { year: number; week: number } => {
  const now = new Date();
  return {
    year: getYear(now),
    week: getWeek(now, { weekStartsOn: 1, locale: fr }),
  };
};

// Navigation entre semaines
export const getNextWeek = (year: number, week: number): { year: number; week: number } => {
  const monday = getMondayOfWeek(year, week);
  const nextMonday = addWeeks(monday, 1);
  return {
    year: getYear(nextMonday),
    week: getWeek(nextMonday, { weekStartsOn: 1, locale: fr }),
  };
};

export const getPreviousWeek = (year: number, week: number): { year: number; week: number } => {
  const monday = getMondayOfWeek(year, week);
  const prevMonday = subWeeks(monday, 1);
  return {
    year: getYear(prevMonday),
    week: getWeek(prevMonday, { weekStartsOn: 1, locale: fr }),
  };
};

// Formatage
export const formatDate = (date: Date | string, formatStr: string = 'dd/MM/yyyy'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: fr });
};

export const formatWeekLabel = (year: number, week: number): string => {
  const monday = getMondayOfWeek(year, week);
  const sunday = addDays(monday, 6);
  return `Semaine ${week} - ${format(monday, 'd MMM', { locale: fr })} au ${format(sunday, 'd MMM yyyy', { locale: fr })}`;
};

export const getDayName = (dayIndex: number): string => {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  return days[dayIndex] || '';
};

export const getDayShortName = (dayIndex: number): string => {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return days[dayIndex] || '';
};

// Vérifications
export const isHoliday = (date: Date, holidays: Array<{ date: string }>): boolean => {
  return holidays.some((h) => isSameDay(parseISO(h.date), date));
};

export const getHolidayName = (date: Date, holidays: Array<{ date: string; libelle: string }>): string | null => {
  const holiday = holidays.find((h) => isSameDay(parseISO(h.date), date));
  return holiday?.libelle || null;
};

// Liste des mois
export const getMonths = (): Array<{ value: number; label: string }> => {
  return [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];
};

// Liste des années (5 ans en arrière, 1 an en avant)
export const getYears = (): Array<{ value: number; label: string }> => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    years.push({ value: y, label: y.toString() });
  }
  return years;
};

// Liste des semaines d'une année
export const getWeeksOfYear = (year: number): Array<{ value: number; label: string }> => {
  const weeks = [];
  // On peut avoir 52 ou 53 semaines selon l'année
  const maxWeeks = getWeek(new Date(year, 11, 31), { weekStartsOn: 1, locale: fr });
  for (let w = 1; w <= maxWeeks; w++) {
    const monday = getMondayOfWeek(year, w);
    weeks.push({
      value: w,
      label: `S${w} - ${format(monday, 'dd/MM', { locale: fr })}`,
    });
  }
  return weeks;
};

export { parseISO, format, isSameDay, isWeekend };
