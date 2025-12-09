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

    // Récupérer les projets où le salarié est assigné
    const affectations = await prisma.tacheProjetSalarie.findMany({
      where: { salarie_id: salarieId },
      select: { projet_id: true, tache_projet_id: true, tache_type_id: true }
    });

    const projetIds = [...new Set(affectations.map(a => a.projet_id))];

    if (projetIds.length === 0) {
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

    res.json(serializeBigInt(projets));
  } catch (error) {
    console.error('Erreur mes-projets:', error);
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

    // taches peut être un tableau d'IDs de tache_type
    const tacheTypeIds: number[] = data.taches || [];
    console.log('Taches reçues:', tacheTypeIds);

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
      if (tacheTypeIds.length > 0) {
        console.log('Création de', tacheTypeIds.length, 'tâches...');
        for (const tacheTypeId of tacheTypeIds) {
          console.log('  - Création tache_projet pour tache_type_id:', tacheTypeId);
          await tx.tacheProjet.create({
            data: {
              projet_id: projet.id,
              tache_type_id: BigInt(tacheTypeId),
              heures_prevues: 0,
              taux_horaire: 50
            }
          });
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

    const updateData: any = { ...data };
    
    if (data.projet_status_id) updateData.projet_status_id = BigInt(data.projet_status_id);
    if (data.client_id) updateData.client_id = BigInt(data.client_id);
    if (data.responsable_id) updateData.responsable_id = BigInt(data.responsable_id);
    if (data.start_date) updateData.start_date = new Date(data.start_date);
    if (data.end_date) updateData.end_date = new Date(data.end_date);

    const projet = await prisma.projet.update({
      where: { id },
      data: updateData,
      include: {
        status: true,
        client: true
      }
    });

    res.json(serializeBigInt(projet));
  } catch (error) {
    console.error('Erreur modification projet:', error);
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
    const existingTache = await prisma.tacheProjet.findUnique({
      where: {
        projet_id_tache_type_id: {
          projet_id,
          tache_type_id: tacheTypeId
        }
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

    const finalTacheTypeId = tache_type_id ? BigInt(tache_type_id) : tacheProjet.tache_type_id;

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

// DELETE /api/projets/:id - Archiver un projet
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = BigInt(req.params.id);

    await prisma.projet.update({
      where: { id },
      data: { archive: true, actif: false }
    });

    res.json({ message: 'Projet archivé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
