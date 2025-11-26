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

// Calculer le lundi d'une semaine ISO
function getMondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

// GET /api/pointages - Liste des pointages
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { salarie_id, projet_id, annee, semaine, status } = req.query;

    const where: any = {};
    
    // Si pas admin/manager, on ne voit que ses propres pointages
    if (req.user!.role === 'Salarie') {
      where.salarie_id = req.user!.id;
    } else if (salarie_id) {
      where.salarie_id = BigInt(salarie_id as string);
    }
    
    if (projet_id) where.projet_id = BigInt(projet_id as string);
    if (annee) where.annee = parseInt(annee as string);
    if (semaine) where.semaine = parseInt(semaine as string);
    if (status) where.validation_status = status;

    const pointages = await prisma.salariePointage.findMany({
      where,
      include: {
        salarie: {
          select: { id: true, nom: true, prenom: true }
        },
        projet: {
          select: { id: true, nom: true, code_projet: true }
        },
        tache_type: {
          select: { id: true, tache_type: true, code: true, couleur: true }
        },
        validateur: {
          select: { id: true, nom: true, prenom: true }
        }
      },
      orderBy: [{ annee: 'desc' }, { semaine: 'desc' }]
    });

    res.json(serializeBigInt(pointages));
  } catch (error) {
    console.error('Erreur liste pointages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pointages/semaine/:annee/:semaine - Pointages d'une semaine pour le salarié connecté
router.get('/semaine/:annee/:semaine', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const annee = parseInt(req.params.annee);
    const semaine = parseInt(req.params.semaine);
    const salarie_id = req.user!.id;

    const pointages = await prisma.salariePointage.findMany({
      where: {
        salarie_id,
        annee,
        semaine
      },
      include: {
        projet: {
          select: { id: true, nom: true, code_projet: true }
        },
        tache_type: {
          select: { id: true, tache_type: true, code: true, couleur: true }
        }
      }
    });

    // Récupérer la validation de la semaine
    const validation = await prisma.validationSemaine.findUnique({
      where: {
        salarie_id_annee_semaine: {
          salarie_id,
          annee,
          semaine
        }
      }
    });

    // Récupérer les jours fériés de la semaine
    const monday = getMondayOfWeek(annee, semaine);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const joursFeries = await prisma.jourFerie.findMany({
      where: {
        date: {
          gte: monday,
          lte: sunday
        }
      }
    });

    res.json({
      pointages: serializeBigInt(pointages),
      validation: validation ? serializeBigInt(validation) : null,
      jours_feries: serializeBigInt(joursFeries),
      dates: {
        lundi: monday.toISOString().split('T')[0],
        dimanche: sunday.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Erreur pointages semaine:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pointages - Créer ou mettre à jour un pointage
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    const salarie_id = req.user!.id;

    if (!data.projet_id || !data.tache_type_id || !data.annee || !data.semaine) {
      return res.status(400).json({ 
        error: 'Projet, type de tâche, année et semaine requis' 
      });
    }

    // Calculer les dates de la semaine
    const monday = getMondayOfWeek(data.annee, data.semaine);

    const pointage = await prisma.salariePointage.upsert({
      where: {
        salarie_id_projet_id_tache_type_id_annee_semaine: {
          salarie_id,
          projet_id: BigInt(data.projet_id),
          tache_type_id: BigInt(data.tache_type_id),
          annee: data.annee,
          semaine: data.semaine
        }
      },
      update: {
        heure_lundi: data.heure_lundi || 0,
        heure_mardi: data.heure_mardi || 0,
        heure_mercredi: data.heure_mercredi || 0,
        heure_jeudi: data.heure_jeudi || 0,
        heure_vendredi: data.heure_vendredi || 0,
        heure_samedi: data.heure_samedi || 0,
        heure_dimanche: data.heure_dimanche || 0,
        commentaire: data.commentaire
      },
      create: {
        salarie_id,
        projet_id: BigInt(data.projet_id),
        tache_type_id: BigInt(data.tache_type_id),
        annee: data.annee,
        semaine: data.semaine,
        heure_lundi: data.heure_lundi || 0,
        heure_mardi: data.heure_mardi || 0,
        heure_mercredi: data.heure_mercredi || 0,
        heure_jeudi: data.heure_jeudi || 0,
        heure_vendredi: data.heure_vendredi || 0,
        heure_samedi: data.heure_samedi || 0,
        heure_dimanche: data.heure_dimanche || 0,
        date_lundi: monday,
        date_mardi: new Date(monday.getTime() + 1 * 24 * 60 * 60 * 1000),
        date_mercredi: new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000),
        date_jeudi: new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000),
        date_vendredi: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000),
        date_samedi: new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000),
        date_dimanche: new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000),
        commentaire: data.commentaire
      },
      include: {
        projet: { select: { id: true, nom: true } },
        tache_type: { select: { id: true, tache_type: true } }
      }
    });

    res.json(serializeBigInt(pointage));
  } catch (error) {
    console.error('Erreur création pointage:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pointages/soumettre - Soumettre une semaine pour validation
router.post('/soumettre', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { annee, semaine } = req.body;
    const salarie_id = req.user!.id;

    // Calculer le total des heures
    const pointages = await prisma.salariePointage.findMany({
      where: { salarie_id, annee, semaine }
    });

    const totalHeures = pointages.reduce((sum, p) => {
      return sum + 
        Number(p.heure_lundi || 0) +
        Number(p.heure_mardi || 0) +
        Number(p.heure_mercredi || 0) +
        Number(p.heure_jeudi || 0) +
        Number(p.heure_vendredi || 0) +
        Number(p.heure_samedi || 0) +
        Number(p.heure_dimanche || 0);
    }, 0);

    // Créer ou mettre à jour la validation
    const validation = await prisma.validationSemaine.upsert({
      where: {
        salarie_id_annee_semaine: { salarie_id, annee, semaine }
      },
      update: {
        status: 'Soumis',
        total_heures: totalHeures,
        date_soumission: new Date()
      },
      create: {
        salarie_id,
        annee,
        semaine,
        status: 'Soumis',
        total_heures: totalHeures,
        date_soumission: new Date()
      }
    });

    // Mettre à jour le statut des pointages
    await prisma.salariePointage.updateMany({
      where: { salarie_id, annee, semaine },
      data: { validation_status: 'Soumis' }
    });

    res.json(serializeBigInt(validation));
  } catch (error) {
    console.error('Erreur soumission:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pointages/valider - Valider une semaine (Manager/Admin)
router.post('/valider', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { salarie_id, annee, semaine, commentaire } = req.body;

    const validation = await prisma.validationSemaine.update({
      where: {
        salarie_id_annee_semaine: {
          salarie_id: BigInt(salarie_id),
          annee,
          semaine
        }
      },
      data: {
        status: 'Valide',
        valide_par: req.user!.id,
        date_validation: new Date(),
        commentaire_validation: commentaire
      }
    });

    // Mettre à jour les pointages
    await prisma.salariePointage.updateMany({
      where: { 
        salarie_id: BigInt(salarie_id), 
        annee, 
        semaine 
      },
      data: { 
        validation_status: 'Valide',
        valide_par: req.user!.id,
        date_validation: new Date()
      }
    });

    res.json(serializeBigInt(validation));
  } catch (error) {
    console.error('Erreur validation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pointages/rejeter - Rejeter une semaine (Manager/Admin)
router.post('/rejeter', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { salarie_id, annee, semaine, commentaire } = req.body;

    if (!commentaire) {
      return res.status(400).json({ error: 'Commentaire requis pour le rejet' });
    }

    const validation = await prisma.validationSemaine.update({
      where: {
        salarie_id_annee_semaine: {
          salarie_id: BigInt(salarie_id),
          annee,
          semaine
        }
      },
      data: {
        status: 'Rejete',
        valide_par: req.user!.id,
        date_validation: new Date(),
        commentaire_validation: commentaire
      }
    });

    // Mettre à jour les pointages
    await prisma.salariePointage.updateMany({
      where: { 
        salarie_id: BigInt(salarie_id), 
        annee, 
        semaine 
      },
      data: { 
        validation_status: 'Rejete',
        valide_par: req.user!.id,
        date_validation: new Date()
      }
    });

    res.json(serializeBigInt(validation));
  } catch (error) {
    console.error('Erreur rejet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/pointages/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    const pointage = await prisma.salariePointage.findUnique({
      where: { id }
    });

    if (!pointage) {
      return res.status(404).json({ error: 'Pointage non trouvé' });
    }

    // Vérifier les droits
    if (req.user!.role === 'Salarie' && pointage.salarie_id !== req.user!.id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Ne pas supprimer si validé
    if (pointage.validation_status === 'Valide') {
      return res.status(400).json({ error: 'Impossible de supprimer un pointage validé' });
    }

    await prisma.salariePointage.delete({ where: { id } });

    res.json({ message: 'Pointage supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
