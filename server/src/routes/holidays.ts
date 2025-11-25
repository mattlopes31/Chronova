import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createHolidaySchema } from '../validators/index.js';

const prisma = new PrismaClient();
const router = Router();

// Get holidays for a year
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const holidays = await prisma.publicHoliday.findMany({
      where: { year: targetYear },
      orderBy: { date: 'asc' },
    });

    return res.json(holidays);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get holidays for date range (for calendar)
router.get('/range', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate et endDate sont requis' });
    }

    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      },
      orderBy: { date: 'asc' },
    });

    return res.json(holidays);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create holiday (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createHolidaySchema.parse(req.body);

    const holiday = await prisma.publicHoliday.create({
      data: {
        ...data,
        year: data.date.getFullYear(),
      },
    });

    return res.status(201).json(holiday);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete holiday (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.publicHoliday.delete({
      where: { id },
    });

    return res.json({ message: 'Jour férié supprimé' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Initialize holidays for a year (admin only)
router.post('/init/:year', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.params.year);

    // French public holidays (some dates are fixed, some vary)
    const fixedHolidays = [
      { month: 1, day: 1, name: "Jour de l'An" },
      { month: 5, day: 1, name: 'Fête du Travail' },
      { month: 5, day: 8, name: 'Victoire 1945' },
      { month: 7, day: 14, name: 'Fête Nationale' },
      { month: 8, day: 15, name: 'Assomption' },
      { month: 11, day: 1, name: 'Toussaint' },
      { month: 11, day: 11, name: 'Armistice' },
      { month: 12, day: 25, name: 'Noël' },
    ];

    // Calculate Easter-based holidays
    const easter = calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easterMonday.getDate() + 1);
    
    const ascension = new Date(easter);
    ascension.setDate(ascension.getDate() + 39);
    
    const pentecostMonday = new Date(easter);
    pentecostMonday.setDate(pentecostMonday.getDate() + 50);

    const allHolidays = [
      ...fixedHolidays.map((h) => ({
        date: new Date(year, h.month - 1, h.day),
        name: h.name,
      })),
      { date: easterMonday, name: 'Lundi de Pâques' },
      { date: ascension, name: 'Ascension' },
      { date: pentecostMonday, name: 'Lundi de Pentecôte' },
    ];

    // Insert holidays
    const created = await Promise.all(
      allHolidays.map((h) =>
        prisma.publicHoliday.upsert({
          where: { date: h.date },
          update: { name: h.name },
          create: {
            date: h.date,
            name: h.name,
            year,
          },
        })
      )
    );

    return res.json({
      message: `${created.length} jours fériés initialisés pour ${year}`,
      holidays: created,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Calculate Easter date using Anonymous Gregorian algorithm
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

export { router as holidayRouter };
