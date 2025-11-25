import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  getWeek,
  getYear,
  addWeeks,
  subWeeks,
  isWeekend,
  isSameDay,
  isSameMonth,
  parseISO,
  addMonths,
  subMonths,
  getDay,
  setDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatDate = (date: Date | string, formatStr: string = 'dd/MM/yyyy') => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: fr });
};

export const formatDateLong = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE d MMMM yyyy', { locale: fr });
};

export const getWeekNumber = (date: Date) => {
  return getWeek(date, { weekStartsOn: 1, locale: fr });
};

export const getWeekYear = (date: Date) => {
  return getYear(date);
};

export const getWeekRange = (weekNumber: number, year: number) => {
  // Get first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  // Calculate the date of week 1
  const startOfWeek1 = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });
  // Add weeks to get to the desired week
  const targetWeekStart = addWeeks(startOfWeek1, weekNumber - 1);
  const targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 1 });

  return {
    start: targetWeekStart,
    end: targetWeekEnd,
  };
};

export const getWeekDays = (weekNumber: number, year: number) => {
  const { start, end } = getWeekRange(weekNumber, year);
  return eachDayOfInterval({ start, end });
};

export const getCurrentWeek = () => {
  const now = new Date();
  return {
    weekNumber: getWeekNumber(now),
    year: getWeekYear(now),
  };
};

export const getNextWeek = (weekNumber: number, year: number) => {
  const { start } = getWeekRange(weekNumber, year);
  const nextWeekStart = addWeeks(start, 1);
  return {
    weekNumber: getWeekNumber(nextWeekStart),
    year: getWeekYear(nextWeekStart),
  };
};

export const getPreviousWeek = (weekNumber: number, year: number) => {
  const { start } = getWeekRange(weekNumber, year);
  const prevWeekStart = subWeeks(start, 1);
  return {
    weekNumber: getWeekNumber(prevWeekStart),
    year: getWeekYear(prevWeekStart),
  };
};

// Get weeks for a month, including partial weeks from adjacent months
export const getMonthWeeks = (month: number, year: number) => {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  // Get first Monday on or before month start
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // Get last Sunday on or after month end
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = eachWeekOfInterval(
    { start: calendarStart, end: calendarEnd },
    { weekStartsOn: 1 }
  );

  return weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekNumber = getWeekNumber(weekStart);
    const weekYear = getWeekYear(weekStart);

    // Check if this week should be shown for this month
    // A week belongs to a month if its Thursday is in that month (ISO week rule)
    const thursday = setDay(weekStart, 4, { weekStartsOn: 1 });
    const belongsToMonth = isSameMonth(thursday, monthStart);

    return {
      weekNumber,
      year: weekYear,
      days,
      weekStart,
      weekEnd,
      belongsToMonth,
    };
  }).filter((week) => week.belongsToMonth);
};

export const isHoliday = (date: Date, holidays: Array<{ date: string }>) => {
  return holidays.some((h) => isSameDay(parseISO(h.date), date));
};

export const isLeaveDay = (date: Date, userId: string, leaves: Array<{ date: string; userId: string }>) => {
  return leaves.some((l) => l.userId === userId && isSameDay(parseISO(l.date), date));
};

export const isWorkDay = (date: Date) => {
  return !isWeekend(date);
};

export const formatWeekLabel = (weekNumber: number, year: number) => {
  const { start, end } = getWeekRange(weekNumber, year);
  return `Semaine ${weekNumber} (${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM yyyy', { locale: fr })})`;
};

export const formatMonthYear = (month: number, year: number) => {
  return format(new Date(year, month), 'MMMM yyyy', { locale: fr });
};

export const getNextMonth = (month: number, year: number) => {
  const date = addMonths(new Date(year, month), 1);
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
  };
};

export const getPreviousMonth = (month: number, year: number) => {
  const date = subMonths(new Date(year, month), 1);
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
  };
};

export const getDayName = (date: Date) => {
  return format(date, 'EEEE', { locale: fr });
};

export const getDayShortName = (date: Date) => {
  return format(date, 'EEE', { locale: fr });
};

export { isSameDay, isSameMonth, isWeekend, parseISO, format };
