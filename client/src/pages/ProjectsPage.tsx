import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FolderKanban,
  Clock,
  Users,
  ListTodo,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, usersApi } from '@/services/api';
import { Card, Button, Input, Modal, Badge, Spinner, Select, Textarea } from '@/components/ui';
import type { Project, CreateProjectInput, ProjectStatus } from '@/types';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  ACTIVE: { label: 'Actif', variant: 'success' },
  COMPLETED: { label: 'Terminé', variant: 'info' },
  ON_HOLD: { label: 'En pause', variant: 'warning' },
  CANCELLED: { label: 'Annulé', variant: 'danger' },
};

export const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsApi.getAll(statusFilter || undefined),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projet créé avec succès');
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projet mis à jour');
      setIsEditModalOpen(false);
      setSelectedProject(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projet supprimé');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const assignUsersMutation = useMutation({
    mutationFn: ({ projectId, userIds }: { projectId: string; userIds: string[] }) =>
      projectsApi.assignUsers(projectId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Utilisateurs assignés');
      setIsAssignModalOpen(false);
      setSelectedProject(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'assignation');
    },
  });

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (project: Project) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${project.name}" ?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  if (isLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Projets</h1>
          <p className="text-neutral-500">{projects.length} projet(s) au total</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouveau projet
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou code..."
              className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'Tous les statuts' },
              { value: 'ACTIVE', label: 'Actif' },
              { value: 'COMPLETED', label: 'Terminé' },
              { value: 'ON_HOLD', label: 'En pause' },
              { value: 'CANCELLED', label: 'Annulé' },
            ]}
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const progress = project.estimatedHours
            ? Math.min(((project.totalHoursSpent || 0) / project.estimatedHours) * 100, 100)
            : 0;

          return (
            <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow" hover>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <FolderKanban className="w-6 h-6 text-white" />
                </div>
                <Badge variant={STATUS_CONFIG[project.status].variant}>
                  {STATUS_CONFIG[project.status].label}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-neutral-900 mb-1">{project.name}</h3>
              <p className="text-sm text-neutral-500 mb-4">{project.code}</p>

              {project.description && (
                <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Heures
                  </span>
                  <span className="font-medium">
                    {project.totalHoursSpent?.toFixed(1) || 0}h / {project.estimatedHours || '∞'}h
                  </span>
                </div>
                {project.estimatedHours && (
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress >= 100 ? 'bg-red-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <ListTodo className="w-4 h-4" />
                    Tâches
                  </span>
                  <span className="font-medium">{project.tasks?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Assignés
                  </span>
                  <span className="font-medium">{(project as any)._count?.assignments || 0}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-neutral-200">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedProject(project);
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProject(project);
                    setIsAssignModalOpen(true);
                  }}
                >
                  <Users className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(project)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredProjects.length === 0 && (
        <Card className="p-12 text-center">
          <FolderKanban className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900">Aucun projet trouvé</h3>
          <p className="text-neutral-500 mt-1">Créez votre premier projet pour commencer</p>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <ProjectModal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onSubmit={(data) => {
          if (selectedProject) {
            updateMutation.mutate({ id: selectedProject.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Assign Users Modal */}
      {selectedProject && (
        <AssignUsersModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          users={users.filter((u) => u.role === 'EMPLOYEE' && u.isActive)}
          onSubmit={(userIds) =>
            assignUsersMutation.mutate({ projectId: selectedProject.id, userIds })
          }
          isLoading={assignUsersMutation.isPending}
        />
      )}
    </div>
  );
};

// Project Modal (Create/Edit)
interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSubmit: (data: CreateProjectInput) => void;
  isLoading: boolean;
}

const ProjectModal = ({ isOpen, onClose, project, onSubmit, isLoading }: ProjectModalProps) => {
  const [formData, setFormData] = useState<CreateProjectInput>({
    code: project?.code || '',
    name: project?.name || '',
    description: project?.description || '',
    estimatedHours: project?.estimatedHours || undefined,
    status: project?.status || 'ACTIVE',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Reset form when project changes
  useState(() => {
    if (project) {
      setFormData({
        code: project.code,
        name: project.name,
        description: project.description || '',
        estimatedHours: project.estimatedHours || undefined,
        status: project.status,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        estimatedHours: undefined,
        status: 'ACTIVE',
      });
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'Modifier le projet' : 'Nouveau projet'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Code *"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          placeholder="PRJ-001"
          required
          maxLength={20}
        />
        <Input
          label="Nom *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nom du projet"
          required
        />
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description du projet..."
          rows={3}
        />
        <Input
          type="number"
          label="Heures estimées"
          value={formData.estimatedHours || ''}
          onChange={(e) =>
            setFormData({
              ...formData,
              estimatedHours: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          placeholder="Ex: 500"
          min={0}
        />
        {project && (
          <Select
            label="Statut"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as ProjectStatus })
            }
            options={[
              { value: 'ACTIVE', label: 'Actif' },
              { value: 'COMPLETED', label: 'Terminé' },
              { value: 'ON_HOLD', label: 'En pause' },
              { value: 'CANCELLED', label: 'Annulé' },
            ]}
          />
        )}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {project ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Assign Users Modal
interface AssignUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  users: any[];
  onSubmit: (userIds: string[]) => void;
  isLoading: boolean;
}

const AssignUsersModal = ({
  isOpen,
  onClose,
  project,
  users,
  onSubmit,
  isLoading,
}: AssignUsersModalProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    project.assignments?.map((a) => a.userId) || []
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedUsers);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assigner au projet: ${project.name}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-80 overflow-y-auto space-y-2">
          {users.map((user) => (
            <label
              key={user.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedUsers.includes(user.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => toggleUser(user.id)}
                className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
              />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-sm font-medium">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div>
                <p className="font-medium text-neutral-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-neutral-500">{user.email}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
