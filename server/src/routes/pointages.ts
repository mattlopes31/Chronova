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

    console.log('=== GET pointages semaine ===');
    console.log('Salarié:', salarie_id.toString(), 'Année:', annee, 'Semaine:', semaine);

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

    console.log('Pointages trouvés:', pointages.length);
    
    // Ajouter tache_type_id et projet_id explicitement pour le frontend
    const pointagesAvecIds = pointages.map(p => ({
      ...p,
      projet_id: p.projet_id.toString(),
      tache_type_id: p.tache_type_id.toString(),
    }));

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

    // Récupérer TOUS les congés de la semaine (peut y avoir plusieurs types)
    const congesListe = await prisma.salarieCp.findMany({
      where: {
        salarie_id,
        annee,
        semaine
      }
    });

    // Fusionner les congés par jour avec leur type
    const congesFusionnes = {
      cp_lundi: false,
      cp_mardi: false,
      cp_mercredi: false,
      cp_jeudi: false,
      cp_vendredi: false,
      type_lundi: 'CP',
      type_mardi: 'CP',
      type_mercredi: 'CP',
      type_jeudi: 'CP',
      type_vendredi: 'CP',
      type_conge: 'CP' // Compatibilité
    };

    for (const conge of congesListe) {
      if (conge.cp_lundi) {
        congesFusionnes.cp_lundi = true;
        congesFusionnes.type_lundi = conge.type_conge;
      }
      if (conge.cp_mardi) {
        congesFusionnes.cp_mardi = true;
        congesFusionnes.type_mardi = conge.type_conge;
      }
      if (conge.cp_mercredi) {
        congesFusionnes.cp_mercredi = true;
        congesFusionnes.type_mercredi = conge.type_conge;
      }
      if (conge.cp_jeudi) {
        congesFusionnes.cp_jeudi = true;
        congesFusionnes.type_jeudi = conge.type_conge;
      }
      if (conge.cp_vendredi) {
        congesFusionnes.cp_vendredi = true;
        congesFusionnes.type_vendredi = conge.type_conge;
      }
    }

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

    // Récupérer le cumul des heures dues des semaines précédentes
    // On prend la dernière semaine validée OU soumise pour avoir le cumul le plus récent
    const derniereValidation = await prisma.validationSemaine.findFirst({
      where: {
        salarie_id,
        status: { in: ['Valide', 'Soumis'] }, // Prendre aussi les semaines soumises pour avoir le cumul le plus récent
        OR: [
          { annee: { lt: annee } },
          { annee: annee, semaine: { lt: semaine } }
        ]
      },
      orderBy: [
        { annee: 'desc' },
        { semaine: 'desc' }
      ]
    });

    // Le cumul est stocké dans heures_dues de la dernière validation
    // Chaque semaine stocke son cumul final (cumul précédent + heures dues de la semaine - heures rattrapées)
    const cumulHeuresDues = derniereValidation ? Number(derniereValidation.heures_dues || 0) : 0;
    
    console.log('=== GET cumul heures dues ===');
    console.log('Semaine:', annee, semaine);
    console.log('Dernière validation trouvée:', derniereValidation ? {
      annee: derniereValidation.annee,
      semaine: derniereValidation.semaine,
      status: derniereValidation.status,
      heures_dues: derniereValidation.heures_dues?.toString()
    } : 'Aucune');
    console.log('Cumul récupéré:', cumulHeuresDues);

    res.json({
      pointages: serializeBigInt(pointagesAvecIds),
      validation: validation ? serializeBigInt(validation) : null,
      conges: congesListe.length > 0 ? congesFusionnes : null,
      jours_feries: serializeBigInt(joursFeries),
      cumul_heures_dues: cumulHeuresDues,
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

    console.log('=== POST /api/pointages ===');
    console.log('Salarié ID:', salarie_id.toString());
    console.log('Données reçues:', JSON.stringify(data, null, 2));

    if (!data.projet_id || !data.tache_type_id || !data.annee || !data.semaine) {
      console.error('Données manquantes:', { 
        projet_id: data.projet_id, 
        tache_type_id: data.tache_type_id, 
        annee: data.annee, 
        semaine: data.semaine 
      });
      return res.status(400).json({ 
        error: 'Projet, type de tâche, année et semaine requis' 
      });
    }

    // Calculer les dates de la semaine
    const monday = getMondayOfWeek(data.annee, data.semaine);

    console.log('Tentative upsert avec:', {
      salarie_id: salarie_id.toString(),
      projet_id: data.projet_id,
      tache_type_id: data.tache_type_id,
      annee: data.annee,
      semaine: data.semaine
    });

    // Vérifier si un pointage existe déjà et son statut
    const pointageExistant = await prisma.salariePointage.findUnique({
      where: {
        salarie_id_projet_id_tache_type_id_annee_semaine: {
          salarie_id,
          projet_id: BigInt(data.projet_id),
          tache_type_id: BigInt(data.tache_type_id),
          annee: data.annee,
          semaine: data.semaine
        }
      }
    });

    // Si le pointage existe et est validé, on ne peut pas le modifier
    if (pointageExistant && pointageExistant.validation_status === 'Valide') {
      console.warn('Tentative de modification d\'un pointage validé');
      return res.status(400).json({ 
        error: 'Impossible de modifier un pointage validé' 
      });
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      heure_lundi: data.heure_lundi || 0,
      heure_mardi: data.heure_mardi || 0,
      heure_mercredi: data.heure_mercredi || 0,
      heure_jeudi: data.heure_jeudi || 0,
      heure_vendredi: data.heure_vendredi || 0,
      heure_samedi: data.heure_samedi || 0,
      heure_dimanche: data.heure_dimanche || 0,
      commentaire: data.commentaire
    };

    // Réinitialiser le statut à Brouillon si on modifie un pointage soumis
    if (pointageExistant && pointageExistant.validation_status === 'Soumis') {
      updateData.validation_status = 'Brouillon';
      console.log('Réinitialisation du statut à Brouillon pour pointage soumis');
    }

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
      update: updateData,
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

    console.log('Pointage sauvegardé avec succès:', {
      id: pointage.id.toString(),
      projet_id: pointage.projet_id.toString(),
      tache_type_id: pointage.tache_type_id.toString()
    });

    res.json(serializeBigInt(pointage));
  } catch (error) {
    console.error('Erreur création pointage:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/pointages/soumettre - Soumettre une semaine pour validation
router.post('/soumettre', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { annee, semaine } = req.body;
    const salarie_id = req.user!.id;

    console.log('=== POST /api/pointages/soumettre ===');
    console.log('Salarié ID:', salarie_id.toString(), 'Année:', annee, 'Semaine:', semaine);

    // Calculer le total des heures travaillées
    const pointages = await prisma.salariePointage.findMany({
      where: { salarie_id, annee, semaine }
    });

    console.log('Pointages trouvés pour soumission:', pointages.length);

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

    // Récupérer les congés pour calculer le total de la semaine (CP, déplacement, formation comptent comme heures travaillées)
    const conges = await prisma.salarieCp.findMany({
      where: { salarie_id, annee, semaine }
    });

    // Calculer les heures de congés payés, déplacements, formation (comptent comme heures travaillées)
    const HEURES_PAR_JOUR = 7;
    let heuresCP = 0;
    let heuresDeplacement = 0;
    let heuresFormation = 0;
    let heuresMaladie = 0;

    for (const conge of conges) {
      if (conge.type_conge === 'CP' || conge.type_conge === 'RTT') {
        if (conge.cp_lundi) heuresCP += HEURES_PAR_JOUR;
        if (conge.cp_mardi) heuresCP += HEURES_PAR_JOUR;
        if (conge.cp_mercredi) heuresCP += HEURES_PAR_JOUR;
        if (conge.cp_jeudi) heuresCP += HEURES_PAR_JOUR;
        if (conge.cp_vendredi) heuresCP += HEURES_PAR_JOUR;
      } else if (conge.type_conge === 'Deplacement') {
        if (conge.cp_lundi) heuresDeplacement += HEURES_PAR_JOUR;
        if (conge.cp_mardi) heuresDeplacement += HEURES_PAR_JOUR;
        if (conge.cp_mercredi) heuresDeplacement += HEURES_PAR_JOUR;
        if (conge.cp_jeudi) heuresDeplacement += HEURES_PAR_JOUR;
        if (conge.cp_vendredi) heuresDeplacement += HEURES_PAR_JOUR;
      } else if (conge.type_conge === 'Formation') {
        if (conge.cp_lundi) heuresFormation += HEURES_PAR_JOUR;
        if (conge.cp_mardi) heuresFormation += HEURES_PAR_JOUR;
        if (conge.cp_mercredi) heuresFormation += HEURES_PAR_JOUR;
        if (conge.cp_jeudi) heuresFormation += HEURES_PAR_JOUR;
        if (conge.cp_vendredi) heuresFormation += HEURES_PAR_JOUR;
      } else if (conge.type_conge === 'Maladie') {
        if (conge.cp_lundi) heuresMaladie += HEURES_PAR_JOUR;
        if (conge.cp_mardi) heuresMaladie += HEURES_PAR_JOUR;
        if (conge.cp_mercredi) heuresMaladie += HEURES_PAR_JOUR;
        if (conge.cp_jeudi) heuresMaladie += HEURES_PAR_JOUR;
        if (conge.cp_vendredi) heuresMaladie += HEURES_PAR_JOUR;
      }
    }

    // Total de la semaine = heures travaillées + CP + déplacement + formation
    const totalSemaine = totalHeures + heuresCP + heuresDeplacement + heuresFormation;
    
    // Récupérer le cumul des heures dues des semaines précédentes
    // On prend la dernière semaine validée OU soumise pour avoir le cumul le plus récent
    const derniereValidation = await prisma.validationSemaine.findFirst({
      where: {
        salarie_id,
        status: { in: ['Valide', 'Soumis'] },
        OR: [
          { annee: { lt: annee } },
          { annee: annee, semaine: { lt: semaine } }
        ]
      },
      orderBy: [
        { annee: 'desc' },
        { semaine: 'desc' }
      ]
    });

    // Le cumul est stocké dans heures_dues de la dernière validation
    // Chaque semaine stocke son cumul final, donc on prend simplement ce cumul
    const cumulHeuresDuesPrecedentes = derniereValidation ? Number(derniereValidation.heures_dues || 0) : 0;
    
    console.log('=== POST soumettre - Calcul cumul ===');
    console.log('Semaine:', annee, semaine);
    console.log('Dernière validation trouvée:', derniereValidation ? {
      annee: derniereValidation.annee,
      semaine: derniereValidation.semaine,
      status: derniereValidation.status,
      heures_dues: derniereValidation.heures_dues?.toString()
    } : 'Aucune');
    console.log('Cumul précédent:', cumulHeuresDuesPrecedentes);

    // Les heures normales requises = 35h + cumul heures dues précédentes
    // Exemple : si cumul = 5h, alors il faut faire 35h + 5h = 40h cette semaine
    const HEURES_SEMAINE_NORMALE = 35;
    const heuresNormalesRequises = HEURES_SEMAINE_NORMALE + cumulHeuresDuesPrecedentes;

    // Calculer les heures dues de cette semaine
    // Si totalSemaine < heures normales requises, les heures manquantes deviennent des heures dues
    const heuresDuesSemaine = Math.max(0, heuresNormalesRequises - totalSemaine);
    
    // Les heures de maladie s'ajoutent aussi aux heures dues
    const heuresDues = heuresDuesSemaine + heuresMaladie;
    
    // Calculer combien d'heures en plus on a fait par rapport aux heures normales requises
    const heuresEnPlus = Math.max(0, totalSemaine - heuresNormalesRequises);
    
    // Les heures en plus servent D'ABORD à rattraper les heures dues
    // Seulement après avoir rattrapé tout le cumul, les heures restantes deviennent des heures sup
    const heuresRattrapees = Math.min(heuresEnPlus, cumulHeuresDuesPrecedentes);
    const heuresSup = Math.max(0, heuresEnPlus - heuresRattrapees); // Heures sup seulement après rattrapage
    
    // Calculer le nouveau cumul (heures dues de cette semaine + cumul précédent - heures rattrapées)
    const nouveauCumulHeuresDues = Math.max(0, cumulHeuresDuesPrecedentes + heuresDues - heuresRattrapees);
    
    console.log('Calcul heures dues:', {
      totalSemaine,
      heuresNormalesRequises,
      heuresDuesSemaine,
      heuresMaladie,
      heuresDues,
      cumulHeuresDuesPrecedentes,
      heuresSup,
      heuresRattrapees,
      nouveauCumulHeuresDues
    });

    // Créer ou mettre à jour la validation avec le nouveau cumul dans heures_dues
    const validation = await prisma.validationSemaine.upsert({
      where: {
        salarie_id_annee_semaine: { salarie_id, annee, semaine }
      },
      update: {
        status: 'Soumis',
        total_heures: totalSemaine, // Total incluant CP, déplacement, formation
        heures_dues: nouveauCumulHeuresDues, // On stocke le nouveau cumul, pas juste les heures dues de la semaine
        date_soumission: new Date()
      },
      create: {
        salarie_id,
        annee,
        semaine,
        status: 'Soumis',
        total_heures: totalSemaine,
        heures_dues: nouveauCumulHeuresDues, // On stocke le nouveau cumul
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

    // Récupérer la validation actuelle pour avoir les heures dues calculées
    const validationActuelle = await prisma.validationSemaine.findUnique({
      where: {
        salarie_id_annee_semaine: {
          salarie_id: BigInt(salarie_id),
          annee,
          semaine
        }
      }
    });

    // Le cumul est déjà calculé et stocké dans heures_dues lors de la soumission
    // On le garde tel quel lors de la validation
    const nouveauCumul = validationActuelle ? Number(validationActuelle.heures_dues || 0) : 0;

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
        commentaire_validation: commentaire,
        heures_dues: nouveauCumul // On garde le cumul calculé lors de la soumission
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

    // Créer une notification pour le salarié
    try {
      await prisma.notification.create({
        data: {
          salarie_id: BigInt(salarie_id),
          titre: `Pointage validé - Semaine ${semaine}/${annee}`,
          message: `Votre pointage pour la semaine ${semaine} de ${annee} a été validé.`,
          type: 'success',
          lien: `/pointage?annee=${annee}&semaine=${semaine}`,
        }
      });
      console.log(`Notification créée pour le salarié ${salarie_id}, semaine ${semaine}/${annee}`);
    } catch (notifError) {
      console.error('Erreur création notification:', notifError);
      // Ne pas faire échouer la requête si la notification échoue
    }

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

    // Créer une notification pour le salarié
    try {
      await prisma.notification.create({
        data: {
          salarie_id: BigInt(salarie_id),
          titre: `Pointage rejeté - Semaine ${semaine}/${annee}`,
          message: `Votre pointage pour la semaine ${semaine} de ${annee} a été rejeté. Motif : ${commentaire}`,
          type: 'warning',
          lien: `/pointage?annee=${annee}&semaine=${semaine}`,
        }
      });
      console.log(`Notification créée pour le salarié ${salarie_id}, semaine ${semaine}/${annee}`);
    } catch (notifError) {
      console.error('Erreur création notification:', notifError);
      // Ne pas faire échouer la requête si la notification échoue
    }

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