import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createLeaveSchema, updateLeaveStatusSchema } from '../validators/index.js';

const prisma = new PrismaClient();
const router = Router();

// Get current user's leaves
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { year, status } = req.query;

    let where: any = {
      userId: req.user?.id,
    };

    if (year) {
      const yearNum = parseInt(year as string);
      where.startDate = {
        gte: new Date(`${yearNum}-01-01`),
        lte: new Date(`${yearNum}-12-31`),
      };
    }

    if (status) {
      where.status = status;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return res.json(leaves);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get all leaves (admin only)
router.get('/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { year, status, userId } = req.query;

    let where: any = {};

    if (year) {
      const yearNum = parseInt(year as string);
      where.startDate = {
        gte: new Date(`${yearNum}-01-01`),
        lte: new Date(`${yearNum}-12-31`),
      };
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const leaves = await prisma.leaveRequest.findMany({
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
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return res.json(leaves);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get leaves for date range (for calendar)
router.get('/calendar', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate et endDate sont requis' });
    }

    const where: any = {
      status: 'APPROVED',
      OR: [
        {
          startDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
        {
          endDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
        {
          AND: [
            { startDate: { lte: new Date(startDate as string) } },
            { endDate: { gte: new Date(endDate as string) } },
          ],
        },
      ],
    };

    // Non-admin only sees their own leaves
    if (req.user?.role !== 'ADMIN') {
      where.userId = req.user?.id;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Convert to date array for easier frontend handling
    const leaveDates: Array<{
      date: string;
      userId: string;
      userName: string;
      type: string;
    }> = [];

    leaves.forEach((leave) => {
      const days = eachDayOfInterval({
        start: leave.startDate,
        end: leave.endDate,
      });

      days.forEach((day) => {
        if (!isWeekend(day)) {
          leaveDates.push({
            date: day.toISOString().split('T')[0],
            userId: leave.userId,
            userName: `${leave.user.firstName} ${leave.user.lastName}`,
            type: leave.type,
          });
        }
      });
    });

    return res.json(leaveDates);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create leave request
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createLeaveSchema.parse(req.body);

    // Validate date range
    if (data.endDate < data.startDate) {
      return res.status(400).json({
        error: 'La date de fin doit être après la date de début',
      });
    }

    // Check for overlapping leaves
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: req.user!.id,
        status: { not: 'REJECTED' },
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate },
          },
        ],
      },
    });

    if (overlap) {
      return res.status(400).json({
        error: 'Une demande de congé existe déjà pour cette période',
      });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        ...data,
        userId: req.user!.id,
      },
    });

    return res.status(201).json(leave);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update leave status (admin only)
router.put('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = updateLeaveStatusSchema.parse(req.body);

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: req.user!.id,
        approvedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return res.json(leave);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete/cancel leave request
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    // Non-admin can only delete their own pending requests
    if (req.user?.role !== 'ADMIN') {
      if (leave.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      if (leave.status !== 'PENDING') {
        return res.status(400).json({
          error: 'Seules les demandes en attente peuvent être annulées',
        });
      }
    }

    await prisma.leaveRequest.delete({
      where: { id },
    });

    return res.json({ message: 'Demande supprimée' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as leaveRouter };
