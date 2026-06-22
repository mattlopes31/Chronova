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

// Tente de lier une tâche "custom" à un type global existant (sinon crée un type global).
async function resolveTacheTypeId(
  tx: any,
  data: { code?: string | null; nom_tache?: string | null; couleur?: string | null }
): Promise<bigint | null> {
  const code = (data.code || '').trim();
  const nom = (data.nom_tache || '').trim();
  const nomFinal = nom || code;
  const couleurFinal = (data.couleur || '').trim() || '#10B981';

  if (code) {
    const byCode = await tx.tacheType.findFirst({
      where: { code },
      select: { id: true }
    });
    if (byCode) return byCode.id;

    // Match robuste: ignorer les zéros de tête (ex: "31" <-> "031")
    const byCodeNormalized = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM tache_type
      WHERE TRIM(LEADING '0' FROM TRIM(code)) = TRIM(LEADING '0' FROM TRIM(${code}))
      LIMIT 1
    `;
    if (byCodeNormalized?.[0]?.id) return byCodeNormalized[0].id;
  }

  if (nom) {
    const byName = await tx.tacheType.findFirst({
      where: { tache_type: nom },
      select: { id: true }
    });
    if (byName) return byName.id;

    const byNameCI = await tx.tacheType.findFirst({
      where: { tache_type: { equals: nom, mode: 'insensitive' } },
      select: { id: true }
    });
    if (byNameCI) return byNameCI.id;
  }

  // Si aucune correspondance : créer un type global à partir de la tâche.
  // En pratique on préfère `nom`, mais si il est NULL on utilise `code` pour ne pas bloquer le pointage.
  if (code) {
    try {
      const created = await tx.tacheType.create({
        data: {
          tache_type: nomFinal,
          code,
          couleur: couleurFinal,
          is_default: false,
          is_facturable: true,
          ordre: 0,
          actif: true
        }
      });
      return created.id;
    } catch (err: any) {
      // Contrainte unique sur `code` possible: re-lire par code.
      const byCodeAfter = await tx.tacheType.findFirst({
        where: { code },
        select: { id: true }
      });
      return byCodeAfter?.id ?? null;
    }
  }

  return null;
}

/**
 * Lundi de la semaine ISO (lundi = premier jour), aligné sur la même règle que le client (date-fns, semaine contenant le 4 janvier).
 * Stockage en **UTC minuit** sur le jour civil du lundi : évite qu'en Europe (ex. Paris) `new Date(y,m,d)` soit interprété
 * en UTC comme la veille dans MySQL DATE, ce qui décalait tout le calendrier d’un jour.
 */
function getMondayOfWeek(year: number, week: number): Date {
  const jan4Utc = Date.UTC(year, 0, 4);
  const jan4 = new Date(jan4Utc);
  const offsetDaysSinceMonday = (jan4.getUTCDay() + 6) % 7;
  const week1MondayUtc = jan4Utc - offsetDaysSinceMonday * 24 * 60 * 60 * 1000;
  const mondayUtc = week1MondayUtc + (week - 1) * 7 * 24 * 60 * 60 * 1000;
  return new Date(mondayUtc);
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateKeyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const JOURS_POINTAGE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

function motifDeclaresTravailFerie(motif: string | null | undefined): boolean {
  if (!motif || typeof motif !== 'string') return false;
  try {
    const o = JSON.parse(motif);
    return o?.chronova_tf === 1;
  } catch {
    return false;
  }
}

function parseTravailFerieDepMotif(
  motif: string | null | undefined
): Record<(typeof JOURS_POINTAGE)[number], boolean> {
  const def: Record<(typeof JOURS_POINTAGE)[number], boolean> = {
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false,
  };
  if (!motifDeclaresTravailFerie(motif)) return def;
  try {
    const o = JSON.parse(motif as string);
    const tf = o?.tf;
    if (!tf || typeof tf !== 'object') return def;
    for (const j of JOURS_POINTAGE) {
      if (tf[j] === true) def[j] = true;
    }
  } catch {
    /* ignore */
  }
  return def;
}

/** Crédit 7h par férié non travaillé ; heures saisies sur fériés = heures sup (hors objectif). */
function computeFerieSemaineServer(
  monday: Date,
  heuresParJour: Record<string, number>,
  joursFeries: { date: Date }[],
  heuresCredit = 7
) {
  const keys = new Set(
    joursFeries.map((j) => {
      const d = j.date instanceof Date ? j.date : new Date(j.date as string);
      return dateKeyUtc(d);
    })
  );
  let nbFeries = 0;
  let creditFerie = 0;
  let heuresTravailJoursFeries = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDaysUTC(monday, i);
    if (!keys.has(dateKeyUtc(d))) continue;
    nbFeries += 1;
    const jour = JOURS_POINTAGE[i];
    const h = Number(heuresParJour[jour] || 0);
    if (h <= 0) creditFerie += heuresCredit;
    else heuresTravailJoursFeries += h;
  }
  const heuresTravaillees = JOURS_POINTAGE.reduce((s, j) => s + Number(heuresParJour[j] || 0), 0);
  const heuresTravailSansFerie = heuresTravaillees - heuresTravailJoursFeries;
  return { nbFeries, creditFerie, heuresTravailJoursFeries, heuresTravailSansFerie, heuresTravaillees };
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
      cp_samedi: false,
      cp_dimanche: false,
      type_lundi: 'CP',
      type_mardi: 'CP',
      type_mercredi: 'CP',
      type_jeudi: 'CP',
      type_vendredi: 'CP',
      type_samedi: 'CP',
      type_dimanche: 'CP',
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
      if (conge.cp_samedi) {
        congesFusionnes.cp_samedi = true;
        congesFusionnes.type_samedi = conge.type_conge;
      }
      if (conge.cp_dimanche) {
        congesFusionnes.cp_dimanche = true;
        congesFusionnes.type_dimanche = conge.type_conge;
      }
    }

    const depCongeFusion = congesListe.find((c) => c.type_conge === 'Deplacement');
    const tfFusion = parseTravailFerieDepMotif(depCongeFusion?.motif ?? null);
    for (const j of JOURS_POINTAGE) {
      (congesFusionnes as any)[`travail_ferie_${j}`] = tfFusion[j];
    }

    // Récupérer les jours fériés de la semaine
    const monday = getMondayOfWeek(annee, semaine);
    const sunday = addDaysUTC(monday, 6);

    const joursFeries = await prisma.jourFerie.findMany({
      where: {
        date: {
          gte: monday,
          lte: sunday
        }
      }
    });

    res.json({
      pointages: serializeBigInt(pointagesAvecIds),
      validation: validation ? serializeBigInt(validation) : null,
      conges: congesListe.length > 0 ? congesFusionnes : null,
      jours_feries: serializeBigInt(
        joursFeries.map((j) => ({
          ...j,
          libelle: j.nom,
        }))
      ),
      cumul_heures_dues: 0,
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

    if (!data.projet_id || !data.annee || !data.semaine || (!data.tache_type_id && !data.tache_projet_id)) {
      console.error('Données manquantes:', { 
        projet_id: data.projet_id, 
        tache_type_id: data.tache_type_id,
        tache_projet_id: data.tache_projet_id,
        annee: data.annee, 
        semaine: data.semaine 
      });
      return res.status(400).json({ 
        error: 'Projet, année et semaine requis. Fournir soit tache_type_id, soit tache_projet_id.' 
      });
    }

    // Résolution de tache_type_id si seulement tache_projet_id est fourni.
    let finalTacheTypeId: bigint | null = data.tache_type_id ? BigInt(data.tache_type_id) : null;
    if (!finalTacheTypeId && data.tache_projet_id) {
      const tpId = BigInt(data.tache_projet_id);
      const tacheProjet = await prisma.tacheProjet.findUnique({
        where: { id: tpId },
        select: { id: true, tache_type_id: true, code: true, nom_tache: true, couleur: true }
      });

      if (!tacheProjet) {
        return res.status(400).json({ error: 'tache_projet_id invalide' });
      }

      finalTacheTypeId = tacheProjet.tache_type_id;
      if (!finalTacheTypeId) {
        finalTacheTypeId = await prisma.$transaction(async (tx) => {
          return resolveTacheTypeId(tx, {
            code: tacheProjet.code,
            nom_tache: tacheProjet.nom_tache,
            couleur: tacheProjet.couleur
          });
        });
      }
    }

    if (!finalTacheTypeId) {
      return res.status(400).json({ error: 'Impossible de résoudre tache_type_id' });
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
        error: 'Cette semaine est soumise ou validée : vous ne pouvez plus modifier le pointage.',
      });
    }

    // Calculer les dates de la semaine
    const monday = getMondayOfWeek(data.annee, data.semaine);

    console.log('Tentative upsert avec:', {
      salarie_id: salarie_id.toString(),
      projet_id: data.projet_id,
      tache_type_id: finalTacheTypeId.toString(),
      annee: data.annee,
      semaine: data.semaine
    });

    // Vérifier si un pointage existe déjà et son statut
    const pointageExistant = await prisma.salariePointage.findUnique({
      where: {
        salarie_id_projet_id_tache_type_id_annee_semaine: {
          salarie_id,
          projet_id: BigInt(data.projet_id),
          tache_type_id: finalTacheTypeId,
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

    // Jours fériés : heures sur un férié uniquement si déplacement coché ce jour-là
    const weekPointages = await prisma.salariePointage.findMany({
      where: { salarie_id, annee: data.annee, semaine: data.semaine },
    });
    const hSim: Record<string, number> = {
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
    };
    const curProjet = BigInt(data.projet_id);
    for (const p of weekPointages) {
      const sameLine = p.projet_id === curProjet && p.tache_type_id === finalTacheTypeId;
      if (sameLine) continue;
      hSim.lundi += Number(p.heure_lundi || 0);
      hSim.mardi += Number(p.heure_mardi || 0);
      hSim.mercredi += Number(p.heure_mercredi || 0);
      hSim.jeudi += Number(p.heure_jeudi || 0);
      hSim.vendredi += Number(p.heure_vendredi || 0);
      hSim.samedi += Number(p.heure_samedi || 0);
      hSim.dimanche += Number(p.heure_dimanche || 0);
    }
    hSim.lundi += Number(data.heure_lundi || 0);
    hSim.mardi += Number(data.heure_mardi || 0);
    hSim.mercredi += Number(data.heure_mercredi || 0);
    hSim.jeudi += Number(data.heure_jeudi || 0);
    hSim.vendredi += Number(data.heure_vendredi || 0);
    hSim.samedi += Number(data.heure_samedi || 0);
    hSim.dimanche += Number(data.heure_dimanche || 0);

    const congesPourValid = await prisma.salarieCp.findMany({
      where: { salarie_id, annee: data.annee, semaine: data.semaine },
    });
    const dep: Record<(typeof JOURS_POINTAGE)[number], boolean> = {
      lundi: false,
      mardi: false,
      mercredi: false,
      jeudi: false,
      vendredi: false,
      samedi: false,
      dimanche: false,
    };
    const depCongeValid = congesPourValid.find((c) => c.type_conge === 'Deplacement');
    for (const c of congesPourValid) {
      if (c.type_conge !== 'Deplacement') continue;
      if (c.cp_lundi) dep.lundi = true;
      if (c.cp_mardi) dep.mardi = true;
      if (c.cp_mercredi) dep.mercredi = true;
      if (c.cp_jeudi) dep.jeudi = true;
      if (c.cp_vendredi) dep.vendredi = true;
      if (c.cp_samedi) dep.samedi = true;
      if (c.cp_dimanche) dep.dimanche = true;
    }
    const tfValid = parseTravailFerieDepMotif(depCongeValid?.motif ?? null);
    const strictTf = motifDeclaresTravailFerie(depCongeValid?.motif ?? null);

    const ferieRowsValid = await prisma.jourFerie.findMany({
      where: { date: { gte: monday, lte: addDaysUTC(monday, 6) } },
    });
    const ferieKeySet = new Set(ferieRowsValid.map((j) => dateKeyUtc(j.date)));
    for (let i = 0; i < 7; i++) {
      const dk = dateKeyUtc(addDaysUTC(monday, i));
      if (!ferieKeySet.has(dk)) continue;
      const jour = JOURS_POINTAGE[i];
      const h = Number(hSim[jour] || 0);
      if (h <= 0) continue;
      if (!dep[jour]) {
        return res.status(400).json({
          error:
            'Impossible de saisir des heures un jour férié sans cocher « Déplacement » pour ce jour.',
        });
      }
      if (strictTf && !tfValid[jour]) {
        return res.status(400).json({
          error:
            'Impossible de saisir des heures un jour férié sans cocher aussi « Travail ce jour férié » (ligne au-dessus des déplacements).',
        });
      }
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
      commentaire: data.commentaire,
      // Recalculer les dates civiles (corrige les anciennes lignes enregistrées avec décalage fuseau)
      date_lundi: monday,
      date_mardi: addDaysUTC(monday, 1),
      date_mercredi: addDaysUTC(monday, 2),
      date_jeudi: addDaysUTC(monday, 3),
      date_vendredi: addDaysUTC(monday, 4),
      date_samedi: addDaysUTC(monday, 5),
      date_dimanche: addDaysUTC(monday, 6),
    };

    const pointage = await prisma.salariePointage.upsert({
      where: {
        salarie_id_projet_id_tache_type_id_annee_semaine: {
          salarie_id,
          projet_id: BigInt(data.projet_id),
          tache_type_id: finalTacheTypeId,
          annee: data.annee,
          semaine: data.semaine
        }
      },
      update: updateData,
      create: {
        salarie_id,
        projet_id: BigInt(data.projet_id),
        tache_type_id: finalTacheTypeId,
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
        date_mardi: addDaysUTC(monday, 1),
        date_mercredi: addDaysUTC(monday, 2),
        date_jeudi: addDaysUTC(monday, 3),
        date_vendredi: addDaysUTC(monday, 4),
        date_samedi: addDaysUTC(monday, 5),
        date_dimanche: addDaysUTC(monday, 6),
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

    const heuresParJourSoum: Record<string, number> = {
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
    };
    for (const p of pointages) {
      heuresParJourSoum.lundi += Number(p.heure_lundi || 0);
      heuresParJourSoum.mardi += Number(p.heure_mardi || 0);
      heuresParJourSoum.mercredi += Number(p.heure_mercredi || 0);
      heuresParJourSoum.jeudi += Number(p.heure_jeudi || 0);
      heuresParJourSoum.vendredi += Number(p.heure_vendredi || 0);
      heuresParJourSoum.samedi += Number(p.heure_samedi || 0);
      heuresParJourSoum.dimanche += Number(p.heure_dimanche || 0);
    }

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

    const mondaySoum = getMondayOfWeek(annee, semaine);
    const joursFeriesSoum = await prisma.jourFerie.findMany({
      where: { date: { gte: mondaySoum, lte: addDaysUTC(mondaySoum, 6) } },
    });
    const depSoum: Record<(typeof JOURS_POINTAGE)[number], boolean> = {
      lundi: false,
      mardi: false,
      mercredi: false,
      jeudi: false,
      vendredi: false,
      samedi: false,
      dimanche: false,
    };
    const depCongeSoum = conges.find((c) => c.type_conge === 'Deplacement');
    for (const c of conges) {
      if (c.type_conge !== 'Deplacement') continue;
      if (c.cp_lundi) depSoum.lundi = true;
      if (c.cp_mardi) depSoum.mardi = true;
      if (c.cp_mercredi) depSoum.mercredi = true;
      if (c.cp_jeudi) depSoum.jeudi = true;
      if (c.cp_vendredi) depSoum.vendredi = true;
      if (c.cp_samedi) depSoum.samedi = true;
      if (c.cp_dimanche) depSoum.dimanche = true;
    }
    const tfSoum = parseTravailFerieDepMotif(depCongeSoum?.motif ?? null);
    const strictTfSoum = motifDeclaresTravailFerie(depCongeSoum?.motif ?? null);
    const ferieKeySoum = new Set(joursFeriesSoum.map((j) => dateKeyUtc(j.date)));
    for (let i = 0; i < 7; i++) {
      const dk = dateKeyUtc(addDaysUTC(mondaySoum, i));
      if (!ferieKeySoum.has(dk)) continue;
      const jour = JOURS_POINTAGE[i];
      const h = Number(heuresParJourSoum[jour] || 0);
      if (h <= 0) continue;
      if (!depSoum[jour]) {
        return res.status(400).json({
          error:
            'Impossible de soumettre : des heures sont saisies un jour férié sans « Déplacement » pour ce jour.',
        });
      }
      if (strictTfSoum && !tfSoum[jour]) {
        return res.status(400).json({
          error:
            'Impossible de soumettre : un jour férié avec des heures nécessite aussi la case « Travail ce jour férié ».',
        });
      }
    }

    const ferieSoum = computeFerieSemaineServer(mondaySoum, heuresParJourSoum, joursFeriesSoum, HEURES_PAR_JOUR);

    // Total « objectif » = travail hors férié + crédit férié non travaillé + CP + déplacement + formation
    // Les heures pointées un jour férié sont exclues du total objectif et comptées en heures sup.
    const totalSemaine =
      ferieSoum.heuresTravailSansFerie +
      ferieSoum.creditFerie +
      heuresCP +
      heuresDeplacement +
      heuresFormation;

    // Heures normales requises = 35h − 7h par jour férié dans la semaine.
    const HEURES_SEMAINE_NORMALE = 35;
    const heuresNormalesRequises =
      HEURES_SEMAINE_NORMALE - HEURES_PAR_JOUR * ferieSoum.nbFeries;

    // Calculer les heures dues de cette semaine
    // Si totalSemaine < heures normales requises, les heures manquantes deviennent des heures dues
    const heuresDuesSemaine = Math.max(0, heuresNormalesRequises - totalSemaine);
    
    // Les heures de maladie s'ajoutent aussi aux heures dues
    const heuresDues = heuresDuesSemaine + heuresMaladie;
    
    const heuresEnPlus = Math.max(0, totalSemaine - heuresNormalesRequises);
    const heuresSup = heuresEnPlus + ferieSoum.heuresTravailJoursFeries;
    
    console.log('Calcul heures dues:', {
      totalSemaine,
      heuresNormalesRequises,
      heuresDuesSemaine,
      heuresMaladie,
      heuresDues,
      heuresSup,
    });

    // Stocker uniquement les heures dues de la semaine courante.
    const validation = await prisma.validationSemaine.upsert({
      where: {
        salarie_id_annee_semaine: { salarie_id, annee, semaine }
      },
      update: {
        status: 'Soumis',
        total_heures: totalSemaine, // Total incluant CP, déplacement, formation
        heures_dues: heuresDues,
        date_soumission: new Date()
      },
      create: {
        salarie_id,
        annee,
        semaine,
        status: 'Soumis',
        total_heures: totalSemaine,
        heures_dues: heuresDues,
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

    if (pointage.validation_status === 'Valide' || pointage.validation_status === 'Soumis') {
      return res.status(400).json({ error: 'Impossible de supprimer un pointage d\'une semaine soumise ou validée' });
    }

    const validationDelete = await prisma.validationSemaine.findUnique({
      where: {
        salarie_id_annee_semaine: {
          salarie_id: pointage.salarie_id,
          annee: pointage.annee,
          semaine: pointage.semaine,
        },
      },
    });
    if (validationDelete && (validationDelete.status === 'Soumis' || validationDelete.status === 'Valide')) {
      return res.status(400).json({ error: 'Impossible de supprimer un pointage d\'une semaine soumise ou validée' });
    }

    await prisma.salariePointage.delete({ where: { id } });

    res.json({ message: 'Pointage supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;