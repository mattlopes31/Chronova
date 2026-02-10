import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, managerMiddleware, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const serializeBigInt = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// GET /api/projets - Liste des projets
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { actif, status_id, client_id, archive } = req.query;

    const where: any = {};
    
    if (actif !== undefined) where.actif = actif === 'true';
    if (archive !== undefined) where.archive = archive === 'true';
    if (status_id) where.projet_status_id = BigInt(status_id as string);
    if (client_id) where.client_id = BigInt(client_id as string);

    const projets = await prisma.projet.findMany({
      where,
      include: {
        status: true,
        client: {
          select: { id: true, nom: true, code_client: true }
        },
        responsable: {
          select: { id: true, nom: true, prenom: true }
        },
        taches: {
          include: {
            tache_type: true
          }
        },
        affectations: {
          include: {
            salarie: {
              select: { id: true, nom: true, prenom: true }
            },
            tache_projet: {
              include: { tache_type: true }
            },
            tache_type: true
          }
        },
        _count: {
          select: { taches: true, pointages: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Log pour vérifier les couleurs des tâches
    projets.forEach((projet: any) => {
      if (projet.taches && projet.taches.length > 0) {
        projet.taches.forEach((tache: any) => {
          if (tache.couleur) {
            console.log(`Projet ${projet.id}, Tâche ${tache.id}: couleur=${tache.couleur}, nom_tache=${tache.nom_tache}`);
          }
        });
      }
    });

    res.json(serializeBigInt(projets));
  } catch (error) {
    console.error('Erreur liste projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/projets/statuts - Liste des statuts projet
router.get('/statuts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const statuts = await prisma.projetStatus.findMany();
    res.json(serializeBigInt(statuts));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/projets/mes-projets - Projets assignés au salarié connecté
router.get('/mes-projets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const salarieId = req.user!.id;
    
    console.log('=== mes-projets ===');
    console.log('Salarié ID:', salarieId.toString());

    // Récupérer les projets où le salarié est assigné
    const affectations = await prisma.tacheProjetSalarie.findMany({
      where: { salarie_id: salarieId },
      select: { projet_id: true, tache_projet_id: true, tache_type_id: true }
    });
    
    console.log('Affectations trouvées:', affectations.length);

    const projetIds = [...new Set(affectations.map(a => a.projet_id))];
    console.log('Projet IDs:', projetIds.map(id => id.toString()));

    if (projetIds.length === 0) {
      console.log('Aucun projet assigné');
      return res.json([]);
    }

    const projets = await prisma.projet.findMany({
      where: {
        id: { in: projetIds },
        actif: true
      },
      include: {
        status: true,
        client: {
          select: { id: true, nom: true }
        },
        taches: {
          include: {
            tache_type: true
          }
        },
        affectations: {
          where: { salarie_id: salarieId },
          include: {
            tache_projet: {
              include: { tache_type: true }
            },
            tache_type: true
          }
        }
      }
    });
    
    console.log('Projets retournés:', projets.length);

    res.json(serializeBigInt(projets));
  } catch (error) {
    console.error('Erreur mes-projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/projets/details - Détails complets des projets avec heures par tâche et salarié
// IMPORTANT: Cette route doit être AVANT /:id sinon Express interprète "details" comme un ID
router.get('/details', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    console.log('=== GET /api/projets/details ===');
    
    // Récupérer tous les projets dans l'ordre de création (actifs et inactifs)
    const projets = await prisma.projet.findMany({
      where: {},
      include: {
        status: true,
        client: {
          select: { id: true, nom: true, code_client: true }
        },
        taches: {
          include: {
            tache_type: true
          }
        }
      },
      orderBy: { created_at: 'asc' } // Ordre de création
    });

    console.log('Projets trouvés:', projets.length);

    // Pour chaque projet, calculer les heures réelles par tâche et par salarié
    const projetsAvecDetails = await Promise.all(
      projets.map(async (projet) => {
        // Récupérer tous les pointages pour ce projet
        const pointages = await prisma.salariePointage.findMany({
          where: {
            projet_id: projet.id,
            validation_status: { in: ['Valide', 'Soumis'] } // Seulement les pointages validés ou soumis
          },
          include: {
            salarie: {
              select: { id: true, nom: true, prenom: true }
            },
            tache_type: {
              select: { id: true, tache_type: true, code: true }
            }
          }
        });

        // Calculer les heures par tâche
        const tachesAvecHeures = projet.taches.map((tache) => {
          // Heures estimées (heures_prevues de tache_projet)
          const heuresEstimees = Number(tache.heures_prevues || 0);

          // Pour les tâches personnalisées (sans tache_type_id), on ne peut pas les lier aux pointages
          // car les pointages utilisent uniquement tache_type_id
          // On retourne quand même la tâche avec 0 heures réelles
          const isTachePersonnalisee = !tache.tache_type_id;

          // Pointages pour cette tâche (seulement si elle a un tache_type_id)
          const pointagesTache = isTachePersonnalisee 
            ? [] 
            : pointages.filter(
                p => Number(p.tache_type_id) === Number(tache.tache_type_id)
              );

          // Calculer les heures totales pour cette tâche
          const heuresTotales = pointagesTache.reduce((sum, p) => {
            return sum +
              Number(p.heure_lundi || 0) +
              Number(p.heure_mardi || 0) +
              Number(p.heure_mercredi || 0) +
              Number(p.heure_jeudi || 0) +
              Number(p.heure_vendredi || 0) +
              Number(p.heure_samedi || 0) +
              Number(p.heure_dimanche || 0);
          }, 0);

          // Écart d'heures
          const ecartHeures = heuresTotales - heuresEstimees;

          // Grouper les heures par salarié pour cette tâche
          const heuresParSalarie: Record<string, {
            salarie_id: string;
            nom: string;
            prenom: string;
            heures: number;
          }> = {};

          pointagesTache.forEach((p) => {
            const salarieId = p.salarie_id.toString();
            const heures = 
              Number(p.heure_lundi || 0) +
              Number(p.heure_mardi || 0) +
              Number(p.heure_mercredi || 0) +
              Number(p.heure_jeudi || 0) +
              Number(p.heure_vendredi || 0) +
              Number(p.heure_samedi || 0) +
              Number(p.heure_dimanche || 0);

            if (!heuresParSalarie[salarieId]) {
              heuresParSalarie[salarieId] = {
                salarie_id: salarieId,
                nom: p.salarie.nom,
                prenom: p.salarie.prenom,
                heures: 0
              };
            }
            heuresParSalarie[salarieId].heures += heures;
          });

          // Déterminer le nom et le code de la tâche
          const tacheNom = isTachePersonnalisee 
            ? (tache.nom_tache || 'Tâche sans nom')
            : (tache.tache_type?.tache_type || 'Tâche inconnue');
          
          const tacheCode = isTachePersonnalisee 
            ? (tache.code || null)
            : (tache.code || tache.tache_type?.code || null);

          return {
            id: tache.id.toString(),
            tache_type_id: tache.tache_type_id ? tache.tache_type_id.toString() : null,
            tache_type: tacheNom,
            code: tacheCode,
            heures_prevues: heuresEstimees,
            heures_totales: heuresTotales,
            ecart_heures: ecartHeures,
            heures_par_salarie: Object.values(heuresParSalarie)
          };
        });

        return {
          id: projet.id.toString(),
          nom: projet.nom,
          code_projet: projet.code_projet,
          archive: projet.archive,
          client: projet.client,
          status: projet.status,
          created_at: projet.created_at,
          taches: tachesAvecHeures
        };
      })
    );

    console.log('Projets avec détails retournés:', projetsAvecDetails.length);
    res.json(serializeBigInt(projetsAvecDetails));
  } catch (error) {
    console.error('Erreur détails projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/projets/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet = await prisma.projet.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        status: true,
        client: true,
        responsable: {
          select: { id: true, nom: true, prenom: true, email: true }
        },
        taches: {
          include: {
            tache_type: true,
            affectations: {
              include: {
                salarie: {
                  select: { id: true, nom: true, prenom: true }
                }
              }
            }
          }
        }
      }
    });

    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(serializeBigInt(projet));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/projets - Créer un projet avec ses tâches (Admin/Manager)
router.post('/', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    
    console.log('=== DEBUG: Création projet ===');
    console.log('Data reçue:', JSON.stringify(data, null, 2));

    if (!data.nom) {
      return res.status(400).json({ error: 'Nom du projet requis' });
    }

    // taches peut être un tableau d'IDs de tache_type ou d'objets {tache_type_id, heures_prevues}
    const tachesData = data.taches || [];
    const tacheTypeIds: number[] = tachesData.map((t: any) => 
      typeof t === 'object' ? Number(t.tache_type_id) : Number(t)
    );
    // Créer un map des heures estimées par tache_type_id
    const heuresParTache: Record<number, number> = {};
    tachesData.forEach((t: any) => {
      const tacheTypeId = typeof t === 'object' ? Number(t.tache_type_id) : Number(t);
      const heures = typeof t === 'object' ? Number(t.heures_prevues || 0) : 0;
      heuresParTache[tacheTypeId] = heures;
    });
    console.log('Taches reçues:', tacheTypeIds);
    console.log('Heures par tâche:', heuresParTache);

    // Utiliser une transaction pour créer projet + tâches ensemble
    const result = await prisma.$transaction(async (tx) => {
      // Créer le projet
      const projet = await tx.projet.create({
        data: {
          nom: data.nom,
          code_projet: data.code_projet || null,
          description: data.description || null,
          projet_status_id: data.projet_status_id ? BigInt(data.projet_status_id) : null,
          client_id: data.client_id ? BigInt(data.client_id) : null,
          responsable_id: data.responsable_id ? BigInt(data.responsable_id) : null,
          start_date: data.start_date ? new Date(data.start_date) : null,
          end_date: data.end_date ? new Date(data.end_date) : null,
          budget_heures: data.budget_heures || null,
          budget_euros: data.budget_euros || null,
          priorite: data.priorite || 1
        }
      });
      
      console.log('Projet créé avec ID:', projet.id.toString());

      // Créer les tâches du projet
      if (tachesData.length > 0) {
        console.log('Création de', tachesData.length, 'tâches...');
        for (const tacheData of tachesData) {
          if (tacheData.nom_tache) {
            // Créer une tâche avec nom personnalisé (sans tache_type_id)
            console.log('  - Création tache_projet avec nom:', tacheData.nom_tache);
            await tx.tacheProjet.create({
              data: {
                projet_id: projet.id,
                tache_type_id: null, // Pas de type global
                nom_tache: tacheData.nom_tache,
                code: tacheData.code || null,
                heures_prevues: tacheData.heures_prevues || 0,
                couleur: tacheData.couleur || '#10B981',
                taux_horaire: 50
              }
            });
          } else if (tacheData.tache_type_id) {
            // Créer une tâche avec type global existant
            // Ne pas sauvegarder de couleur, elle viendra du tache_type
            console.log('  - Création tache_projet pour tache_type_id:', tacheData.tache_type_id);
            await tx.tacheProjet.create({
              data: {
                projet_id: projet.id,
                tache_type_id: BigInt(tacheData.tache_type_id),
                heures_prevues: tacheData.heures_prevues || 0,
                taux_horaire: 50,
                couleur: null // Pas de couleur personnalisée, utiliser celle du tache_type
              }
            });
          }
        }
      }

      return projet;
    });

    // Récupérer le projet avec ses relations
    const projetComplet = await prisma.projet.findUnique({
      where: { id: result.id },
      include: {
        status: true,
        client: true,
        taches: {
          include: { tache_type: true }
        },
        affectations: {
          include: {
            salarie: true,
            tache_type: true,
            tache_projet: { include: { tache_type: true } }
          }
        }
      }
    });

    res.status(201).json(serializeBigInt(projetComplet));
  } catch (error: any) {
    console.error('Erreur création projet:', error);
    
    // Gestion de l'erreur de contrainte unique (code projet déjà existant)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'champ';
      return res.status(400).json({ 
        error: `Ce ${field === 'code_projet' ? 'code projet' : field} existe déjà. Choisissez un autre code.` 
      });
    }
    
    res.status(500).json({ error: 'Erreur serveur lors de la création du projet' });
  }
});

// PUT /api/projets/:id
router.put('/:id', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const data = req.body;

    // Extraire les tâches du body - peut être un tableau d'IDs, d'objets {tache_type_id, heures_prevues}, {nom_tache, heures_prevues, couleur} ou {tache_projet_id, heures_prevues}
    const tachesData = data.taches || [];
    const tacheTypeIds: number[] = [];
    const tachesAvecNom: Array<{ nom_tache: string; code?: string; heures_prevues: number; couleur?: string }> = [];
    const tachesAMettreAJour: Array<{ tache_projet_id: string; heures_prevues: number; nom_tache?: string | null; code?: string | null; couleur?: string | null }> = [];
    
    tachesData.forEach((t: any) => {
      // Priorité 1: Si tache_projet_id existe, c'est une tâche existante à mettre à jour
      if (t.tache_projet_id) {
        tachesAMettreAJour.push({
          tache_projet_id: String(t.tache_projet_id),
          heures_prevues: Number(t.heures_prevues || 0),
          nom_tache: t.nom_tache !== undefined ? (t.nom_tache || null) : undefined, // Pour mise à jour du nom si nécessaire
          code: t.code !== undefined ? (t.code === '' ? null : t.code) : undefined, // Pour mise à jour du code si nécessaire (chaîne vide devient null)
          couleur: t.couleur !== undefined ? (t.couleur || null) : undefined, // Pour mise à jour de la couleur si nécessaire
        });
      } 
      // Priorité 2: Si nom_tache existe SANS tache_projet_id, c'est une nouvelle tâche
      else if (t.nom_tache && !t.tache_projet_id) {
        tachesAvecNom.push({
          nom_tache: t.nom_tache,
          code: t.code || null,
          heures_prevues: Number(t.heures_prevues || 0),
          couleur: t.couleur || '#10B981',
        });
      } 
      // Priorité 3: Tâche avec type global
      else if (t.tache_type_id) {
        tacheTypeIds.push(Number(t.tache_type_id));
      } 
      // Compatibilité avec ancien format
      else if (typeof t === 'number' || typeof t === 'string') {
        tacheTypeIds.push(Number(t));
      }
    });
    
    // Créer un map des heures estimées par tache_type_id (pour compatibilité)
    const heuresParTache: Record<number, number> = {};
    tachesData.forEach((t: any) => {
      if (t.tache_type_id) {
        const tacheTypeId = Number(t.tache_type_id);
        heuresParTache[tacheTypeId] = Number(t.heures_prevues || 0);
      }
    });
    console.log('=== PUT /api/projets/:id ===');
    console.log('Projet ID:', id.toString());
    console.log('Code projet reçu:', data.code_projet);
    console.log('Taches reçues (brutes):', data.taches);
    console.log('Taches converties:', tacheTypeIds);

    // Récupérer le projet existant pour vérifier si le code_projet change
    const projetExistant = await prisma.projet.findUnique({
      where: { id },
      select: { code_projet: true }
    });

    // Préparer les données de mise à jour (sans taches)
    const updateData: any = {};
    
    if (data.nom !== undefined) updateData.nom = data.nom;
    
    // Gérer le code_projet : ne le mettre à jour que s'il a changé ET qu'il n'existe pas déjà pour un autre projet
    if (data.code_projet !== undefined && data.code_projet !== null) {
      const codeProjetActuel = projetExistant?.code_projet;
      const nouveauCodeProjet = String(data.code_projet).trim();
      
      console.log('Code projet actuel:', codeProjetActuel);
      console.log('Nouveau code projet:', nouveauCodeProjet);
      
      // Si le code a changé, vérifier qu'il n'existe pas déjà pour un autre projet
      if (nouveauCodeProjet !== codeProjetActuel) {
        console.log('Le code a changé, vérification de l\'unicité...');
        // Vérifier si ce code existe déjà pour un autre projet
        const projetAvecMemeCode = await prisma.projet.findFirst({
          where: {
            code_projet: nouveauCodeProjet,
            id: { not: id } // Exclure le projet actuel
          }
        });
        
        if (projetAvecMemeCode) {
          console.log('Code projet déjà utilisé par le projet:', projetAvecMemeCode.id.toString());
          return res.status(400).json({ 
            error: 'Ce code projet existe déjà pour un autre projet. Choisissez un autre code.' 
          });
        }
        
        // Le code est valide, on peut le mettre à jour
        console.log('Code projet valide, mise à jour autorisée');
        updateData.code_projet = nouveauCodeProjet;
      } else {
        console.log('Code projet inchangé, pas de mise à jour nécessaire');
      }
      // Si le code n'a pas changé, on ne le met pas dans updateData (évite l'erreur P2002)
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.projet_status_id !== undefined) updateData.projet_status_id = data.projet_status_id ? BigInt(data.projet_status_id) : null;
    if (data.client_id !== undefined) updateData.client_id = data.client_id ? BigInt(data.client_id) : null;
    if (data.responsable_id !== undefined) updateData.responsable_id = data.responsable_id ? BigInt(data.responsable_id) : null;
    if (data.start_date !== undefined) updateData.start_date = data.start_date ? new Date(data.start_date) : null;
    if (data.end_date !== undefined) updateData.end_date = data.end_date ? new Date(data.end_date) : null;
    if (data.budget_heures !== undefined) updateData.budget_heures = data.budget_heures;
    if (data.budget_euros !== undefined) updateData.budget_euros = data.budget_euros;
    if (data.priorite !== undefined) updateData.priorite = data.priorite;

    // Vérifier d'abord si les colonnes nom_tache et couleur existent (en dehors de la transaction)
    let colonnesExistantes = false;
    try {
      await prisma.$queryRaw`SELECT nom_tache, couleur FROM tache_projet LIMIT 1`;
      colonnesExistantes = true;
      console.log('✅ Colonnes nom_tache et couleur disponibles');
    } catch (error) {
      console.log('⚠️ Colonnes nom_tache/couleur non disponibles dans la base de données');
      colonnesExistantes = false;
    }

    // Utiliser une transaction pour mettre à jour projet + tâches
    await prisma.$transaction(async (tx) => {
      // Mettre à jour le projet
      await tx.projet.update({
        where: { id },
        data: updateData
      });

      // Si des tâches sont fournies, les mettre à jour
      if (data.taches !== undefined && Array.isArray(data.taches)) {
        // Récupérer les tâches existantes (avec leurs IDs)
        
        // Récupérer les tâches avec ou sans nom_tache/couleur selon leur disponibilité
        const tachesExistantes = await tx.tacheProjet.findMany({
          where: { projet_id: id },
          select: { 
            id: true, 
            tache_type_id: true, 
            heures_prevues: true,
          }
        });
        
        const tachesAvecDetails = colonnesExistantes
          ? await Promise.all(
              tachesExistantes.map(async (tache) => {
                try {
                  const details = await tx.$queryRaw<Array<{ nom_tache: string | null; couleur: string | null }>>`
                    SELECT nom_tache, couleur 
                    FROM tache_projet 
                    WHERE id = ${tache.id}
                  `;
                  return {
                    ...tache,
                    nom_tache: details[0]?.nom_tache || null,
                    couleur: details[0]?.couleur || null,
                  };
                } catch (error) {
                  return {
                    ...tache,
                    nom_tache: null,
                    couleur: null,
                  };
                }
              })
            )
          : tachesExistantes.map(t => ({
              ...t,
              nom_tache: null,
              couleur: null,
            }));
        const idsExistants = tachesAvecDetails
          .map(t => t.tache_type_id ? Number(t.tache_type_id) : null)
          .filter((id): id is number => id !== null);
        const idsTachesProjetExistantes = tachesAvecDetails.map(t => String(t.id));
        // Extraire les IDs des tâches envoyées depuis tachesData
        const idsTachesEnvoyees = [
          ...tachesData
            .filter((t: any) => t.tache_projet_id)
            .map((t: any) => String(t.tache_projet_id)),
          ...tacheTypeIds.map((tid: number) => String(tid)), // Pour compatibilité
        ];

        console.log('=== Gestion des tâches ===');
        console.log('Tâches existantes dans le projet (IDs):', idsExistants);
        console.log('Tâches avec nom:', tachesAvecNom);
        console.log('Tâches existantes à mettre à jour:', tachesAMettreAJour);
        console.log('Tâches avec type global:', tacheTypeIds);
        console.log('IDs tâches projet existantes:', idsTachesProjetExistantes);
        console.log('IDs tâches envoyées:', idsTachesEnvoyees);

        // Tâches à ajouter (nouvelles avec type global) - celles qui sont sélectionnées mais pas encore dans le projet
        const tachesAAjouter = tacheTypeIds.filter(tid => {
          const existe = idsExistants.includes(tid);
          console.log(`Tâche ${tid}: existe=${existe}, type=${typeof tid}`);
          return !existe;
        });
        
        // Tâches à supprimer (qui ne sont plus sélectionnées) - celles qui sont dans le projet mais pas dans la liste envoyée
        const tachesASupprimer = tachesAvecDetails
          .filter((t: any) => {
            const estDansListeEnvoyee = idsTachesEnvoyees.includes(String(t.id)) || 
                                       (t.tache_type_id && tacheTypeIds.includes(Number(t.tache_type_id)));
            return !estDansListeEnvoyee;
          })
          .map((t: any) => String(t.id));

        console.log('Tâches à ajouter:', tachesAAjouter);
        console.log('Tâches à supprimer:', tachesASupprimer);

        // Vérifier quelles tâches ont des affectations avant de les supprimer
        if (tachesASupprimer.length > 0) {
          // Récupérer les tâches projet qui ont des affectations (par tache_projet_id)
          const tachesAvecAffectations = await tx.tacheProjetSalarie.findMany({
            where: {
              projet_id: id,
              tache_projet_id: { in: tachesASupprimer.map(tid => BigInt(tid)) }
            },
            select: {
              tache_projet_id: true
            }
          });

          const idsTachesAvecAffectations = tachesAvecAffectations.map(
            aff => String(aff.tache_projet_id)
          );

          // Ne supprimer que les tâches qui n'ont PAS d'affectations
          const tachesASupprimerSansAffectations = tachesASupprimer.filter(
            tid => !idsTachesAvecAffectations.includes(tid)
          );

          console.log('Tâches avec affectations (non supprimées):', idsTachesAvecAffectations);
          console.log('Tâches à supprimer (sans affectations):', tachesASupprimerSansAffectations);

          if (tachesASupprimerSansAffectations.length > 0) {
            await tx.tacheProjet.deleteMany({
              where: {
                projet_id: id,
                id: { in: tachesASupprimerSansAffectations.map(tid => BigInt(tid)) }
              }
            });
          }

          // Avertir si des tâches avec affectations n'ont pas pu être supprimées
          const tachesNonSupprimees = tachesASupprimer.filter(
            tid => idsTachesAvecAffectations.includes(tid)
          );
          if (tachesNonSupprimees.length > 0) {
            console.warn('Tâches non supprimées car elles ont des affectations:', tachesNonSupprimees);
          }
        }

        // Ajouter les nouvelles tâches avec nom personnalisé
        for (const tacheAvecNom of tachesAvecNom) {
          try {
            console.log(`Création tâche avec nom: ${tacheAvecNom.nom_tache}, heures: ${tacheAvecNom.heures_prevues}, couleur: ${tacheAvecNom.couleur}`);
            
            // Si les colonnes existent, utiliser Prisma, sinon SQL brut
            if (colonnesExistantes) {
              const nouvelleTache = await tx.tacheProjet.create({
                data: {
                  projet_id: id,
                  tache_type_id: null, // Pas de type global
                  nom_tache: tacheAvecNom.nom_tache,
                  code: tacheAvecNom.code || null,
                  heures_prevues: tacheAvecNom.heures_prevues,
                  couleur: tacheAvecNom.couleur,
                  taux_horaire: 50
                }
              });
              console.log(`✅ Tâche créée avec ID: ${nouvelleTache.id.toString()}`);
            } else {
              // Utiliser SQL brut si les colonnes n'existent pas encore
              console.log('Création avec SQL brut (colonnes non disponibles)...');
              await tx.$executeRaw`
                INSERT INTO tache_projet (projet_id, tache_type_id, heures_prevues, taux_horaire, nom_tache, couleur)
                VALUES (${id}, NULL, ${tacheAvecNom.heures_prevues}, 50, ${tacheAvecNom.nom_tache}, ${tacheAvecNom.couleur})
              `;
              console.log(`✅ Tâche créée avec SQL brut`);
            }
          } catch (error: any) {
            console.error(`❌ Erreur création tâche "${tacheAvecNom.nom_tache}":`, error);
            console.error('Détails:', error.message, error.code);
            // Si Prisma échoue à cause de la colonne code, essayer sans code
            if (error.message?.includes('code') || error.message?.includes('Unknown argument `code`')) {
              console.log('Tentative sans colonne code...');
              try {
                await tx.$executeRaw`
                  INSERT INTO tache_projet (projet_id, tache_type_id, heures_prevues, taux_horaire, nom_tache, couleur)
                  VALUES (${id}, NULL, ${tacheAvecNom.heures_prevues}, 50, ${tacheAvecNom.nom_tache}, ${tacheAvecNom.couleur})
                `;
                console.log(`✅ Tâche créée sans code (colonne code non disponible)`);
                console.warn(`⚠️ La colonne 'code' n'existe pas encore. Exécutez: ALTER TABLE tache_projet ADD COLUMN IF NOT EXISTS code VARCHAR(20);`);
              } catch (sqlError: any) {
                console.error(`❌ Erreur SQL brut:`, sqlError);
                throw new Error(`Impossible de créer la tâche "${tacheAvecNom.nom_tache}". Veuillez exécuter la migration SQL pour ajouter la colonne code: ALTER TABLE tache_projet ADD COLUMN IF NOT EXISTS code VARCHAR(20);`);
              }
            } else if (colonnesExistantes && (error.message?.includes('nom_tache') || error.message?.includes('couleur'))) {
              console.log('Tentative avec SQL brut...');
              try {
                await tx.$executeRaw`
                  INSERT INTO tache_projet (projet_id, tache_type_id, heures_prevues, taux_horaire, nom_tache, couleur)
                  VALUES (${id}, NULL, ${tacheAvecNom.heures_prevues}, 50, ${tacheAvecNom.nom_tache}, ${tacheAvecNom.couleur})
                `;
                console.log(`✅ Tâche créée avec SQL brut (fallback)`);
              } catch (sqlError: any) {
                console.error(`❌ Erreur SQL brut:`, sqlError);
                throw new Error(`Impossible de créer la tâche "${tacheAvecNom.nom_tache}". Veuillez appliquer la migration SQL pour ajouter les colonnes nom_tache et couleur à la table tache_projet.`);
              }
            } else {
              throw new Error(`Impossible de créer la tâche "${tacheAvecNom.nom_tache}": ${error.message}`);
            }
          }
        }

        // Ajouter les nouvelles tâches avec type global
        // Ne pas sauvegarder de couleur, elle viendra du tache_type
        for (const tacheTypeId of tachesAAjouter) {
          await tx.tacheProjet.create({
            data: {
              projet_id: id,
              tache_type_id: BigInt(tacheTypeId),
              heures_prevues: heuresParTache[tacheTypeId] || 0,
              taux_horaire: 50,
              couleur: null // Pas de couleur personnalisée, utiliser celle du tache_type
            }
          });
        }

        // Mettre à jour les heures estimées, nom, code et couleur des tâches existantes du projet
        for (const tacheAMettreAJour of tachesAMettreAJour) {
          try {
            // Vérifier si la colonne code existe
            const codeColumnExists = await tx.$queryRaw`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'tache_projet' AND column_name = 'code'
            `;
            const hasCodeColumn = Array.isArray(codeColumnExists) && codeColumnExists.length > 0;
            
            const updateData: any = {
              heures_prevues: tacheAMettreAJour.heures_prevues
            };
            
            // Mettre à jour nom_tache si fourni
            if (tacheAMettreAJour.nom_tache !== null && tacheAMettreAJour.nom_tache !== undefined) {
              updateData.nom_tache = tacheAMettreAJour.nom_tache;
            }
            
            // Mettre à jour code si fourni et si la colonne existe
            if (hasCodeColumn && tacheAMettreAJour.code !== undefined) {
              updateData.code = tacheAMettreAJour.code || null; // Convertir chaîne vide en null
            }
            
            // Mettre à jour couleur si elle est explicitement fournie
            // Permet de personnaliser la couleur même pour les tâches avec tache_type_id
            if (tacheAMettreAJour.couleur !== null && tacheAMettreAJour.couleur !== undefined) {
              updateData.couleur = tacheAMettreAJour.couleur;
            }
            
            console.log(`Mise à jour tâche ${tacheAMettreAJour.tache_projet_id}:`, updateData);
            
            try {
              await tx.tacheProjet.update({
                where: { id: BigInt(tacheAMettreAJour.tache_projet_id) },
                data: updateData
              });
              console.log(`✅ Tâche ${tacheAMettreAJour.tache_projet_id} mise à jour`);
            } catch (prismaError: any) {
              // Si Prisma échoue à cause de la colonne code, utiliser SQL brut
              if (prismaError.message?.includes('code') || prismaError.message?.includes('Unknown argument')) {
                console.log('Mise à jour avec SQL brut (colonne code non disponible dans Prisma)...');
                const sqlParts: string[] = [];
                const sqlValues: any[] = [];
                let paramIndex = 1;
                
                sqlParts.push(`heures_prevues = $${paramIndex++}`);
                sqlValues.push(tacheAMettreAJour.heures_prevues);
                
                if (tacheAMettreAJour.nom_tache !== null && tacheAMettreAJour.nom_tache !== undefined) {
                  sqlParts.push(`nom_tache = $${paramIndex++}`);
                  sqlValues.push(tacheAMettreAJour.nom_tache);
                }
                
                if (hasCodeColumn && tacheAMettreAJour.code !== undefined) {
                  sqlParts.push(`code = $${paramIndex++}`);
                  sqlValues.push(tacheAMettreAJour.code || null);
                }
                
                if (tacheAMettreAJour.couleur !== null && tacheAMettreAJour.couleur !== undefined) {
                  sqlParts.push(`couleur = $${paramIndex++}`);
                  sqlValues.push(tacheAMettreAJour.couleur);
                }
                
                await tx.$executeRawUnsafe(
                  `UPDATE tache_projet SET ${sqlParts.join(', ')} WHERE id = $${paramIndex}`,
                  ...sqlValues,
                  BigInt(tacheAMettreAJour.tache_projet_id)
                );
                console.log(`✅ Tâche ${tacheAMettreAJour.tache_projet_id} mise à jour avec SQL brut`);
                if (!hasCodeColumn && tacheAMettreAJour.code !== undefined) {
                  console.warn(`⚠️ La colonne 'code' n'existe pas encore. Le code n'a pas été sauvegardé. Exécutez: ALTER TABLE tache_projet ADD COLUMN IF NOT EXISTS code VARCHAR(20);`);
                }
              } else {
                throw prismaError;
              }
            }
          } catch (error: any) {
            console.error(`❌ Erreur mise à jour tâche ${tacheAMettreAJour.tache_projet_id}:`, error);
            throw error;
          }
        }

        // Mettre à jour les heures estimées des tâches avec type global
        for (const tacheTypeId of tacheTypeIds) {
          if (idsExistants.includes(tacheTypeId) && heuresParTache[tacheTypeId] !== undefined) {
            await tx.tacheProjet.updateMany({
              where: {
                projet_id: id,
                tache_type_id: BigInt(tacheTypeId)
              },
              data: {
                heures_prevues: heuresParTache[tacheTypeId]
              }
            });
          }
        }
      }
    });

    // Récupérer le projet mis à jour avec ses relations
    const projetComplet = await prisma.projet.findUnique({
      where: { id },
      include: {
        status: true,
        client: true,
        taches: {
          include: { tache_type: true }
        },
        affectations: {
          include: {
            salarie: true,
            tache_type: true,
            tache_projet: { include: { tache_type: true } }
          }
        }
      }
    });

    res.json(serializeBigInt(projetComplet));
  } catch (error: any) {
    console.error('Erreur modification projet:', error);
    
    // Gestion de l'erreur de contrainte unique (code projet déjà existant)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'champ';
      return res.status(400).json({ 
        error: `Ce ${field === 'code_projet' ? 'code projet' : field} existe déjà.` 
      });
    }
    
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/projets/:id/taches - Ajouter une tâche au projet
router.post('/:id/taches', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet_id = BigInt(req.params.id);
    const { tache_type_id, type_tache, heures_prevues, taux_horaire, description } = req.body;

    let tacheTypeId: bigint;

    // Accepter soit tache_type_id direct, soit type_tache (code ou nom)
    if (tache_type_id) {
      tacheTypeId = BigInt(tache_type_id);
    } else if (type_tache) {
      // Chercher le type de tâche par code ou nom
      const tacheType = await prisma.tacheType.findFirst({
        where: {
          OR: [
            { code: type_tache },
            { tache_type: type_tache },
            { tache_type: { contains: type_tache, mode: 'insensitive' } }
          ]
        }
      });

      if (!tacheType) {
        return res.status(400).json({ error: `Type de tâche "${type_tache}" non trouvé` });
      }
      tacheTypeId = tacheType.id;
    } else {
      return res.status(400).json({ error: 'Type de tâche requis (tache_type_id ou type_tache)' });
    }

    // Vérifier si la tâche existe déjà pour ce projet
    const existingTache = await prisma.tacheProjet.findFirst({
      where: {
        projet_id,
        tache_type_id: tacheTypeId
      }
    });

    if (existingTache) {
      // Retourner la tâche existante sans erreur
      return res.json(serializeBigInt(existingTache));
    }

    const tache = await prisma.tacheProjet.create({
      data: {
        projet_id,
        tache_type_id: tacheTypeId,
        heures_prevues: heures_prevues || 0,
        taux_horaire: taux_horaire || 50,
        description
      },
      include: {
        tache_type: true
      }
    });

    res.status(201).json(serializeBigInt(tache));
  } catch (error) {
    console.error('Erreur ajout tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/projets/:id/taches/:tacheId - Mettre à jour les heures estimées d'une tâche
router.put('/:id/taches/:tacheId', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet_id = BigInt(req.params.id);
    const tache_id = BigInt(req.params.tacheId);
    const { heures_prevues, taux_horaire, description } = req.body;

    // Vérifier que la tâche appartient au projet
    const tache = await prisma.tacheProjet.findFirst({
      where: {
        id: tache_id,
        projet_id: projet_id
      }
    });

    if (!tache) {
      return res.status(404).json({ error: 'Tâche non trouvée pour ce projet' });
    }

    // Mettre à jour la tâche
    const tacheUpdatee = await prisma.tacheProjet.update({
      where: { id: tache_id },
      data: {
        ...(heures_prevues !== undefined && { heures_prevues: Number(heures_prevues) }),
        ...(taux_horaire !== undefined && { taux_horaire: Number(taux_horaire) }),
        ...(description !== undefined && { description })
      },
      include: {
        tache_type: true
      }
    });

    res.json(serializeBigInt(tacheUpdatee));
  } catch (error) {
    console.error('Erreur mise à jour tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/projets/:id/taches/:tacheId - Supprimer une tâche d'un projet
router.delete('/:id/taches/:tacheId', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet_id = BigInt(req.params.id);
    const tache_id = BigInt(req.params.tacheId);

    // Vérifier que la tâche appartient au projet
    const tache = await prisma.tacheProjet.findFirst({
      where: {
        id: tache_id,
        projet_id: projet_id
      }
    });

    if (!tache) {
      return res.status(404).json({ error: 'Tâche non trouvée pour ce projet' });
    }

    // Vérifier s'il y a des pointages pour cette tâche
    // Note: Les tâches personnalisées (sans tache_type_id) ne peuvent pas avoir de pointages
    // car les pointages utilisent uniquement tache_type_id (non-null)
    if (tache.tache_type_id !== null) {
      const pointages = await prisma.salariePointage.findMany({
        where: {
          projet_id: projet_id,
          tache_type_id: tache.tache_type_id
        },
        take: 1 // On a juste besoin de savoir s'il y en a
      });

      if (pointages.length > 0) {
        return res.status(400).json({ 
          error: 'Impossible de supprimer cette tâche car elle contient des heures de pointage' 
        });
      }
    }

    // Vérifier s'il y a des affectations pour cette tâche
    const affectations = await prisma.tacheProjetSalarie.findMany({
      where: {
        tache_projet_id: tache_id
      },
      take: 1
    });

    if (affectations.length > 0) {
      // Supprimer d'abord les affectations
      await prisma.tacheProjetSalarie.deleteMany({
        where: {
          tache_projet_id: tache_id
        }
      });
    }

    // Supprimer la tâche
    await prisma.tacheProjet.delete({
      where: { id: tache_id }
    });

    res.json({ message: 'Tâche supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/projets/:id/affectations - Affecter un salarié
router.post('/:id/affectations', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet_id = BigInt(req.params.id);
    const { salarie_id, tache_projet_id, tache_type_id } = req.body;

    if (!salarie_id || !tache_projet_id) {
      return res.status(400).json({ error: 'Salarié et tâche projet requis' });
    }

    // Récupérer la tâche projet pour obtenir le tache_type_id si non fourni
    const tacheProjet = await prisma.tacheProjet.findUnique({
      where: { id: BigInt(tache_projet_id) }
    });

    if (!tacheProjet) {
      return res.status(404).json({ error: 'Tâche projet non trouvée' });
    }

    // Pour les tâches personnalisées (sans tache_type_id), on utilise null
    // Pour les tâches globales, on utilise le tache_type_id de la tâche projet
    const finalTacheTypeId = tache_type_id 
      ? BigInt(tache_type_id) 
      : (tacheProjet.tache_type_id ? tacheProjet.tache_type_id : null);

    // Vérifier si l'affectation existe déjà
    const existingAffectation = await prisma.tacheProjetSalarie.findFirst({
      where: {
        tache_projet_id: BigInt(tache_projet_id),
        salarie_id: BigInt(salarie_id)
      }
    });

    if (existingAffectation) {
      return res.status(400).json({ error: 'Ce salarié est déjà assigné à cette tâche' });
    }

    const affectation = await prisma.tacheProjetSalarie.create({
      data: {
        projet_id,
        salarie_id: BigInt(salarie_id),
        tache_projet_id: BigInt(tache_projet_id),
        tache_type_id: finalTacheTypeId
      },
      include: {
        salarie: {
          select: { id: true, nom: true, prenom: true }
        },
        tache_type: true,
        tache_projet: {
          include: { tache_type: true }
        }
      }
    });

    res.status(201).json(serializeBigInt(affectation));
  } catch (error: any) {
    console.error('Erreur affectation:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ce salarié est déjà assigné à cette tâche' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/projets/:id/affectations/:affectationId - Supprimer une affectation salarié
router.delete('/:id/affectations/:affectationId', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projet_id = BigInt(req.params.id);
    const affectation_id = BigInt(req.params.affectationId);

    // Vérifier que l'affectation appartient au projet
    const affectation = await prisma.tacheProjetSalarie.findFirst({
      where: {
        id: affectation_id,
        projet_id: projet_id
      }
    });

    if (!affectation) {
      return res.status(404).json({ error: 'Affectation non trouvée pour ce projet' });
    }

    // Supprimer l'affectation
    await prisma.tacheProjetSalarie.delete({
      where: { id: affectation_id }
    });

    res.json({ message: 'Affectation supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression affectation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/projets/:id/archive - Archiver/Restaurer un projet
router.patch('/:id/archive', authMiddleware, managerMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const { archive } = req.body;

    // Vérifier que le projet existe
    const projet = await prisma.projet.findUnique({
      where: { id }
    });

    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Mettre à jour le statut d'archivage
    const projetArchive = await prisma.projet.update({
      where: { id },
      data: { archive: archive === true || archive === 'true' }
    });

    res.json(serializeBigInt(projetArchive));
  } catch (error: any) {
    console.error('Erreur archivage projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/projets/:id - Supprimer définitivement un projet archivé (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    console.log('=== DELETE /api/projets/:id ===');
    console.log('Projet ID à supprimer:', id.toString());

    // Vérifier que le projet existe et est archivé
    const projet = await prisma.projet.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            pointages: true,
            affectations: true,
            taches: true
          }
        }
      }
    });

    if (!projet) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Vérifier que le projet est archivé avant suppression définitive
    if (!projet.archive) {
      return res.status(400).json({ 
        error: 'Le projet doit être archivé avant de pouvoir être supprimé définitivement' 
      });
    }

    console.log('Projet trouvé:', {
      nom: projet.nom,
      code_projet: projet.code_projet,
      archive: projet.archive,
      pointages: projet._count.pointages,
      affectations: projet._count.affectations,
      taches: projet._count.taches
    });

    // Supprimer le projet (CASCADE supprimera automatiquement les relations)
    await prisma.projet.delete({
      where: { id }
    });

    console.log('Projet supprimé définitivement avec succès');
    res.json({ message: 'Projet supprimé définitivement avec succès' });
  } catch (error: any) {
    console.error('Erreur suppression projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;