import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createTaskSchema, updateTaskSchema } from '../validators/index.js';

const prisma = new PrismaClient();
const router = Router();

// Get all tasks
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, includeInactive } = req.query;

    let where: any = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            timeEntries: true,
          },
        },
      },
      orderBy: [{ project: { name: 'asc' } }, { code: 'asc' }],
    });

    // Add hours spent per task
    const tasksWithHours = await Promise.all(
      tasks.map(async (task) => {
        const totalHours = await prisma.timeEntry.aggregate({
          where: { taskId: task.id },
          _sum: { hours: true },
        });

        return {
          ...task,
          totalHoursSpent: totalHours._sum.hours || 0,
        };
      })
    );

    return res.json(tasksWithHours);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get single task
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    const totalHours = await prisma.timeEntry.aggregate({
      where: { taskId: id },
      _sum: { hours: true },
    });

    return res.json({
      ...task,
      totalHoursSpent: totalHours._sum.hours || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create task (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const task = await prisma.task.create({
      data,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json(task);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update task (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateTaskSchema.parse(req.body);

    const task = await prisma.task.update({
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
      },
    });

    return res.json(task);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete task (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if task has time entries
    const entriesCount = await prisma.timeEntry.count({
      where: { taskId: id },
    });

    if (entriesCount > 0) {
      return res.status(400).json({
        error: 'Impossible de supprimer une tâche avec des pointages existants. Vous pouvez la désactiver à la place.',
      });
    }

    await prisma.task.delete({
      where: { id },
    });

    return res.json({ message: 'Tâche supprimée' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get task types (unique task codes across all projects)
router.get('/types/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const taskTypes = await prisma.task.findMany({
      where: { isActive: true },
      distinct: ['code'],
      select: {
        code: true,
        label: true,
        description: true,
      },
      orderBy: { label: 'asc' },
    });

    return res.json(taskTypes);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as taskRouter };
