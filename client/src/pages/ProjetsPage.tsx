import { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projetsApi, clientsApi, salariesApi, tachesApi } from '@/services/api';
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

// Types de tâches prédéfinis
const TACHES_TYPES = [
  { id: 'Cablage', label: 'Câblage', color: 'bg-blue-100 text-blue-700' },
  { id: 'DAO', label: 'DAO', color: 'bg-purple-100 text-purple-700' },
  { id: 'Prog', label: 'Programmation', color: 'bg-green-100 text-green-700' },
  { id: 'SCADA', label: 'SCADA', color: 'bg-orange-100 text-orange-700' },
  { id: 'Mise_en_service', label: 'Mise en service', color: 'bg-red-100 text-red-700' },
  { id: 'Etude', label: 'Étude', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'Autre', label: 'Autre', color: 'bg-gray-100 text-gray-700' },
];

export const ProjetsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedProjet, setSelectedProjet] = useState<any>(null);
  const [expandedProjet, setExpandedProjet] = useState<number | null>(null);
  const [form, setForm] = useState<ProjetForm>(initialForm);
  const [selectedTaches, setSelectedTaches] = useState<string[]>([]);
  const [assignSalarie, setAssignSalarie] = useState<string>('');
  const [assignTache, setAssignTache] = useState<string>('');

  // Queries
  const { data: projets = [], isLoading } = useQuery({
    queryKey: ['projets'],
    queryFn: projetsApi.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.getAll,
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries'],
    queryFn: salariesApi.getAll,
  });

  const { data: projetStatuts = [] } = useQuery({
    queryKey: ['projet-statuts'],
    queryFn: projetsApi.getStatuts,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const projet = await projetsApi.create(data.projet);
      // Ajouter les tâches sélectionnées
      for (const tacheType of data.taches) {
        await projetsApi.addTache(projet.id, { type_tache: tacheType });
      }
      return projet;
    },
    onSuccess: () => {
      toast.success('Projet créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => projetsApi.update(id, data),
    onSuccess: () => {
      toast.success('Projet mis à jour');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projetsApi.delete,
    onSuccess: () => {
      toast.success('Projet supprimé');
      queryClient.invalidateQueries({ queryKey: ['projets'] });
      setIsDeleteModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ projetId, data }: { projetId: number; data: any }) =>
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

  // Filtrage
  const filteredProjets = projets.filter((p: any) => {
    const matchSearch =
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      p.code_projet.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.projet_status_id?.toString() === filterStatus;
    return matchSearch && matchStatus;
  });

  // Handlers
  const openCreateModal = () => {
    setForm(initialForm);
    setSelectedTaches([]);
    setSelectedProjet(null);
    setIsModalOpen(true);
  };

  const openEditModal = (projet: any) => {
    setSelectedProjet(projet);
    setForm({
      id: projet.id,
      code_projet: projet.code_projet,
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
    // Récupérer les tâches existantes
    const existingTaches = projet.taches?.map((t: any) => t.type_tache) || [];
    setSelectedTaches(existingTaches);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(initialForm);
    setSelectedTaches([]);
    setSelectedProjet(null);
  };

  const toggleTache = (tacheId: string) => {
    setSelectedTaches((prev) =>
      prev.includes(tacheId) ? prev.filter((t) => t !== tacheId) : [...prev, tacheId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.code_projet || !form.nom) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    if (selectedTaches.length === 0) {
      toast.error('Sélectionnez au moins une tâche pour ce projet');
      return;
    }

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
    };

    if (selectedProjet) {
      updateMutation.mutate({ id: selectedProjet.id, data: projetData });
    } else {
      createMutation.mutate({ projet: projetData, taches: selectedTaches });
    }
  };

  const openAssignModal = (projet: any) => {
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

    // Trouver l'ID de la tâche du projet
    const tache = selectedProjet.taches?.find((t: any) => t.type_tache === assignTache);
    if (!tache) {
      toast.error('Tâche non trouvée');
      return;
    }

    assignMutation.mutate({
      projetId: selectedProjet.id,
      data: {
        salarie_id: parseInt(assignSalarie),
        tache_projet_id: tache.id,
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

  const getClientName = (clientId: number) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client?.nom || '-';
  };

  const getTacheColor = (type: string) => {
    return TACHES_TYPES.find((t) => t.id === type)?.color || 'bg-gray-100 text-gray-700';
  };

  // Filtrer les salariés selon leur fonction pour l'assignation
  const getSalariesForTache = (tacheType: string) => {
    // Mapping fonction → tâche
    const fonctionToTache: Record<string, string[]> = {
      Cableur: ['Cablage'],
      DAO: ['DAO'],
      Prog: ['Prog', 'SCADA'],
      Chef_Projet: ['Cablage', 'DAO', 'Prog', 'SCADA', 'Mise_en_service', 'Etude', 'Autre'],
      Admin: ['Cablage', 'DAO', 'Prog', 'SCADA', 'Mise_en_service', 'Etude', 'Autre'],
      Autre: ['Autre', 'Mise_en_service', 'Etude'],
    };

    return salaries.filter((s: any) => {
      if (!s.actif) return false;
      const fonction = s.fonction?.fonction;
      if (!fonction) return true; // Si pas de fonction, peut faire toutes les tâches
      return fonctionToTache[fonction]?.includes(tacheType);
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
            <Card key={projet.id} className="overflow-hidden">
              {/* En-tête du projet */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
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
                    <button
                      onClick={() => {
                        setSelectedProjet(projet);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Détails expandés */}
              {expandedProjet === projet.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                  {/* Tâches du projet */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Tâches du projet</h4>
                    <div className="flex flex-wrap gap-2">
                      {projet.taches?.length > 0 ? (
                        projet.taches.map((tache: any) => (
                          <span
                            key={tache.id}
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getTacheColor(tache.type_tache)}`}
                          >
                            {TACHES_TYPES.find((t) => t.id === tache.type_tache)?.label || tache.type_tache}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">Aucune tâche définie</span>
                      )}
                    </div>
                  </div>

                  {/* Salariés assignés */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Salariés assignés</h4>
                    {projet.affectations?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {projet.affectations.map((aff: any) => (
                          <div
                            key={aff.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary-700">
                                {aff.salarie?.prenom?.[0]}
                                {aff.salarie?.nom?.[0]}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {aff.salarie?.prenom} {aff.salarie?.nom}
                              </p>
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getTacheColor(aff.tache_projet?.type_tache)}`}
                              >
                                {TACHES_TYPES.find((t) => t.id === aff.tache_projet?.type_tache)?.label}
                              </span>
                            </div>
                          </div>
                        ))}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Tâches du projet * <span className="text-gray-400 font-normal">(sélectionnez au moins une)</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TACHES_TYPES.map((tache) => (
                <button
                  key={tache.id}
                  type="button"
                  onClick={() => toggleTache(tache.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTaches.includes(tache.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm font-medium ${tache.color}`}
                  >
                    {tache.label}
                  </span>
                </button>
              ))}
            </div>
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
          <Select
            label="Tâche"
            value={assignTache}
            onChange={(e) => {
              setAssignTache(e.target.value);
              setAssignSalarie(''); // Reset salarié quand tâche change
            }}
            options={[
              { value: '', label: 'Sélectionner une tâche...' },
              ...(selectedProjet?.taches?.map((t: any) => ({
                value: t.type_tache,
                label: TACHES_TYPES.find((tt) => tt.id === t.type_tache)?.label || t.type_tache,
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
                    label: `${s.prenom} ${s.nom}${s.fonction ? ` (${s.fonction.fonction})` : ''}`,
                  }))
                : []),
            ]}
          />

          <p className="text-sm text-gray-500">
            Les salariés affichés correspondent à la tâche sélectionnée selon leur fonction.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAssign} isLoading={assignMutation.isPending}>
              Assigner
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Suppression */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Supprimer le projet"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Êtes-vous sûr de vouloir supprimer le projet{' '}
            <strong>{selectedProjet?.nom}</strong> ? Cette action supprimera également tous les
            pointages associés.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate(selectedProjet.id)}
              isLoading={deleteMutation.isPending}
            >
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
