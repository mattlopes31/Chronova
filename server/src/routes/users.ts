import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';
import { createUserSchema, updateUserSchema } from '../validators/index.js';
import { sendWelcomeEmail } from '../services/email.js';

const prisma = new PrismaClient();
const router = Router();

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            timeEntries: true,
            projectAssignments: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get single user
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Non-admin can only view their own profile
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        projectAssignments: {
          include: {
            project: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create user (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Send welcome email with temporary password
    await sendWelcomeEmail(data.email, data.firstName, data.password);

    return res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update user (admin only, or self for limited fields)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    // Non-admin can only update their own basic info
    if (req.user?.role !== 'ADMIN') {
      if (req.user?.id !== id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
      // Employees can't change role or active status
      delete data.role;
      delete data.isActive;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.json(user);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    await prisma.user.delete({
      where: { id },
    });

    return res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Assign projects to user (admin only)
router.post('/:id/projects', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectIds } = req.body as { projectIds: string[] };

    if (!Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'projectIds doit être un tableau' });
    }

    // Delete existing assignments
    await prisma.projectAssignment.deleteMany({
      where: { userId: id },
    });

    // Create new assignments
    if (projectIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: projectIds.map((projectId) => ({
          userId: id,
          projectId,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projectAssignments: {
          include: {
            project: true,
          },
        },
      },
    });

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get user's assigned projects
router.get('/:id/projects', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Non-admin can only view their own projects
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: id },
      include: {
        project: {
          include: {
            tasks: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return res.json(assignments.map((a) => a.project));
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as userRouter };
