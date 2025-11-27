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

// GET /api/clients - Liste des clients
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { actif, search } = req.query;

    const where: any = {};
    
    if (actif !== undefined) where.actif = actif === 'true';
    if (search) {
      where.OR = [
        { nom: { contains: search as string, mode: 'insensitive' } },
        { code_client: { contains: search as string, mode: 'insensitive' } },
        { ville: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        pays: {
          select: { id: true, country_name: true, country_code2: true }
        },
        _count: {
          select: { projets: true }
        }
      },
      orderBy: { nom: 'asc' }
    });

    res.json(serializeBigInt(clients));
  } catch (error) {
    console.error('Erreur liste clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/pays - Liste des pays
router.get('/pays', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const pays = await prisma.pays.findMany({
      orderBy: { country_name: 'asc' }
    });
    res.json(serializeBigInt(pays));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        pays: true,
        projets: {
          include: {
            status: true
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    res.json(serializeBigInt(client));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/clients - Créer un client (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;

    if (!data.nom) {
      return res.status(400).json({ error: 'Nom du client requis' });
    }

    const client = await prisma.client.create({
      data: {
        nom: data.nom,
        code_client: data.code_client || null,
        email: data.email || null,
        tel: data.tel || null,
        adresse: data.adresse || null,
        cp: data.code_postal || data.cp || null,
        ville: data.ville || null,
        site_web: data.site_web || null,
        contact_nom: data.contact_nom || null,
        contact_prenom: data.contact_prenom || null,
        contact_email: data.contact_email || null,
        contact_tel: data.contact_tel || null,
        pays_id: data.pays_id ? BigInt(data.pays_id) : null,
        siret: data.siret || null,
        notes: data.notes || null,
        actif: data.actif !== undefined ? data.actif : true
      },
      include: {
        pays: true
      }
    });

    res.status(201).json(serializeBigInt(client));
  } catch (error) {
    console.error('Erreur création client:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/clients/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const data = req.body;

    const updateData: any = {
      nom: data.nom,
      code_client: data.code_client || null,
      email: data.email || null,
      tel: data.tel || null,
      adresse: data.adresse || null,
      cp: data.code_postal || data.cp || null,
      ville: data.ville || null,
      site_web: data.site_web || null,
      contact_nom: data.contact_nom || null,
      contact_prenom: data.contact_prenom || null,
      contact_email: data.contact_email || null,
      contact_tel: data.contact_tel || null,
      notes: data.notes || null,
      actif: data.actif !== undefined ? data.actif : true
    };
    
    if (data.pays_id) updateData.pays_id = BigInt(data.pays_id);

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        pays: true
      }
    });

    res.json(serializeBigInt(client));
  } catch (error) {
    console.error('Erreur modification client:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/clients/:id - Désactiver un client
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    await prisma.client.update({
      where: { id },
      data: { actif: false }
    });

    res.json({ message: 'Client désactivé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
