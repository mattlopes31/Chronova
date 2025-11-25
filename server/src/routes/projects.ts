import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createProjectSchema, updateProjectSchema } from '../validators/index.js';

const prisma = new PrismaClient();
const router = Router();

// Get all projects
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, includeInactive } = req.query;

    let where: any = {};

    if (status) {
      where.status = status;
    }

    // For non-admin, only show assigned projects
    if (req.user?.role !== 'ADMIN') {
      where.assignments = {
        some: { userId: req.user?.id },
      };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        tasks: {
          where: includeInactive === 'true' ? {} : { isActive: true },
          orderBy: { code: 'asc' },
        },
        _count: {
          select: {
            timeEntries: true,
            assignments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate total hours spent per project
    const projectsWithHours = await Promise.all(
      projects.map(async (project) => {
        const totalHours = await prisma.timeEntry.aggregate({
          where: { projectId: project.id },
          _sum: { hours: true },
        });

        return {
          ...project,
          totalHoursSpent: totalHours._sum.hours || 0,
        };
      })
    );

    return res.json(projectsWithHours);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get single project
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { code: 'asc' },
        },
        assignments: {
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
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Check access for non-admin
    if (req.user?.role !== 'ADMIN') {
      const hasAccess = project.assignments.some((a) => a.user.id === req.user?.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    }

    // Get hours breakdown by task
    const hoursBreakdown = await prisma.timeEntry.groupBy({
      by: ['taskId'],
      where: { projectId: id },
      _sum: { hours: true },
    });

    const totalHours = await prisma.timeEntry.aggregate({
      where: { projectId: id },
      _sum: { hours: true },
    });

    return res.json({
      ...project,
      totalHoursSpent: totalHours._sum.hours || 0,
      hoursBreakdown,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create project (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data,
      include: {
        tasks: true,
      },
    });

    return res.status(201).json(project);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update project (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        tasks: true,
      },
    });

    return res.json(project);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete project (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if project has time entries
    const entriesCount = await prisma.timeEntry.count({
      where: { projectId: id },
    });

    if (entriesCount > 0) {
      return res.status(400).json({
        error: 'Impossible de supprimer un projet avec des pointages existants. Vous pouvez le mettre en statut "Annulé" à la place.',
      });
    }

    await prisma.project.delete({
      where: { id },
    });

    return res.json({ message: 'Projet supprimé' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Assign users to project (admin only)
router.post('/:id/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body as { userIds: string[] };

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds doit être un tableau' });
    }

    // Delete existing assignments
    await prisma.projectAssignment.deleteMany({
      where: { projectId: id },
    });

    // Create new assignments
    if (userIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: userIds.map((userId) => ({
          userId,
          projectId: id,
        })),
        skipDuplicates: true,
      });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        assignments: {
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
        },
      },
    });

    return res.json(project);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as projectRouter };
