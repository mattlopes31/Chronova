import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FolderKanban,
  Users,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  Settings,
  Save,
  X,
  Shuffle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projetsApi, clientsApi, salariesApi, tachesApi } from '@/services/api';
import type { Projet, Client, Salarie } from '@/types';
import { Card, Button, Badge, Modal, Input, Select, Checkbox, Spinner, EmptyState } from '@/components/ui';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjetForm {
  id?: number;
  code_projet: string;
  nom: string;
  description: string;
  client_id: string;
  projet_status_id: string;
  start_date: string;
  end_date: string;
  budget_heures: string;
  budget_euros: string;
  priorite: string;
  actif: boolean;
}

const initialForm: ProjetForm = {
  code_projet: '',
  nom: '',
  description: '',
  client_id: '',
  projet_status_id: '1',
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: '',
  budget_heures: '',
  budget_euros: '',
  priorite: '1',
  actif: true,
};

export const ProjetsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isNewTacheModalOpen, setIsNewTacheModalOpen] = useState(false);
  const [isEditHeuresModalOpen, setIsEditHeuresModalOpen] = useState(false);
  const [tacheToDelete, setTacheToDelete] = useState<string | null>(null);
  const [selectedProjet, setSelectedProjet] = useState<any>(null);
  const [expandedProjet, setExpandedProjet] = useState<number | null>(null);
  const [form, setForm] = useState<ProjetForm>(initialForm);
  const [selectedTaches, setSelectedTaches] = useState<string[]>([]); // IDs des tâches du projet (tache_projet.id)
  const [tachesProjet, setTachesProjet] = useState<any[]>([]); // Liste des tâches créées pour ce projet
  const [assignSalarie, setAssignSalarie] = useState<string>('');
  const [assignTache, setAssignTache] = useState<string>('');
  const [newTache, setNewTache] = useState({ nom: '', heures_prevues: 0, couleur: '#10B981' });
  const [editingTache, setEditingTache] = useState<{ projetId: number; tacheId: string } | null>(null);
  const [tacheHeures, setTacheHeures] = useState<string>('');
  const [tachesHeuresModal, setTachesHeuresModal] = useState<Record<string, number>>({}); // tache_type_id -> heures_prevues
  const [tachesNomsModal, setTachesNomsModal] = useState<Record<string, string>>({}); // tache_type_id -> nouveau nom
  const [tachesCouleursModal, setTachesCouleursModal] = useState<Record<string, string>>({}); // tache_projet_id -> couleur

  // Queries
  const { data: projets = [], isLoading } = useQuery<Projet[]>({
    queryKey: ['projets'],
    queryFn: () => projetsApi.getAll(),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.getAll(),
  });

  const { data: salaries = [] } = useQuery<Salarie[]>({
    queryKey: ['salaries'],
    queryFn: () => salariesApi.getAll(),
  });

  const { data: projetStatuts = [] } = useQuery({
    queryKey: ['projet-statuts'],
    queryFn: () => projetsApi.getStatuts(),
  });

  // Charger les types de tâches depuis la BDD
  const { data: tacheTypes = [] } = useQuery({
    queryKey: ['tache-types'],
    queryFn: () => tachesApi.getAll({ actif: true }),
  });

  // Mutation pour mettre à jour les heures estimées d'une tâche
  const updateTacheMutation = useMutation({
    mutationFn: ({ projetId, tacheId, heures_prevues }: { projetId: string; tacheId: string; heures_prevues: number }) =>
      projetsApi.updateTache(projetId, tacheId, { heures_prevues }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      queryClient.invalidateQueries({ queryKey: ['projets-details'] });
      setEditingTache(null);
      setTacheHeures('');
      toast.success('Heures estimées mises à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  // Mutation pour supprimer une tâche
  const deleteTacheMutation = useMutation({
    mutationFn: ({ projetId, tacheId }: { projetId: string; tacheId: string }) =>
      projetsApi.deleteTache(projetId, tacheId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      queryClient.invalidateQueries({ queryKey: ['projets-details'] });
      toast.success('Tâche supprimée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  // Mutation pour supprimer une affectation
  const deleteAffectationMutation = useMutation({
    mutationFn: ({ projetId, affectationId }: { projetId: string; affectationId: string }) =>
      projetsApi.deleteAffectation(projetId, affectationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      toast.success('Affectation supprimée');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('=== createMutation ===');
      console.log('Data reçue dans mutation:', data);
      
      // Construire les données à envoyer avec les heures estimées
      // data.taches contient les objets {tache_type_id, heures_prevues}
      const dataToSend = {
        ...data.projet,
        taches: data.taches || data.projet.taches, // Utiliser data.taches (avec heures) si disponible
      };
      console.log('Data à envoyer à l\'API:', dataToSend);
      
      const projet = await projetsApi.create(dataToSend);
      console.log('Réponse API:', projet);
      return projet;
    },
    onSuccess: () => {
      toast.success('Projet créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      closeModal();
    },
    onError: (error: any) => {
      console.error('Erreur création:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projetsApi.update(id, data),
    onSuccess: () => {
      toast.success('Projet mis à jour');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      projetsApi.archive(id, archive),
    onSuccess: (_, variables) => {
      toast.success(variables.archive ? 'Projet archivé' : 'Projet restauré');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      setIsDeleteModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'archivage');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projetsApi.delete,
    onSuccess: () => {
      toast.success('Projet supprimé définitivement');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      setIsDeleteModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ projetId, data }: { projetId: string; data: any }) =>
      projetsApi.addAffectation(projetId, data),
    onSuccess: () => {
      toast.success('Salarié assigné au projet');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      setIsAssignModalOpen(false);
      setAssignSalarie('');
      setAssignTache('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'assignation');
    },
  });

  // Mutation pour créer une nouvelle tâche
  const createTacheMutation = useMutation({
    mutationFn: (data: { tache_type: string; code: string; couleur: string }) =>
      tachesApi.create(data),
    onSuccess: (data) => {
      toast.success('Nouvelle tâche créée');
      queryClient.invalidateQueries({ queryKey: ['tache-types'] });
      // Sélectionner automatiquement la nouvelle tâche
      setSelectedTaches((prev) => [...prev, data.id]);
      setIsNewTacheModalOpen(false);
      setNewTache({ tache_type: '', code: '', couleur: '#10B981' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  // Mutation pour mettre à jour le nom d'une tâche
  const updateTacheNomMutation = useMutation({
    mutationFn: ({ tacheId, nouveauNom }: { tacheId: string; nouveauNom: string }) =>
      tachesApi.update(tacheId, { tache_type: nouveauNom }),
    onSuccess: () => {
      toast.success('Nom de la tâche mis à jour');
      queryClient.invalidateQueries({ queryKey: ['tache-types'] });
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      queryClient.invalidateQueries({ queryKey: ['projets-details'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // Mutation pour supprimer un type de tâche
  const deleteTacheTypeMutation = useMutation({
    mutationFn: (tacheId: string) => tachesApi.delete(tacheId),
    onSuccess: () => {
      toast.success('Type de tâche supprimé');
      queryClient.invalidateQueries({ queryKey: ['tache-types'] });
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      queryClient.invalidateQueries({ queryKey: ['projets-details'] });
      // Retirer la tâche de la sélection
      setSelectedTaches((prev) => prev.filter((id) => id !== tacheToDelete));
      setTachesHeuresModal((prev) => {
        const newHeures = { ...prev };
        delete newHeures[tacheToDelete || ''];
        return newHeures;
      });
      setTachesNomsModal((prev) => {
        const newNoms = { ...prev };
        delete newNoms[tacheToDelete || ''];
        return newNoms;
      });
      setTacheToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
      setTacheToDelete(null);
    },
  });

  // Initialiser les couleurs dans tachesCouleursModal lorsque le modal d'édition s'ouvre
  useEffect(() => {
    if (isEditHeuresModalOpen && selectedTaches.length > 0 && tachesProjet.length > 0) {
      const nouvellesCouleurs: Record<string, string> = {};
      selectedTaches.forEach((tacheId) => {
        const tache = tachesProjet.find((t: any) => t.id === tacheId);
        if (tache && !tachesCouleursModal[tacheId]) {
          // Initialiser avec la couleur de la tâche si elle n'est pas déjà dans le modal
          nouvellesCouleurs[tacheId] = tache.couleur || '#10B981';
        }
      });
      if (Object.keys(nouvellesCouleurs).length > 0) {
        setTachesCouleursModal(prev => ({ ...prev, ...nouvellesCouleurs }));
      }
    }
  }, [isEditHeuresModalOpen, selectedTaches, tachesProjet]);

  // Filtrage
  const filteredProjets = projets
    .filter((p: any) => {
      const matchSearch =
        p.nom.toLowerCase().includes(search.toLowerCase()) ||
        p.code_projet?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || p.projet_status_id?.toString() === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a: any, b: any) => {
      // Projets archivés en bas
      if (a.archive && !b.archive) return 1;
      if (!a.archive && b.archive) return -1;
      // Trier par code_projet en ordre croissant pour les projets non archivés
      const codeA = a.code_projet || '';
      const codeB = b.code_projet || '';
      return codeA.localeCompare(codeB, 'fr', { numeric: true, sensitivity: 'base' });
    });

  // Handlers
  const openCreateModal = () => {
    setForm(initialForm);
    setSelectedTaches([]);
    setTachesProjet([]);
    setSelectedProjet(null);
    setTachesHeuresModal({});
    setTachesNomsModal({});
    setTachesCouleursModal({});
    setIsModalOpen(true);
  };

  const openEditModal = (projet: any) => {
    if (projet.archive) {
      toast.error('Ce projet est archivé et ne peut pas être modifié');
      return;
    }
    setSelectedProjet(projet);
    setForm({
      id: projet.id,
      code_projet: projet.code_projet || '',
      nom: projet.nom,
      description: projet.description || '',
      client_id: projet.client_id?.toString() || '',
      projet_status_id: projet.projet_status_id?.toString() || '1',
      start_date: projet.start_date ? format(parseISO(projet.start_date), 'yyyy-MM-dd') : '',
      end_date: projet.end_date ? format(parseISO(projet.end_date), 'yyyy-MM-dd') : '',
      budget_heures: projet.budget_heures?.toString() || '',
      budget_euros: projet.budget_euros?.toString() || '',
      priorite: projet.priorite?.toString() || '1',
      actif: projet.actif,
    });
    // Initialiser les tâches du projet (utiliser nom_tache si disponible, sinon tache_type)
    const tachesProjetData = projet.taches?.map((t: any) => ({
      id: String(t.id),
      nom_tache: t.nom_tache || t.tache_type?.tache_type || 'Tâche sans nom',
      code: t.code || t.tache_type?.code || null, // Code de la tâche
      heures_prevues: Number(t.heures_prevues || 0),
      couleur: t.couleur || t.tache_type?.couleur || '#10B981',
      tache_type_id: t.tache_type_id ? String(t.tache_type_id) : null, // Garder la référence pour savoir si c'est une tâche personnalisée
      tache_type: t.tache_type, // Garder la référence complète pour accéder au code
    })) || [];
    setTachesProjet(tachesProjetData);
    
    // Initialiser les IDs sélectionnés et les heures
    const tacheIds = tachesProjetData.map((t: any) => t.id);
    setSelectedTaches(tacheIds);
    
    const heuresMap: Record<string, number> = {};
    const couleursMap: Record<string, string> = {};
    tachesProjetData.forEach((t: any) => {
      heuresMap[t.id] = t.heures_prevues;
      // S'assurer qu'une couleur est toujours définie : utiliser celle de la tâche (qui vient de tache_projet.couleur ou tache_type.couleur)
      // Cette couleur sera utilisée dans le modal d'édition
      const couleurTache = t.couleur || '#10B981';
      couleursMap[t.id] = couleurTache;
      console.log(`Initialisation couleur pour tâche ${t.id} (${t.nom_tache}): ${couleurTache}`);
    });
    setTachesHeuresModal(heuresMap);
    setTachesCouleursModal(couleursMap);
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(initialForm);
    setSelectedTaches([]);
    setTachesProjet([]);
    setSelectedProjet(null);
    setTachesHeuresModal({});
    setTachesNomsModal({});
  };

  const toggleTache = (tacheId: string) => {
    console.log('Toggle tache ID:', tacheId, 'type:', typeof tacheId);
    setSelectedTaches((prev) => {
      const newTaches = prev.includes(tacheId) ? prev.filter((t) => t !== tacheId) : [...prev, tacheId];
      console.log('Selected taches après toggle:', newTaches);
      
      // Si on désélectionne une tâche, retirer ses heures et nom du state
      if (prev.includes(tacheId) && !newTaches.includes(tacheId)) {
        setTachesHeuresModal((prevHeures) => {
          const newHeures = { ...prevHeures };
          delete newHeures[tacheId];
          return newHeures;
        });
        setTachesNomsModal((prevNoms) => {
          const newNoms = { ...prevNoms };
          delete newNoms[tacheId];
          return newNoms;
        });
      } else if (!prev.includes(tacheId) && newTaches.includes(tacheId)) {
        // Si on sélectionne une nouvelle tâche, initialiser ses heures à 0 et son nom
        setTachesHeuresModal((prevHeures) => ({
          ...prevHeures,
          [tacheId]: 0,
        }));
        const tache = tacheTypes.find((t: any) => t.id === tacheId);
        if (tache) {
          setTachesNomsModal((prevNoms) => ({
            ...prevNoms,
            [tacheId]: tache.tache_type,
          }));
        }
      }
      
      return newTaches;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('=== handleSubmit ===');
    console.log('Form:', form);
    console.log('Selected taches:', selectedTaches);

    if (!form.code_projet || !form.nom) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    if (selectedTaches.length === 0) {
      toast.error('Sélectionnez au moins une tâche pour ce projet');
      return;
    }

    // Préparer les données des tâches du projet (avec nom_tache si c'est une nouvelle tâche)
    const tachesData = selectedTaches.map(tid => {
      const tacheProjet = tachesProjet.find((t: any) => t.id === tid);
      if (tacheProjet && tid.startsWith('temp-')) {
        // Nouvelle tâche créée dans le projet (sans tache_type_id)
        return {
          nom_tache: tacheProjet.nom_tache || tacheProjet.nom,
          heures_prevues: tachesHeuresModal[tid] || tacheProjet.heures_prevues || 0,
          couleur: tacheProjet.couleur || '#10B981',
        };
      } else if (tacheProjet) {
        // Tâche existante du projet
        // Récupérer la couleur modifiée depuis le modal
        const couleurModifiee = tachesCouleursModal[tid];
        const couleurOriginale = tacheProjet.couleur;
        
        // Construire l'objet de base
        const tacheData: any = {
          tache_projet_id: tid,
          heures_prevues: tachesHeuresModal[tid] || tacheProjet.heures_prevues || 0,
          nom_tache: tachesNomsModal[tid] || tacheProjet.nom_tache,
        };
        
        // Toujours envoyer la couleur si elle existe dans tachesCouleursModal (modifiée dans le modal)
        // Cela permet de personnaliser la couleur même pour les tâches avec tache_type_id
        if (couleurModifiee !== undefined && couleurModifiee !== null) {
          tacheData.couleur = couleurModifiee;
        } else if (!tacheProjet.tache_type_id && couleurOriginale) {
          // Pour les tâches personnalisées sans modification dans le modal, envoyer la couleur existante
          tacheData.couleur = couleurOriginale;
        }
        // Pour les tâches avec tache_type_id sans modification, on n'envoie pas de couleur (elle viendra du tache_type)
        
        console.log(`Envoi tâche ${tid}: couleur modifiée=${couleurModifiee}, couleur originale=${couleurOriginale}, tache_type_id=${tacheProjet.tache_type_id}, couleur envoyée=${tacheData.couleur}`);
        
        return tacheData;
      } else {
        // Fallback pour compatibilité
        return {
          tache_type_id: parseInt(tid, 10),
          heures_prevues: tachesHeuresModal[tid] || 0
        };
      }
    });

    const projetData = {
      code_projet: form.code_projet,
      nom: form.nom,
      description: form.description || null,
      client_id: form.client_id ? parseInt(form.client_id) : null,
      projet_status_id: form.projet_status_id ? parseInt(form.projet_status_id) : 1,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget_heures: form.budget_heures ? parseInt(form.budget_heures) : null,
      budget_euros: form.budget_euros ? parseFloat(form.budget_euros) : null,
      priorite: form.priorite ? parseInt(form.priorite) : 1,
      actif: form.actif,
      taches: tachesData, // Inclure les tâches avec heures si édition, sinon juste les IDs
    };

    console.log('Tâches sélectionnées (strings):', selectedTaches);
    console.log('Tâches avec heures:', tachesData);

    console.log('Projet data:', projetData);
    console.log('Taches à envoyer:', tachesData);

    if (selectedProjet) {
      updateMutation.mutate({ id: selectedProjet.id, data: projetData });
    } else {
      // Pour la création, on envoie les tâches avec leurs heures dans projetData.taches
      createMutation.mutate({ projet: projetData, taches: tachesData });
    }
  };

  const openAssignModal = (projet: any) => {
    if (projet.archive) {
      toast.error('Ce projet est archivé et ne peut plus recevoir d\'assignations');
      return;
    }
    setSelectedProjet(projet);
    setAssignSalarie('');
    setAssignTache('');
    setIsAssignModalOpen(true);
  };

  const handleAssign = () => {
    if (!assignSalarie || !assignTache) {
      toast.error('Sélectionnez un salarié et une tâche');
      return;
    }

    // Trouver la tâche du projet par son tache_projet_id (id de la tâche dans le projet)
    const tache = selectedProjet.taches?.find((t: any) => 
      String(t.id) === assignTache
    );
    
    if (!tache) {
      toast.error('Tâche non trouvée dans ce projet');
      console.error('Tâches disponibles:', selectedProjet.taches);
      console.error('Tâche recherchée:', assignTache);
      return;
    }

    assignMutation.mutate({
      projetId: selectedProjet.id,
      data: {
        salarie_id: assignSalarie,
        tache_projet_id: tache.id,
        tache_type_id: tache.tache_type_id ? String(tache.tache_type_id) : undefined, // Optionnel pour les tâches personnalisées
      },
    });
  };

  const getStatusBadge = (statusId: number) => {
    const status = projetStatuts.find((s: any) => s.id === statusId);
    if (!status) return <Badge variant="default">Inconnu</Badge>;

    switch (status.status) {
      case 'En_cours':
        return (
          <Badge variant="success">
            <Clock className="w-3 h-3 mr-1" />
            En cours
          </Badge>
        );
      case 'Termine':
        return (
          <Badge variant="info">
            <CheckCircle className="w-3 h-3 mr-1" />
            Terminé
          </Badge>
        );
      case 'Stoppe':
        return (
          <Badge variant="warning">
            <Pause className="w-3 h-3 mr-1" />
            Stoppé
          </Badge>
        );
      case 'Annule':
        return (
          <Badge variant="danger">
            <XCircle className="w-3 h-3 mr-1" />
            Annulé
          </Badge>
        );
      default:
        return <Badge variant="default">{status.status}</Badge>;
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client?.nom || '-';
  };

  const getTacheLabel = (tacheTypeId: string) => {
    const tache = tacheTypes.find((t: any) => t.id === tacheTypeId);
    return tache?.tache_type || 'Tâche';
  };

  const getTacheColor = (tacheTypeId: string) => {
    const tache = tacheTypes.find((t: any) => t.id === tacheTypeId);
    const couleur = tache?.couleur || '#6B7280';
    // Convertir la couleur hex en classe Tailwind-like
    return { backgroundColor: `${couleur}20`, color: couleur };
  };

  // Filtrer les salariés selon leur fonction pour l'assignation
  const getSalariesForTache = (tacheTypeId: string) => {
    const tache = tacheTypes.find((t: any) => t.id?.toString() === tacheTypeId);
    const salariesActifs = salaries.filter((s: any) => s.actif);
    
    if (!tache) return salariesActifs;
    
    // Mapping fonction → codes de tâche recommandés
    const tacheCode = tache.code;
    const fonctionToTacheCode: Record<string, string[]> = {
      Cableur: ['CAB'],
      DAO: ['DAO'],
      Prog: ['PROG', 'SCADA'],
      Chef_Projet: ['CAB', 'DAO', 'PROG', 'SCADA', 'MES', 'ETU', 'AUT', 'FORM', 'REU', 'SAV', 'ADM'],
      Admin: ['CAB', 'DAO', 'PROG', 'SCADA', 'MES', 'ETU', 'AUT', 'FORM', 'REU', 'SAV', 'ADM'],
      Autre: ['AUT', 'MES', 'ETU'],
    };

    // Retourner TOUS les salariés actifs, avec une propriété "recommande"
    return salariesActifs.map((s: any) => {
      const fonction = s.fonction?.fonction;
      const codesAcceptes = fonction ? fonctionToTacheCode[fonction] : null;
      const recommande = !codesAcceptes || codesAcceptes.includes(tacheCode);
      return { ...s, recommande };
    }).sort((a: any, b: any) => {
      // Salariés recommandés en premier
      if (a.recommande && !b.recommande) return -1;
      if (!a.recommande && b.recommande) return 1;
      return 0;
    });
  };

  if (isLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Projets</h1>
          <p className="text-gray-500">{projets.length} projets enregistrés</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou code..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'Tous les statuts' },
              ...projetStatuts.map((s: any) => ({
                value: s.id.toString(),
                label: s.status.replace('_', ' '),
              })),
            ]}
            className="w-44"
          />
        </div>
      </Card>

      {/* Liste des projets */}
      {filteredProjets.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-12 h-12" />}
          title="Aucun projet trouvé"
          description="Créez votre premier projet pour commencer"
          action={
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un projet
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredProjets.map((projet: any) => (
            <Card key={projet.id} className={`overflow-hidden ${projet.archive ? 'opacity-60 bg-gray-50' : ''}`}>
              {/* En-tête du projet */}
              <div
                className={`p-4 cursor-pointer transition-colors ${projet.archive ? 'hover:bg-gray-100' : 'hover:bg-gray-50'}`}
                onClick={() => setExpandedProjet(expandedProjet === projet.id ? null : projet.id)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                      <FolderKanban className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-500">{projet.code_projet}</span>
                        <h3 className="font-semibold text-gray-900">{projet.nom}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {projet.client_id && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {getClientName(projet.client_id)}
                          </span>
                        )}
                        {projet.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(parseISO(projet.start_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {getStatusBadge(projet.projet_status_id)}
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      {projet.affectations?.length || 0} assignés
                    </span>
                    {expandedProjet === projet.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {!projet.archive && (
                      <>
                        <button
                          onClick={() => openAssignModal(projet)}
                          className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                          title="Assigner des salariés"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(projet)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSelectedProjet(projet);
                        setIsDeleteModalOpen(true);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        projet.archive 
                          ? 'hover:bg-green-50 text-green-600' 
                          : 'hover:bg-red-50 text-red-600'
                      }`}
                      title={projet.archive ? 'Restaurer le projet' : 'Finir le projet'}
                    >
                      {projet.archive ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>
                    {projet.archive && (
                      <button
                        onClick={() => {
                          setSelectedProjet(projet);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Détails expandés */}
              {expandedProjet === projet.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                  {/* Tâches du projet */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Tâches du projet</h4>
                    {projet.taches?.length > 0 ? (
                      <div className="space-y-2">
                        {projet.taches
                          .slice()
                          .sort((a: any, b: any) => {
                            const nomA = (a.nom_tache || a.tache_type?.tache_type || '').toLowerCase();
                            const nomB = (b.nom_tache || b.tache_type?.tache_type || '').toLowerCase();
                            return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
                          })
                          .map((tache: any) => {
                          const isEditing = editingTache?.projetId === projet.id && editingTache?.tacheId === String(tache.id);
                          return (
                            <div
                              key={tache.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <span
                                  className="px-3 py-1 rounded-full text-sm font-medium"
                                  style={{ 
                                    backgroundColor: `${tache.couleur || tache.tache_type?.couleur || '#10B981'}20`, 
                                    color: tache.couleur || tache.tache_type?.couleur || '#10B981' 
                                  }}
                                >
                                  {(() => {
                                    const code = tache.code || tache.tache_type?.code;
                                    const nom = tache.nom_tache || tache.tache_type?.tache_type || getTacheLabel(String(tache.tache_type_id));
                                    return code ? `${code} - ${nom}` : nom;
                                  })()}
                                </span>
                                {isEditing ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      type="number"
                                      placeholder="Heures estimées"
                                      value={tacheHeures}
                                      onChange={(e) => setTacheHeures(e.target.value)}
                                      className="w-32"
                                      min="0"
                                      step="0.5"
                                    />
                                    <span className="text-sm text-gray-500">h</span>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => {
                                        const heures = parseFloat(tacheHeures) || 0;
                                        updateTacheMutation.mutate({
                                          projetId: String(projet.id),
                                          tacheId: String(tache.id),
                                          heures_prevues: heures,
                                        });
                                      }}
                                      disabled={updateTacheMutation.isPending}
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        setEditingTache(null);
                                        setTacheHeures('');
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">
                                      Heures estimées: <span className="font-semibold text-gray-900">{tache.heures_prevues || 0}h</span>
                                    </span>
                                    {!projet.archive && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            setEditingTache({ projetId: projet.id, tacheId: String(tache.id) });
                                            setTacheHeures(String(tache.heures_prevues || 0));
                                          }}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <button
                                          onClick={() => {
                                            if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
                                              deleteTacheMutation.mutate({
                                                projetId: String(projet.id),
                                                tacheId: String(tache.id),
                                              });
                                            }
                                          }}
                                          className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                                          title="Supprimer la tâche"
                                          disabled={deleteTacheMutation.isPending}
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Aucune tâche définie</span>
                    )}
                  </div>

                  {/* Salariés assignés */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Salariés assignés</h4>
                    {projet.affectations?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(() => {
                          // Regrouper les affectations par salarié
                          const affectationsParSalarie = projet.affectations.reduce((acc: any, aff: any) => {
                            const salarieId = aff.salarie_id?.toString() || aff.salarie?.id?.toString();
                            if (!salarieId) return acc;
                            
                            if (!acc[salarieId]) {
                              acc[salarieId] = {
                                salarie: aff.salarie,
                                affectations: []
                              };
                            }
                            acc[salarieId].affectations.push(aff);
                            return acc;
                          }, {});

                          // Afficher un bloc par salarié avec toutes ses tâches
                          return Object.values(affectationsParSalarie).map((group: any, index: number) => (
                            <div
                              key={group.salarie?.id || index}
                              className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 relative group"
                            >
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-primary-700">
                                  {group.salarie?.prenom?.[0]}
                                  {group.salarie?.nom?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate mb-2">
                                  {group.salarie?.prenom} {group.salarie?.nom}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.affectations.map((aff: any) => (
                                    <span
                                      key={aff.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium relative group/tache"
                                      style={{ 
                                        backgroundColor: `${aff.tache_projet?.couleur || aff.tache_type?.couleur || '#10B981'}20`, 
                                        color: aff.tache_projet?.couleur || aff.tache_type?.couleur || '#10B981' 
                                      }}
                                    >
                                      {(() => {
                                        const code = aff.tache_projet?.code || aff.tache_type?.code;
                                        const nom = aff.tache_projet?.nom_tache || aff.tache_type?.tache_type || getTacheLabel(String(aff.tache_type_id));
                                        return code ? `${code} - ${nom}` : nom;
                                      })()}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) {
                                            deleteAffectationMutation.mutate({
                                              projetId: String(projet.id),
                                              affectationId: String(aff.id),
                                            });
                                          }
                                        }}
                                        className="opacity-0 group-hover/tache:opacity-100 ml-1 hover:bg-red-100 rounded p-0.5 transition-opacity"
                                        title="Supprimer l'affectation"
                                        disabled={deleteAffectationMutation.isPending}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm(`Êtes-vous sûr de vouloir supprimer toutes les affectations de ${group.salarie?.prenom} ${group.salarie?.nom} ?`)) {
                                    // Supprimer toutes les affectations de ce salarié
                                    group.affectations.forEach((aff: any) => {
                                      deleteAffectationMutation.mutate({
                                        projetId: String(projet.id),
                                        affectationId: String(aff.id),
                                      });
                                    });
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 rounded hover:bg-red-50 text-red-600 transition-opacity"
                                title="Supprimer toutes les affectations de ce salarié"
                                disabled={deleteAffectationMutation.isPending}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucun salarié assigné</p>
                    )}
                  </div>

                  {/* Budgets */}
                  {(projet.budget_heures || projet.budget_euros) && (
                    <div className="flex gap-6">
                      {projet.budget_heures && (
                        <div>
                          <span className="text-sm text-gray-500">Budget heures:</span>
                          <span className="ml-2 font-medium">{projet.budget_heures}h</span>
                        </div>
                      )}
                      {projet.budget_euros && (
                        <div>
                          <span className="text-sm text-gray-500">Budget:</span>
                          <span className="ml-2 font-medium">{projet.budget_euros}€</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Création/Édition Projet */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedProjet ? 'Modifier le projet' : 'Nouveau projet'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Informations générales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Code projet *"
                value={form.code_projet}
                onChange={(e) => setForm({ ...form, code_projet: e.target.value.toUpperCase() })}
                placeholder="PRJ-001"
              />
              <Input
                label="Nom du projet *"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Installation ligne production"
              />
              <Select
                label="Client"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                options={[
                  { value: '', label: 'Aucun client' },
                  ...clients.map((c: any) => ({
                    value: c.id.toString(),
                    label: c.nom,
                  })),
                ]}
              />
              <Select
                label="Statut"
                value={form.projet_status_id}
                onChange={(e) => setForm({ ...form, projet_status_id: e.target.value })}
                options={projetStatuts.map((s: any) => ({
                  value: s.id.toString(),
                  label: s.status.replace('_', ' '),
                }))}
              />
            </div>
            <div className="mt-4">
              <Input
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description du projet..."
              />
            </div>
          </div>

          {/* Tâches du projet */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Tâches du projet * <span className="text-gray-400 font-normal">(sélectionnez au moins une)</span>
              </h3>
              <div className="flex items-center gap-2">
                {selectedTaches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsEditHeuresModalOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Éditer les heures
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsNewTacheModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle tâche
                </button>
              </div>
            </div>
            {/* Afficher les tâches du projet */}
            {tachesProjet.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tachesProjet
                  .slice()
                  .sort((a: any, b: any) => {
                    const nomA = (a.nom_tache || a.nom || '').toLowerCase();
                    const nomB = (b.nom_tache || b.nom || '').toLowerCase();
                    return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
                  })
                  .map((tache: any) => {
                  const isSelected = selectedTaches.includes(tache.id);
                  const heuresActuelles = tachesHeuresModal[tache.id] || tache.heures_prevues || 0;
                  
                  return (
                    <div
                      key={tache.id}
                      className={`p-3 rounded-lg border-2 transition-all relative ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTache(tache.id)}
                        className="w-full text-left"
                      >
                        <span
                          className="inline-block px-2 py-1 rounded text-sm font-medium"
                          style={{ backgroundColor: `${tache.couleur || '#10B981'}20`, color: tache.couleur || '#10B981' }}
                        >
                          {(() => {
                            const code = tache.code || tache.tache_type?.code;
                            const nom = tache.nom_tache || tache.nom;
                            return code ? `${code} - ${nom}` : nom;
                          })()}
                        </span>
                        {heuresActuelles > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            {heuresActuelles}h
                          </div>
                        )}
                      </button>
                      {!tache.id.startsWith('temp-') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTachesProjet(tachesProjet.filter((t: any) => t.id !== tache.id));
                            setSelectedTaches(selectedTaches.filter((id) => id !== tache.id));
                            const newHeures = { ...tachesHeuresModal };
                            delete newHeures[tache.id];
                            setTachesHeuresModal(newHeures);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full hover:bg-red-100 text-red-600"
                          title="Supprimer cette tâche"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">Aucune tâche pour ce projet</p>
                <button
                  type="button"
                  onClick={() => setIsNewTacheModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une tâche à ce projet
                </button>
              </div>
            )}
          </div>

          {/* Dates */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Planning</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Date de début"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
              <Input
                label="Date de fin prévue"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Budgets */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Budget</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Budget heures"
                type="number"
                value={form.budget_heures}
                onChange={(e) => setForm({ ...form, budget_heures: e.target.value })}
                placeholder="100"
              />
              <Input
                label="Budget (€)"
                type="number"
                value={form.budget_euros}
                onChange={(e) => setForm({ ...form, budget_euros: e.target.value })}
                placeholder="5000"
              />
              <Select
                label="Priorité"
                value={form.priorite}
                onChange={(e) => setForm({ ...form, priorite: e.target.value })}
                options={[
                  { value: '1', label: '1 - Basse' },
                  { value: '2', label: '2 - Normale' },
                  { value: '3', label: '3 - Haute' },
                  { value: '4', label: '4 - Urgente' },
                ]}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {selectedProjet ? 'Mettre à jour' : 'Créer le projet'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Assignation */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assigner un salarié - ${selectedProjet?.nom}`}
        size="md"
      >
        <div className="space-y-4">
          {/* Afficher les tâches du projet */}
          {selectedProjet?.taches?.length > 0 ? (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Tâches disponibles :</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedProjet.taches
                    .slice()
                    .sort((a: any, b: any) => {
                      const nomA = (a.nom_tache || a.tache_type?.tache_type || '').toLowerCase();
                      const nomB = (b.nom_tache || b.tache_type?.tache_type || '').toLowerCase();
                      return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
                    })
                    .map((t: any) => (
                      <span
                        key={t.id}
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${t.couleur || t.tache_type?.couleur || '#10B981'}20`, 
                          color: t.couleur || t.tache_type?.couleur || '#10B981' 
                        }}
                      >
                        {(() => {
                          const code = t.code || t.tache_type?.code;
                          const nom = t.nom_tache || t.tache_type?.tache_type || getTacheLabel(String(t.tache_type_id));
                          return code ? `${code} - ${nom}` : nom;
                        })()}
                      </span>
                    ))}
                </div>
              </div>

              <Select
                label="Tâche à assigner"
                value={assignTache}
                onChange={(e) => {
                  setAssignTache(e.target.value);
                  setAssignSalarie(''); // Reset salarié quand tâche change
                }}
                options={[
                  { value: '', label: 'Sélectionner une tâche...' },
                  ...(selectedProjet?.taches
                    ?.slice()
                    .sort((a: any, b: any) => {
                      const nomA = (a.nom_tache || a.tache_type?.tache_type || '').toLowerCase();
                      const nomB = (b.nom_tache || b.tache_type?.tache_type || '').toLowerCase();
                      return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
                    })
                    .map((t: any) => ({
                      value: String(t.id), // Utiliser tache_projet_id au lieu de tache_type_id
                      label: (() => {
                        const code = t.code || t.tache_type?.code;
                        const nom = t.nom_tache || t.tache_type?.tache_type || getTacheLabel(String(t.tache_type_id)) || 'Tâche sans nom';
                        return code ? `${code} - ${nom}` : nom;
                      })(),
                    })) || []),
                ]}
              />

              <Select
                label="Salarié"
                value={assignSalarie}
                onChange={(e) => setAssignSalarie(e.target.value)}
                disabled={!assignTache}
                options={[
                  { value: '', label: assignTache ? 'Sélectionner un salarié...' : 'Choisissez d\'abord une tâche' },
                  ...(assignTache
                    ? getSalariesForTache(assignTache).map((s: any) => ({
                        value: s.id.toString(),
                        label: `${s.recommande ? '★ ' : ''}${s.prenom} ${s.nom}${s.fonction ? ` (${s.fonction.fonction})` : ''}${!s.recommande ? ' - autre spécialité' : ''}`,
                      }))
                    : []),
                ]}
              />

              <p className="text-sm text-gray-500">
                ★ = Salarié recommandé selon sa fonction. Vous pouvez assigner n'importe quel salarié à n'importe quelle tâche.
              </p>
            </>
          ) : (
            <p className="text-amber-600 bg-amber-50 p-3 rounded-lg text-sm">
              ⚠️ Ce projet n'a pas encore de tâches. Ajoutez des tâches d'abord en modifiant le projet.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleAssign} 
              isLoading={assignMutation.isPending}
              disabled={!assignTache || !assignSalarie || selectedProjet?.taches?.length === 0}
            >
              Assigner
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Archivage/Suppression */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={selectedProjet?.archive ? 'Restaurer ou supprimer le projet' : 'Finir le projet'}
        size="sm"
      >
        <div className="space-y-4">
          {selectedProjet?.archive ? (
            <>
              <p className="text-gray-600">
                Le projet <strong>{selectedProjet?.nom}</strong> est actuellement archivé.
              </p>
              <p className="text-gray-600">
                Vous pouvez le restaurer pour le réutiliser, ou le supprimer définitivement.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="default"
                  onClick={() => archiveMutation.mutate({ id: selectedProjet.id, archive: false })}
                  isLoading={archiveMutation.isPending}
                >
                  Restaurer
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteMutation.mutate(selectedProjet.id)}
                  isLoading={deleteMutation.isPending}
                >
                  Supprimer définitivement
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                Voulez-vous finir le projet <strong>{selectedProjet?.nom}</strong> ?
              </p>
              <p className="text-sm text-gray-500">
                Le projet sera archivé (grisé) et placé en bas de la liste. Vous ne pourrez plus ajouter de tâches ou de salariés, ni le modifier. Vous pourrez le restaurer plus tard si nécessaire.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="default"
                  onClick={() => archiveMutation.mutate({ id: selectedProjet.id, archive: true })}
                  isLoading={archiveMutation.isPending}
                >
                  Finir le projet
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Édition Heures et Noms */}
      <Modal
        isOpen={isEditHeuresModalOpen}
        onClose={() => setIsEditHeuresModalOpen(false)}
        title="Éditer les tâches"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Modifiez le nom, la couleur et les heures estimées pour chaque tâche sélectionnée :
          </p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedTaches
              .map((tacheId) => {
                const tache = tachesProjet.find((t: any) => t.id === tacheId);
                return tache ? { ...tache, tacheId } : null;
              })
              .filter((t: any) => t !== null)
              .sort((a: any, b: any) => {
                const nomA = (a.nom_tache || a.nom || '').toLowerCase();
                const nomB = (b.nom_tache || b.nom || '').toLowerCase();
                return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
              })
              .map((tache: any) => {
              const tacheId = tache.tacheId;
              
              const heuresActuelles = tachesHeuresModal[tacheId] ?? tache.heures_prevues ?? 0;
              const nomActuel = tachesNomsModal[tacheId] ?? tache.nom_tache ?? tache.nom ?? 'Tâche sans nom';
              // S'assurer que la couleur est toujours définie : priorité à tachesCouleursModal, puis tache.couleur, puis défaut
              // Si la couleur n'est pas dans tachesCouleursModal, utiliser celle de tache (qui peut venir de tache_projet ou tache_type)
              const couleurActuelle = tachesCouleursModal[tacheId] || tache.couleur || '#10B981';
              
              return (
                <div
                  key={tacheId}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="mb-3">
                    <Input
                      label="Nom de la tâche"
                      value={nomActuel}
                      onChange={(e) => {
                        setTachesNomsModal({
                          ...tachesNomsModal,
                          [tacheId]: e.target.value,
                        });
                      }}
                      placeholder={tache.nom_tache || tache.nom}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={couleurActuelle || '#10B981'}
                        onChange={(e) => {
                          const nouvelleCouleur = e.target.value;
                          setTachesCouleursModal({
                            ...tachesCouleursModal,
                            [tacheId]: nouvelleCouleur,
                          });
                          // Mettre à jour aussi dans tachesProjet pour l'affichage immédiat
                          setTachesProjet(tachesProjet.map((t: any) => 
                            t.id === tacheId ? { ...t, couleur: nouvelleCouleur } : t
                          ));
                        }}
                        className="w-12 h-10 p-1 border rounded cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Générer une couleur hexadécimale aléatoire
                          const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                          setTachesCouleursModal({
                            ...tachesCouleursModal,
                            [tacheId]: randomColor,
                          });
                          // Mettre à jour aussi dans tachesProjet pour l'affichage immédiat
                          setTachesProjet(tachesProjet.map((t: any) => 
                            t.id === tacheId ? { ...t, couleur: randomColor } : t
                          ));
                        }}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        title="Générer une couleur aléatoire"
                      >
                        <Shuffle className="w-4 h-4 text-gray-600" />
                      </button>
                      <span
                        className="px-3 py-1 rounded text-sm font-medium"
                        style={{ backgroundColor: `${couleurActuelle}20`, color: couleurActuelle }}
                      >
                        Aperçu
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      label="Heures estimées"
                      value={heuresActuelles}
                      onChange={(e) => {
                        const heures = parseFloat(e.target.value) || 0;
                        setTachesHeuresModal({
                          ...tachesHeuresModal,
                          [tacheId]: heures,
                        });
                      }}
                      className="flex-1"
                      min="0"
                      step="0.5"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-500 mt-6">h</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {nomActuel !== (tache.nom_tache || tache.nom) && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          updateTacheNomMutation.mutate({
                            tacheId: tacheId,
                            nouveauNom: nomActuel,
                          });
                        }}
                        isLoading={updateTacheNomMutation.isPending}
                        className="flex-1"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Sauvegarder le nom
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setTacheToDelete(tacheId)}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsEditHeuresModalOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmation Suppression Tâche */}
      <Modal
        isOpen={tacheToDelete !== null}
        onClose={() => setTacheToDelete(null)}
        title="Supprimer le type de tâche"
        size="sm"
      >
        <div className="space-y-4">
          {tacheToDelete && (() => {
            const tache = tacheTypes.find((t: any) => t.id === tacheToDelete);
            if (!tache) return null;
            return (
              <>
                <p className="text-gray-600">
                  Êtes-vous sûr de vouloir supprimer le type de tâche{' '}
                  <strong>{tache.tache_type}</strong> ?
                </p>
                <p className="text-sm text-red-600">
                  ⚠️ Cette action est irréversible. La tâche sera désactivée et ne pourra plus être utilisée dans de nouveaux projets.
                </p>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setTacheToDelete(null)}>
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteTacheTypeMutation.mutate(tacheToDelete)}
                    isLoading={deleteTacheTypeMutation.isPending}
                  >
                    Supprimer
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Modal Création nouvelle tâche pour le projet */}
      <Modal
        isOpen={isNewTacheModalOpen}
        onClose={() => {
          setIsNewTacheModalOpen(false);
          setNewTache({ nom: '', heures_prevues: 0, couleur: '#10B981' });
        }}
        title="Créer une nouvelle tâche pour ce projet"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nom de la tâche *"
            value={newTache.nom}
            onChange={(e) => setNewTache({ ...newTache, nom: e.target.value })}
            placeholder="Ex: Installation électrique, Tests..."
          />
          <Input
            type="number"
            label="Heures estimées"
            value={newTache.heures_prevues}
            onChange={(e) => setNewTache({ ...newTache, heures_prevues: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            min="0"
            step="0.5"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleur
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newTache.couleur}
                onChange={(e) => setNewTache({ ...newTache, couleur: e.target.value })}
                className="w-12 h-10 p-1 border rounded cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  // Générer une couleur hexadécimale aléatoire
                  const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                  setNewTache({ ...newTache, couleur: randomColor });
                }}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                title="Générer une couleur aléatoire"
              >
                <Shuffle className="w-4 h-4 text-gray-600" />
              </button>
              <span
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ backgroundColor: `${newTache.couleur}20`, color: newTache.couleur }}
              >
                Aperçu
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsNewTacheModalOpen(false);
                setNewTache({ nom: '', heures_prevues: 0, couleur: '#10B981' });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!newTache.nom) {
                  toast.error('Le nom de la tâche est requis');
                  return;
                }
                // Ajouter la tâche à la liste des tâches du projet
                const nouvelleTache = {
                  id: `temp-${Date.now()}`,
                  nom_tache: newTache.nom,
                  heures_prevues: newTache.heures_prevues,
                  couleur: newTache.couleur,
                };
                setTachesProjet([...tachesProjet, nouvelleTache]);
                setSelectedTaches([...selectedTaches, nouvelleTache.id]);
                setTachesHeuresModal({
                  ...tachesHeuresModal,
                  [nouvelleTache.id]: newTache.heures_prevues,
                });
                setIsNewTacheModalOpen(false);
                setNewTache({ nom: '', heures_prevues: 0, couleur: '#10B981' });
                toast.success('Tâche ajoutée au projet');
              }}
            >
              Ajouter la tâche
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};