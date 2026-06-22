import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, managerMiddleware, adminMiddleware, AuthRequest } from '../middlewares/auth';

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
      // Bornes en UTC : évite qu’un fuseau serveur exclue le 1er ou le 31/12 pour l’année demandée.
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lte: new Date(Date.UTC(year, 11, 31))
      };
    }

    const joursFeries = await prisma.jourFerie.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    const mapped = joursFeries.map((j) => ({
      ...j,
      libelle: j.nom,
    }));
    res.json(serializeBigInt(mapped));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conges/jours-feries — Admin : ajouter un jour férié
router.post('/jours-feries', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date, nom } = req.body as { date?: string; nom?: string };
    if (!date || !nom || !String(nom).trim()) {
      return res.status(400).json({ error: 'Date et nom requis' });
    }
    const d = new Date(String(date).slice(0, 10) + 'T12:00:00.000Z');
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: 'Date invalide' });
    }
    const created = await prisma.jourFerie.create({
      data: {
        date: d,
        nom: String(nom).trim().slice(0, 100),
      },
    });
    res.status(201).json(
      serializeBigInt({
        ...created,
        libelle: created.nom,
      })
    );
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Un jour férié existe déjà à cette date' });
    }
    console.error('Erreur création jour férié:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/conges/jours-feries/:id — Admin
router.delete('/jours-feries/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    await prisma.jourFerie.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Jour férié introuvable' });
    }
    console.error('Erreur suppression jour férié:', e);
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

    const validationBlocage = await prisma.validationSemaine.findUnique({
      where: {
        salarie_id_annee_semaine: {
          salarie_id,
          annee: data.annee,
          semaine: data.semaine,
        },
      },
    });
    if (validationBlocage && (validationBlocage.status === 'Soumis' || validationBlocage.status === 'Valide')) {
      return res.status(400).json({
        error: 'Cette semaine est soumise ou validée : vous ne pouvez plus modifier les absences / déplacements.',
      });
    }

    // Si on a des types par jour, créer/mettre à jour les entrées par type
    const typesParJour = {
      lundi: data.type_lundi || data.type_conge || 'CP',
      mardi: data.type_mardi || data.type_conge || 'CP',
      mercredi: data.type_mercredi || data.type_conge || 'CP',
      jeudi: data.type_jeudi || data.type_conge || 'CP',
      vendredi: data.type_vendredi || data.type_conge || 'CP',
      samedi: data.type_samedi || data.type_conge || 'CP',
      dimanche: data.type_dimanche || data.type_conge || 'CP',
    };

    type JoursCp = {
      lundi: boolean;
      mardi: boolean;
      mercredi: boolean;
      jeudi: boolean;
      vendredi: boolean;
      samedi: boolean;
      dimanche: boolean;
    };

    const emptyJours = (): JoursCp => ({
      lundi: false,
      mardi: false,
      mercredi: false,
      jeudi: false,
      vendredi: false,
      samedi: false,
      dimanche: false,
    });

    // Regrouper les jours par type de congé (inclut week-end : déplacements, etc.)
    const joursParType: Record<string, JoursCp> = {};

    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

    for (const jour of jours) {
      const cpKey = `cp_${jour}` as keyof typeof data;
      if (data[cpKey]) {
        const type = typesParJour[jour];
        if (!joursParType[type]) {
          joursParType[type] = emptyJours();
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

    const travailFerieBody = (data as any).travail_ferie as Record<string, boolean> | undefined;

    // Créer une entrée pour chaque type utilisé
    const results = [];
    for (const [type, joursActifs] of Object.entries(joursParType)) {
      const hasAnyDay = Object.values(joursActifs).some(v => v);
      if (hasAnyDay) {
        let motifRow: string | null = data.motif ?? null;
        if (type === 'Deplacement') {
          const tf: Record<string, boolean> = {};
          for (const jour of jours) {
            tf[jour] = !!(travailFerieBody && travailFerieBody[jour]);
          }
          motifRow = JSON.stringify({ chronova_tf: 1, tf });
        }

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
            cp_samedi: joursActifs.samedi,
            cp_dimanche: joursActifs.dimanche,
            motif: motifRow
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