import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, managerMiddleware, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const serializeBigInt = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// GET /api/conges - Liste des congés
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { salarie_id, annee, status, type } = req.query;

    const where: any = {};
    
    if (req.user!.role === 'Salarie') {
      where.salarie_id = req.user!.id;
    } else if (salarie_id) {
      where.salarie_id = BigInt(salarie_id as string);
    }
    
    if (annee) where.annee = parseInt(annee as string);
    if (status) where.validation_status = status;
    if (type) where.type_conge = type;

    const conges = await prisma.salarieCp.findMany({
      where,
      include: {
        salarie: {
          select: { id: true, nom: true, prenom: true }
        },
        validateur: {
          select: { id: true, nom: true, prenom: true }
        }
      },
      orderBy: [{ annee: 'desc' }, { semaine: 'desc' }]
    });

    res.json(serializeBigInt(conges));
  } catch (error) {
    console.error('Erreur liste congés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/conges/jours-feries - Liste des jours fériés
router.get('/jours-feries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { annee } = req.query;

    const where: any = {};
    if (annee) {
      const year = parseInt(annee as string);
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31)
      };
    }

    const joursFeries = await prisma.jourFerie.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    res.json(serializeBigInt(joursFeries));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conges - Créer une demande de congé
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    const salarie_id = req.user!.id;

    if (!data.annee || !data.semaine) {
      return res.status(400).json({ error: 'Année et semaine requises' });
    }

    // Si on a des types par jour, créer/mettre à jour les entrées par type
    const typesParJour = {
      lundi: data.type_lundi || data.type_conge || 'CP',
      mardi: data.type_mardi || data.type_conge || 'CP',
      mercredi: data.type_mercredi || data.type_conge || 'CP',
      jeudi: data.type_jeudi || data.type_conge || 'CP',
      vendredi: data.type_vendredi || data.type_conge || 'CP',
    };

    // Regrouper les jours par type de congé
    const joursParType: Record<string, { lundi: boolean; mardi: boolean; mercredi: boolean; jeudi: boolean; vendredi: boolean }> = {};
    
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;
    
    for (const jour of jours) {
      const cpKey = `cp_${jour}` as keyof typeof data;
      if (data[cpKey]) {
        const type = typesParJour[jour];
        if (!joursParType[type]) {
          joursParType[type] = { lundi: false, mardi: false, mercredi: false, jeudi: false, vendredi: false };
        }
        joursParType[type][jour] = true;
      }
    }

    // Supprimer les anciennes entrées de congé pour cette semaine
    await prisma.salarieCp.deleteMany({
      where: {
        salarie_id,
        annee: data.annee,
        semaine: data.semaine
      }
    });

    // Créer une entrée pour chaque type utilisé
    const results = [];
    for (const [type, joursActifs] of Object.entries(joursParType)) {
      const hasAnyDay = Object.values(joursActifs).some(v => v);
      if (hasAnyDay) {
        const conge = await prisma.salarieCp.create({
          data: {
            salarie_id,
            annee: data.annee,
            semaine: data.semaine,
            type_conge: type as any,
            cp_lundi: joursActifs.lundi,
            cp_mardi: joursActifs.mardi,
            cp_mercredi: joursActifs.mercredi,
            cp_jeudi: joursActifs.jeudi,
            cp_vendredi: joursActifs.vendredi,
            cp_samedi: false,
            cp_dimanche: false,
            motif: data.motif
          }
        });
        results.push(conge);
      }
    }

    res.status(201).json(serializeBigInt(results.length > 0 ? results[0] : { message: 'Aucun congé enregistré' }));
  } catch (error) {
    console.error('Erreur création congé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conges/:id/soumettre - Soumettre une demande
router.post('/:id/soumettre', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const conge = await prisma.salarieCp.update({
      where: { id },
      data: {
        validation_status: 'Soumis'
      }
    });

    res.json(serializeBigInt(conge));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conges/:id/valider - Valider un congé (Manager/Admin)
router.post('/:id/valider', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const conge = await prisma.salarieCp.update({
      where: { id },
      data: {
        validation_status: 'Valide',
        valide_par: req.user!.id,
        date_validation: new Date()
      }
    });

    res.json(serializeBigInt(conge));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conges/:id/rejeter - Rejeter un congé (Manager/Admin)
router.post('/:id/rejeter', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const conge = await prisma.salarieCp.update({
      where: { id },
      data: {
        validation_status: 'Rejete',
        valide_par: req.user!.id,
        date_validation: new Date()
      }
    });

    res.json(serializeBigInt(conge));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/conges/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const conge = await prisma.salarieCp.findUnique({
      where: { id }
    });

    if (!conge) {
      return res.status(404).json({ error: 'Congé non trouvé' });
    }

    if (req.user!.role === 'Salarie' && conge.salarie_id !== req.user!.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (conge.validation_status === 'Valide') {
      return res.status(400).json({ error: 'Impossible de supprimer un congé validé' });
    }

    await prisma.salarieCp.delete({ where: { id } });

    res.json({ message: 'Congé supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;