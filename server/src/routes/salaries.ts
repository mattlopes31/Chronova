import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const serializeBigInt = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// GET /api/salaries - Liste des salariés
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { actif, fonction_id, status_id, search } = req.query;

    const where: any = {};
    
    if (actif !== undefined) {
      where.actif = actif === 'true';
    }
    if (fonction_id) {
      where.salarie_fonction_id = BigInt(fonction_id as string);
    }
    if (status_id) {
      where.salarie_status_id = BigInt(status_id as string);
    }
    if (search) {
      where.OR = [
        { nom: { contains: search as string, mode: 'insensitive' } },
        { prenom: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { matricule: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const salaries = await prisma.salarie.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        tel: true,
        matricule: true,
        role: true,
        actif: true,
        date_entree: true,
        heures_hebdo: true,
        taux_horaire: true,
        fonction: true,
        status: true,
        manager: {
          select: { id: true, nom: true, prenom: true }
        }
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }]
    });

    res.json(serializeBigInt(salaries));
  } catch (error) {
    console.error('Erreur liste salariés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/salaries/fonctions - Liste des fonctions
router.get('/fonctions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const fonctions = await prisma.salarieFonction.findMany({
      orderBy: { fonction: 'asc' }
    });
    res.json(serializeBigInt(fonctions));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/salaries/statuts - Liste des statuts
router.get('/statuts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const statuts = await prisma.salarieStatus.findMany({
      orderBy: { status: 'asc' }
    });
    res.json(serializeBigInt(statuts));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/salaries/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const salarie = await prisma.salarie.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        fonction: true,
        status: true,
        manager: {
          select: { id: true, nom: true, prenom: true, email: true }
        },
        subordonnes: {
          select: { id: true, nom: true, prenom: true, email: true }
        }
      }
    });

    if (!salarie) {
      return res.status(404).json({ error: 'Salarié non trouvé' });
    }

    const { password_hash, token_reset_password, token_expiration, ...data } = salarie;
    res.json(serializeBigInt(data));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/salaries - Créer un salarié (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password, ...data } = req.body;

    if (!data.email || !data.nom || !data.prenom) {
      return res.status(400).json({ error: 'Email, nom et prénom requis' });
    }

    const existing = await prisma.salarie.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      return res.status(400).json({ error: 'Cet email existe déjà' });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const salarie = await prisma.salarie.create({
      data: {
        ...data,
        password_hash: hashedPassword,
        salarie_fonction_id: data.salarie_fonction_id ? BigInt(data.salarie_fonction_id) : null,
        salarie_status_id: data.salarie_status_id ? BigInt(data.salarie_status_id) : null,
        manager_id: data.manager_id ? BigInt(data.manager_id) : null
      },
      include: {
        fonction: true,
        status: true
      }
    });

    const { password_hash, token_reset_password, token_expiration, ...result } = salarie;
    res.status(201).json(serializeBigInt(result));
  } catch (error) {
    console.error('Erreur création salarié:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/salaries/:id - Modifier un salarié
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    
    // Seul l'admin peut modifier les autres, ou le salarié lui-même
    if (req.user!.role !== 'Admin' && req.user!.id !== id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { password, ...data } = req.body;

    const updateData: any = { ...data };
    
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    
    if (data.salarie_fonction_id) {
      updateData.salarie_fonction_id = BigInt(data.salarie_fonction_id);
    }
    if (data.salarie_status_id) {
      updateData.salarie_status_id = BigInt(data.salarie_status_id);
    }
    if (data.manager_id) {
      updateData.manager_id = BigInt(data.manager_id);
    }

    const salarie = await prisma.salarie.update({
      where: { id },
      data: updateData,
      include: {
        fonction: true,
        status: true
      }
    });

    const { password_hash, token_reset_password, token_expiration, ...result } = salarie;
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Erreur modification salarié:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/salaries/:id - Désactiver un salarié (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    await prisma.salarie.update({
      where: { id },
      data: { actif: false, date_sortie: new Date() }
    });

    res.json({ message: 'Salarié désactivé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
