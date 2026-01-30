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

// Obtenir l'année et la semaine courante
function getCurrentWeek(): { annee: number; semaine: number } {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return { annee: now.getFullYear(), semaine: weekNumber };
}

// GET /api/dashboard/stats - Statistiques globales (Admin/Manager)
router.get('/stats', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { annee, semaine } = getCurrentWeek();

    // Nombre de salariés actifs
    const nbSalaries = await prisma.salarie.count({
      where: { actif: true }
    });

    // Nombre de projets en cours
    const nbProjets = await prisma.projet.count({
      where: { 
        actif: true,
        archive: false
      }
    });

    // Nombre de clients actifs
    const nbClients = await prisma.client.count({
      where: { actif: true }
    });

    // Pointages en attente de validation
    const nbPointagesEnAttente = await prisma.validationSemaine.count({
      where: { status: 'Soumis' }
    });

    // Congés en attente
    const nbCongesEnAttente = await prisma.salarieCp.count({
      where: { validation_status: 'Soumis' }
    });

    // Total heures cette semaine
    const heuresSemaine = await prisma.salariePointage.findMany({
      where: { annee, semaine }
    });

    const totalHeuresSemaine = heuresSemaine.reduce((sum, p) => {
      return sum + 
        Number(p.heure_lundi || 0) +
        Number(p.heure_mardi || 0) +
        Number(p.heure_mercredi || 0) +
        Number(p.heure_jeudi || 0) +
        Number(p.heure_vendredi || 0) +
        Number(p.heure_samedi || 0) +
        Number(p.heure_dimanche || 0);
    }, 0);

    res.json({
      nb_salaries: nbSalaries,
      nb_projets: nbProjets,
      nb_clients: nbClients,
      nb_pointages_en_attente: nbPointagesEnAttente,
      nb_conges_en_attente: nbCongesEnAttente,
      total_heures_semaine: totalHeuresSemaine,
      semaine_courante: { annee, semaine }
    });
  } catch (error) {
    console.error('Erreur stats dashboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dashboard/heures-projet - Heures par projet
router.get('/heures-projet', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projets = await prisma.projet.findMany({
      where: { actif: true, archive: false },
      include: {
        client: { select: { nom: true } },
        pointages: true
      }
    });

    const result = projets.map(projet => {
      const heuresRealisees = projet.pointages.reduce((sum, p) => {
        return sum + 
          Number(p.heure_lundi || 0) +
          Number(p.heure_mardi || 0) +
          Number(p.heure_mercredi || 0) +
          Number(p.heure_jeudi || 0) +
          Number(p.heure_vendredi || 0) +
          Number(p.heure_samedi || 0) +
          Number(p.heure_dimanche || 0);
      }, 0);

      return {
        id: projet.id,
        nom: projet.nom,
        code_projet: projet.code_projet,
        client: projet.client?.nom,
        heures_prevues: Number(projet.budget_heures || 0),
        heures_realisees: heuresRealisees,
        pourcentage: projet.budget_heures 
          ? Math.round((heuresRealisees / Number(projet.budget_heures)) * 100) 
          : 0
      };
    });

    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Erreur heures projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dashboard/validations - Validations en attente
router.get('/validations', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const HEURES_SEMAINE_NORMALE = 35;
    
    const validations = await prisma.validationSemaine.findMany({
      where: { status: 'Soumis' },
      include: {
        salarie: {
          select: { id: true, nom: true, prenom: true }
        }
      },
      orderBy: [{ annee: 'asc' }, { semaine: 'asc' }]
    });

    // Pour chaque validation, calculer le total des heures, heures sup, heures dues
    const validationsAvecHeures = await Promise.all(
      validations.map(async (v) => {
        // Récupérer les pointages de la semaine
        const pointages = await prisma.salariePointage.findMany({
          where: {
            salarie_id: v.salarie_id,
            annee: v.annee,
            semaine: v.semaine
          }
        });

        // Calculer le total des heures travaillées
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

        // Récupérer les congés de la semaine pour calculer les heures de maladie
        const conges = await prisma.salarieCp.findMany({
          where: {
            salarie_id: v.salarie_id,
            annee: v.annee,
            semaine: v.semaine,
            type_conge: 'Maladie'
          }
        });

        // Compter les jours de maladie (1 jour = 7h)
        const joursMaladie = conges.reduce((sum, c) => {
          return sum + 
            (c.cp_lundi ? 1 : 0) +
            (c.cp_mardi ? 1 : 0) +
            (c.cp_mercredi ? 1 : 0) +
            (c.cp_jeudi ? 1 : 0) +
            (c.cp_vendredi ? 1 : 0) +
            (c.cp_samedi ? 1 : 0) +
            (c.cp_dimanche ? 1 : 0);
        }, 0);
        const heuresMaladie = joursMaladie * 7;

        // Récupérer le cumul des heures dues de la semaine précédente
        const derniereValidation = await prisma.validationSemaine.findFirst({
          where: {
            salarie_id: v.salarie_id,
            OR: [
              { annee: { lt: v.annee } },
              { 
                annee: v.annee,
                semaine: { lt: v.semaine }
              }
            ],
            status: { in: ['Valide', 'Soumis'] }
          },
          orderBy: [
            { annee: 'desc' },
            { semaine: 'desc' }
          ]
        });

        const cumulHeuresDuesPrecedentes = derniereValidation ? Number(derniereValidation.heures_dues || 0) : 0;

        // Calculer les heures normales requises (35h + cumul précédent)
        const heuresNormalesRequises = HEURES_SEMAINE_NORMALE + cumulHeuresDuesPrecedentes;

        // Calculer les heures dues de cette semaine
        const heuresDuesSemaine = Math.max(0, heuresNormalesRequises - totalHeures);
        const heuresDues = heuresDuesSemaine + heuresMaladie;

        // Calculer les heures en plus
        const heuresEnPlus = Math.max(0, totalHeures - heuresNormalesRequises);

        // Les heures en plus servent d'abord à rattraper les heures dues
        const heuresRattrapees = Math.min(heuresEnPlus, cumulHeuresDuesPrecedentes);
        const heuresSup = Math.max(0, heuresEnPlus - heuresRattrapees);

        return {
          ...v,
          total_heures_travaillees: totalHeures,
          heures_sup: heuresSup,
          heures_dues: heuresDues,
          heures_rattrapees: heuresRattrapees,
          cumul_heures_dues_precedentes: cumulHeuresDuesPrecedentes
        };
      })
    );

    res.json(serializeBigInt(validationsAvecHeures));
  } catch (error) {
    console.error('Erreur validations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dashboard/mes-stats - Stats personnelles du salarié connecté
router.get('/mes-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const salarie_id = req.user!.id;
    const { annee, semaine } = getCurrentWeek();

    // Heures cette semaine
    const pointagesSemaine = await prisma.salariePointage.findMany({
      where: { salarie_id, annee, semaine }
    });

    const heuresSemaine = pointagesSemaine.reduce((sum, p) => {
      return sum + 
        Number(p.heure_lundi || 0) +
        Number(p.heure_mardi || 0) +
        Number(p.heure_mercredi || 0) +
        Number(p.heure_jeudi || 0) +
        Number(p.heure_vendredi || 0) +
        Number(p.heure_samedi || 0) +
        Number(p.heure_dimanche || 0);
    }, 0);

    // Validation de la semaine
    const validationSemaine = await prisma.validationSemaine.findUnique({
      where: {
        salarie_id_annee_semaine: { salarie_id, annee, semaine }
      }
    });

    // Projets affectés
    const affectations = await prisma.tacheProjetSalarie.findMany({
      where: { salarie_id, actif: true },
      include: {
        projet: { select: { id: true, nom: true, code_projet: true } }
      }
    });

    const projets = [...new Set(affectations.map(a => a.projet))];

    // Heures ce mois
    const debutMois = new Date();
    debutMois.setDate(1);
    const finMois = new Date(debutMois.getFullYear(), debutMois.getMonth() + 1, 0);

    const pointagesMois = await prisma.salariePointage.findMany({
      where: {
        salarie_id,
        annee: debutMois.getFullYear(),
        date_lundi: {
          gte: debutMois,
          lte: finMois
        }
      }
    });

    const heuresMois = pointagesMois.reduce((sum, p) => {
      return sum + 
        Number(p.heure_lundi || 0) +
        Number(p.heure_mardi || 0) +
        Number(p.heure_mercredi || 0) +
        Number(p.heure_jeudi || 0) +
        Number(p.heure_vendredi || 0) +
        Number(p.heure_samedi || 0) +
        Number(p.heure_dimanche || 0);
    }, 0);

    res.json({
      heures_semaine: heuresSemaine,
      heures_mois: heuresMois,
      status_semaine: validationSemaine?.status || 'Brouillon',
      nb_projets: projets.length,
      projets: serializeBigInt(projets),
      semaine_courante: { annee, semaine }
    });
  } catch (error) {
    console.error('Erreur mes stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dashboard/notifications - Notifications (toutes, pas seulement non lues)
router.get('/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { 
        salarie_id: req.user!.id
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    res.json(serializeBigInt(notifications));
  } catch (error) {
    console.error('Erreur récupération notifications:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/dashboard/notifications/:id/lue - Marquer comme lue
router.put('/notifications/:id/lue', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    await prisma.notification.update({
      where: { id },
      data: { lu: true }
    });

    res.json({ message: 'Notification marquée comme lue' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;