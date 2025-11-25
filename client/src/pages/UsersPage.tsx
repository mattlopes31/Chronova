import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi, projectsApi } from '@/services/api';
import { Card, Button, Input, Modal, Badge, Spinner, Select } from '@/components/ui';
import type { User, CreateUserInput } from '@/types';

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur créé avec succès');
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur supprimé');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const assignProjectsMutation = useMutation({
    mutationFn: ({ userId, projectIds }: { userId: string; projectIds: string[] }) =>
      usersApi.assignProjects(userId, projectIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Projets assignés');
      setIsAssignModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'assignation');
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    });
  };

  const handleDelete = (user: User) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${user.firstName} ${user.lastName} ?`)) {
      deleteUserMutation.mutate(user.id);
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
          <h1 className="text-2xl font-bold text-neutral-900">Utilisateurs</h1>
          <p className="text-neutral-500">{users.length} utilisateur(s) au total</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </Card>

      {/* Users table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Projets
                </th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Pointages
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-neutral-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                      {user.role === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                      {user.role === 'ADMIN' ? 'Admin' : 'Employé'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.isActive ? 'success' : 'danger'}>
                      {user.isActive ? (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Actif
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 mr-1" />
                          Inactif
                        </>
                      )}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-neutral-900 font-medium">
                      {(user as any)._count?.projectAssignments || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-neutral-900 font-medium">
                      {(user as any)._count?.timeEntries || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsAssignModalOpen(true);
                        }}
                        title="Assigner des projets"
                      >
                        Projets
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(user)}
                        title={user.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {user.isActive ? (
                          <UserX className="w-4 h-4 text-amber-500" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createUserMutation.mutate(data)}
        isLoading={createUserMutation.isPending}
      />

      {/* Assign Projects Modal */}
      {selectedUser && (
        <AssignProjectsModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          projects={projects}
          onSubmit={(projectIds) =>
            assignProjectsMutation.mutate({ userId: selectedUser.id, projectIds })
          }
          isLoading={assignProjectsMutation.isPending}
        />
      )}
    </div>
  );
};

// Create User Modal
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserInput) => void;
  isLoading: boolean;
}

const CreateUserModal = ({ isOpen, onClose, onSubmit, isLoading }: CreateUserModalProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvel utilisateur" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Prénom"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Nom"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
        <Input
          type="email"
          label="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <Input
          type="password"
          label="Mot de passe"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={8}
        />
        <Select
          label="Rôle"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'EMPLOYEE' })}
          options={[
            { value: 'EMPLOYEE', label: 'Employé' },
            { value: 'ADMIN', label: 'Administrateur' },
          ]}
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Assign Projects Modal
interface AssignProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  projects: any[];
  onSubmit: (projectIds: string[]) => void;
  isLoading: boolean;
}

const AssignProjectsModal = ({
  isOpen,
  onClose,
  user,
  projects,
  onSubmit,
  isLoading,
}: AssignProjectsModalProps) => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    user.projectAssignments?.map((a) => a.projectId) || []
  );

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedProjects);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Projets de ${user.firstName} ${user.lastName}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-80 overflow-y-auto space-y-2">
          {projects.map((project) => (
            <label
              key={project.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedProjects.includes(project.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedProjects.includes(project.id)}
                onChange={() => toggleProject(project.id)}
                className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-neutral-900">{project.name}</p>
                <p className="text-sm text-neutral-500">{project.code}</p>
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
