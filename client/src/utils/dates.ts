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
  try {
    if (!year || !week || week < 1 || week > 53) {
      return new Date(); // Retourner aujourd'hui par défaut
    }
    // Créer une date dans l'année souhaitée
    let date = new Date(year, 0, 4); // 4 janvier est toujours en semaine 1
    date = setYear(date, year);
    date = setWeek(date, week, { weekStartsOn: 1, locale: fr });
    return startOfWeek(date, { weekStartsOn: 1 });
  } catch (e) {
    console.warn('getMondayOfWeek error:', e);
    return new Date();
  }
};

/**
 * Lundi–dimanche à partir de la chaîne `YYYY-MM-DD` renvoyée par l’API pointage (`dates.lundi`),
 * même règle calendrier que le serveur (jours en UTC midi pour éviter les bords DST).
 */
export function getWeekDaysFromApiMonday(lundiIso: string): Date[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lundiIso).trim());
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(Date.UTC(y, mo - 1, d + i, 12, 0, 0)));
  }
  return days;
}

// Obtenir les jours de la semaine (lundi à dimanche)
export const getWeekDays = (year: number, week: number): Date[] => {
  try {
    if (!year || !week) return [];
    const monday = getMondayOfWeek(year, week);
    if (isNaN(monday.getTime())) return [];
    return eachDayOfInterval({
      start: monday,
      end: addDays(monday, 6),
    });
  } catch (e) {
    console.warn('getWeekDays error:', e);
    return [];
  }
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
export const formatDate = (date: Date | string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return '';
    return format(d, formatStr, { locale: fr });
  } catch (e) {
    console.warn('formatDate error:', e, date);
    return '';
  }
};

export const formatWeekLabel = (year: number, week: number): string => {
  try {
    if (!year || !week) return '';
    const monday = getMondayOfWeek(year, week);
    if (isNaN(monday.getTime())) return '';
    const sunday = addDays(monday, 6);
    return `Semaine ${week} - ${format(monday, 'd MMM', { locale: fr })} au ${format(sunday, 'd MMM yyyy', { locale: fr })}`;
  } catch (e) {
    console.warn('formatWeekLabel error:', e);
    return `Semaine ${week}`;
  }
};

// Formatage heures en quart d'heure (ex: 35.5 -> 35h30)
export const formatHeuresQuart = (heures: number | string | null | undefined): string => {
  if (heures === null || heures === undefined || heures === '') return '0h';
  const n = typeof heures === 'string' ? parseFloat(heures.replace(',', '.')) : Number(heures);
  if (!isFinite(n) || isNaN(n)) return '0h';

  // Arrondir au quart d'heure
  const rounded = Math.round(n * 4) / 4;
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);

  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  // Sécuriser un éventuel 60min dû aux arrondis
  if (m === 60) {
    h += 1;
    m = 0;
  }
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${String(m).padStart(2, '0')}`;
};

// Format "durée" en quart d'heure (ex: 0.5 -> 30min, 1 -> 1h, 1.5 -> 1h30)
export const formatDureeQuart = (heures: number | string | null | undefined): string => {
  if (heures === null || heures === undefined || heures === '') return '0';
  const n = typeof heures === 'string' ? parseFloat(heures.replace(',', '.')) : Number(heures);
  if (!isFinite(n) || isNaN(n)) return '0';

  const rounded = Math.round(n * 4) / 4;
  if (rounded === 0) return '0';
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);

  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }

  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${String(m).padStart(2, '0')}`;
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
  try {
    if (!year) return [];
    const weeks = [];
    // On peut avoir 52 ou 53 semaines selon l'année
    const maxWeeks = getWeek(new Date(year, 11, 28), { weekStartsOn: 1, locale: fr }) || 52;
    for (let w = 1; w <= Math.min(maxWeeks, 53); w++) {
      const monday = getMondayOfWeek(year, w);
      const label = isNaN(monday.getTime()) 
        ? `S${w}`
        : `S${w} - ${format(monday, 'dd/MM', { locale: fr })}`;
      weeks.push({ value: w, label });
    }
    return weeks;
  } catch (e) {
    console.warn('getWeeksOfYear error:', e);
    // Retourner une liste par défaut de 52 semaines
    return Array.from({ length: 52 }, (_, i) => ({ value: i + 1, label: `S${i + 1}` }));
  }
};

export { parseISO, format, isSameDay, isWeekend };