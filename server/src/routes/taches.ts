import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const serializeBigInt = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// GET /api/taches - Liste des types de tâches
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { actif } = req.query;

    const where: any = {};
    if (actif !== undefined) where.actif = actif === 'true';

    const taches = await prisma.tacheType.findMany({
      where,
      orderBy: { ordre: 'asc' }
    });

    res.json(serializeBigInt(taches));
  } catch (error) {
    console.error('Erreur liste tâches:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/taches/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tache = await prisma.tacheType.findUnique({
      where: { id: BigInt(req.params.id) }
    });

    if (!tache) {
      return res.status(404).json({ error: 'Type de tâche non trouvé' });
    }

    res.json(serializeBigInt(tache));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/taches - Créer un type de tâche (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tache_type, code, is_default, is_facturable, couleur, ordre } = req.body;

    if (!tache_type) {
      return res.status(400).json({ error: 'Nom de la tâche requis' });
    }

    const tache = await prisma.tacheType.create({
      data: {
        tache_type,
        code,
        is_default: is_default || false,
        is_facturable: is_facturable !== false,
        couleur: couleur || '#10B981',
        ordre: ordre || 0
      }
    });

    res.status(201).json(serializeBigInt(tache));
  } catch (error) {
    console.error('Erreur création tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/taches/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const tache = await prisma.tacheType.update({
      where: { id },
      data: req.body
    });

    res.json(serializeBigInt(tache));
  } catch (error) {
    console.error('Erreur modification tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/taches/:id - Désactiver un type de tâche
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    await prisma.tacheType.update({
      where: { id },
      data: { actif: false }
    });

    res.json({ message: 'Type de tâche désactivé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
