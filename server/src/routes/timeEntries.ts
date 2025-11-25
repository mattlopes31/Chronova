import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getWeek, getYear, startOfWeek, endOfWeek, parseISO, format } from 'date-fns';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createTimeEntrySchema, updateTimeEntrySchema, validateWeekSchema } from '../validators/index.js';

const prisma = new PrismaClient();
const router = Router();

// Get time entries for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, weekNumber, year, projectId } = req.query;

    let where: any = {
      userId: req.user?.id,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (weekNumber && year) {
      where.weekNumber = parseInt(weekNumber as string);
      where.year = parseInt(year as string);
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get all time entries (admin only)
router.get('/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, weekNumber, year, userId, projectId } = req.query;

    let where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (weekNumber && year) {
      where.weekNumber = parseInt(weekNumber as string);
      where.year = parseInt(year as string);
    }

    if (userId) {
      where.userId = userId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { user: { lastName: 'asc' } }],
    });

    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get weekly summary
router.get('/weekly-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { weekNumber, year } = req.query;

    if (!weekNumber || !year) {
      return res.status(400).json({ error: 'weekNumber et year sont requis' });
    }

    const wn = parseInt(weekNumber as string);
    const y = parseInt(year as string);

    // Get user's entries for the week
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user?.id,
        weekNumber: wn,
        year: y,
      },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    // Check if week is validated
    const validation = await prisma.weekValidation.findUnique({
      where: {
        userId_weekNumber_year: {
          userId: req.user!.id,
          weekNumber: wn,
          year: y,
        },
      },
    });

    // Calculate totals
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    // Group by date
    const byDate: Record<string, typeof entries> = {};
    entries.forEach((entry) => {
      const dateKey = format(entry.date, 'yyyy-MM-dd');
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(entry);
    });

    // Group by project
    const byProject: Record<string, number> = {};
    entries.forEach((entry) => {
      const key = entry.project.name;
      byProject[key] = (byProject[key] || 0) + entry.hours;
    });

    return res.json({
      entries,
      totalHours,
      byDate,
      byProject,
      validated: !!validation,
      validatedAt: validation?.validatedAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get all users' weekly summary (admin only)
router.get('/weekly-summary/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { weekNumber, year } = req.query;

    if (!weekNumber || !year) {
      return res.status(400).json({ error: 'weekNumber et year sont requis' });
    }

    const wn = parseInt(weekNumber as string);
    const y = parseInt(year as string);

    // Get all users with their entries for the week
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        timeEntries: {
          where: {
            weekNumber: wn,
            year: y,
          },
          include: {
            project: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            task: {
              select: {
                id: true,
                code: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    // Get validations for the week
    const validations = await prisma.weekValidation.findMany({
      where: {
        weekNumber: wn,
        year: y,
      },
    });

    const validationMap = new Map(validations.map((v) => [v.userId, v]));

    // Build summary for each user
    const summary = users.map((user) => {
      const totalHours = user.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const validation = validationMap.get(user.id);

      // Group entries by date
      const byDate: Record<string, number> = {};
      user.timeEntries.forEach((entry) => {
        const dateKey = format(entry.date, 'yyyy-MM-dd');
        byDate[dateKey] = (byDate[dateKey] || 0) + entry.hours;
      });

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        totalHours,
        validated: !!validation,
        validatedAt: validation?.validatedAt,
        byDate,
        entries: user.timeEntries,
      };
    });

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create time entry
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTimeEntrySchema.parse(req.body);

    const entryDate = new Date(data.date);
    const weekNumber = getWeek(entryDate, { weekStartsOn: 1 });
    const year = getYear(entryDate);

    // Check if week is already validated
    const validation = await prisma.weekValidation.findUnique({
      where: {
        userId_weekNumber_year: {
          userId: req.user!.id,
          weekNumber,
          year,
        },
      },
    });

    if (validation) {
      return res.status(400).json({
        error: 'Cette semaine est déjà validée. Contactez un administrateur pour la modifier.',
      });
    }

    // Check if user is on leave for this date
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        userId: req.user!.id,
        status: 'APPROVED',
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (leave) {
      return res.status(400).json({
        error: 'Vous êtes en congé ce jour-là.',
      });
    }

    // Check total hours for the day doesn't exceed 24
    const existingHours = await prisma.timeEntry.aggregate({
      where: {
        userId: req.user!.id,
        date: entryDate,
        taskId: { not: data.taskId },
      },
      _sum: { hours: true },
    });

    if ((existingHours._sum.hours || 0) + data.hours > 24) {
      return res.status(400).json({
        error: 'Le total des heures pour cette journée ne peut pas dépasser 24h.',
      });
    }

    const entry = await prisma.timeEntry.upsert({
      where: {
        userId_date_taskId: {
          userId: req.user!.id,
          date: entryDate,
          taskId: data.taskId,
        },
      },
      update: {
        hours: data.hours,
        description: data.description,
        projectId: data.projectId,
      },
      create: {
        ...data,
        date: entryDate,
        userId: req.user!.id,
        weekNumber,
        year,
      },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    return res.status(201).json(entry);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update time entry
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateTimeEntrySchema.parse(req.body);

    // Get existing entry
    const existing = await prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    // Check ownership (unless admin)
    if (req.user?.role !== 'ADMIN' && existing.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Check if week is validated (unless admin)
    if (req.user?.role !== 'ADMIN') {
      const validation = await prisma.weekValidation.findUnique({
        where: {
          userId_weekNumber_year: {
            userId: existing.userId,
            weekNumber: existing.weekNumber,
            year: existing.year,
          },
        },
      });

      if (validation) {
        return res.status(400).json({
          error: 'Cette semaine est validée. Contactez un administrateur pour la modifier.',
        });
      }
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    return res.json(entry);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete time entry
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    // Check ownership (unless admin)
    if (req.user?.role !== 'ADMIN' && existing.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Check if week is validated (unless admin)
    if (req.user?.role !== 'ADMIN') {
      const validation = await prisma.weekValidation.findUnique({
        where: {
          userId_weekNumber_year: {
            userId: existing.userId,
            weekNumber: existing.weekNumber,
            year: existing.year,
          },
        },
      });

      if (validation) {
        return res.status(400).json({
          error: 'Cette semaine est validée. Contactez un administrateur pour la supprimer.',
        });
      }
    }

    await prisma.timeEntry.delete({
      where: { id },
    });

    return res.json({ message: 'Entrée supprimée' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Validate week
router.post('/validate-week', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { weekNumber, year } = validateWeekSchema.parse(req.body);

    // Check if already validated
    const existing = await prisma.weekValidation.findUnique({
      where: {
        userId_weekNumber_year: {
          userId: req.user!.id,
          weekNumber,
          year,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Cette semaine est déjà validée' });
    }

    // Calculate total hours
    const totalHours = await prisma.timeEntry.aggregate({
      where: {
        userId: req.user!.id,
        weekNumber,
        year,
      },
      _sum: { hours: true },
    });

    // Mark all entries as validated
    await prisma.timeEntry.updateMany({
      where: {
        userId: req.user!.id,
        weekNumber,
        year,
      },
      data: { validated: true },
    });

    // Create validation record
    const validation = await prisma.weekValidation.create({
      data: {
        userId: req.user!.id,
        weekNumber,
        year,
        totalHours: totalHours._sum.hours || 0,
      },
    });

    return res.json({
      message: 'Semaine validée avec succès',
      validation,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Unvalidate week (admin only)
router.post('/unvalidate-week', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, weekNumber, year } = req.body;

    if (!userId || !weekNumber || !year) {
      return res.status(400).json({ error: 'userId, weekNumber et year sont requis' });
    }

    await prisma.weekValidation.delete({
      where: {
        userId_weekNumber_year: {
          userId,
          weekNumber: parseInt(weekNumber),
          year: parseInt(year),
        },
      },
    });

    // Unmark entries as validated
    await prisma.timeEntry.updateMany({
      where: {
        userId,
        weekNumber: parseInt(weekNumber),
        year: parseInt(year),
      },
      data: { validated: false },
    });

    return res.json({ message: 'Validation de la semaine annulée' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as timeEntryRouter };
