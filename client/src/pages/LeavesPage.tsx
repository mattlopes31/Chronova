import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  Check,
  X,
  Clock,
  CalendarOff,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leavesApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Card, Button, Input, Modal, Badge, Spinner, Select } from '@/components/ui';
import { formatDate, formatDateLong } from '@/utils/dates';
import type { LeaveRequest, LeaveType, LeaveStatus, CreateLeaveInput } from '@/types';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  PAID: 'Congé payé',
  UNPAID: 'Congé sans solde',
  SICK: 'Maladie',
  OTHER: 'Autre',
};

const STATUS_CONFIG: Record<LeaveStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  APPROVED: { label: 'Approuvé', variant: 'success' },
  REJECTED: { label: 'Refusé', variant: 'danger' },
};

export const LeavesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leaves', year, statusFilter, isAdmin],
    queryFn: () =>
      isAdmin
        ? leavesApi.getAllLeaves({ year, status: statusFilter || undefined })
        : leavesApi.getMyLeaves(year),
  });

  const createMutation = useMutation({
    mutationFn: leavesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Demande de congé envoyée');
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la demande');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      leavesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Statut mis à jour');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: leavesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Demande annulée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'annulation');
    },
  });

  const filteredLeaves = statusFilter
    ? leaves.filter((l) => l.status === statusFilter)
    : leaves;

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: String(new Date().getFullYear() - i),
    label: String(new Date().getFullYear() - i),
  }));

  const handleDelete = (leave: LeaveRequest) => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler cette demande ?')) {
      deleteMutation.mutate(leave.id);
    }
  };

  // Calculate days between dates
  const getDayCount = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  };

  if (isLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {isAdmin ? 'Gestion des congés' : 'Mes congés'}
          </h1>
          <p className="text-neutral-500">
            {filteredLeaves.length} demande(s) de congé
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle demande
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Select
            value={String(year)}
            onChange={(e) => setYear(parseInt(e.target.value))}
            options={years}
            className="w-full sm:w-32"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'Tous les statuts' },
              { value: 'PENDING', label: 'En attente' },
              { value: 'APPROVED', label: 'Approuvé' },
              { value: 'REJECTED', label: 'Refusé' },
            ]}
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      {/* Pending requests for admin */}
      {isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Demandes en attente ({leaves.filter((l) => l.status === 'PENDING').length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaves
              .filter((l) => l.status === 'PENDING')
              .map((leave) => (
                <Card key={leave.id} className="p-5 border-l-4 border-l-amber-400">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold text-sm">
                        {leave.user?.firstName?.[0]}{leave.user?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {leave.user?.firstName} {leave.user?.lastName}
                        </p>
                        <p className="text-sm text-neutral-500">{leave.user?.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      <span>
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-neutral-400" />
                      <span>{getDayCount(leave.startDate, leave.endDate)} jour(s)</span>
                    </div>
                    <Badge variant="default">{LEAVE_TYPE_LABELS[leave.type]}</Badge>
                  </div>

                  {leave.reason && (
                    <p className="text-sm text-neutral-600 mb-4 p-2 bg-neutral-50 rounded">
                      {leave.reason}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                      onClick={() =>
                        updateStatusMutation.mutate({ id: leave.id, status: 'APPROVED' })
                      }
                      isLoading={updateStatusMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                      Approuver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                      onClick={() =>
                        updateStatusMutation.mutate({ id: leave.id, status: 'REJECTED' })
                      }
                      isLoading={updateStatusMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                      Refuser
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
          {leaves.filter((l) => l.status === 'PENDING').length === 0 && (
            <Card className="p-8 text-center">
              <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-neutral-600">Aucune demande en attente</p>
            </Card>
          )}
        </div>
      )}

      {/* All leaves list */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          {isAdmin ? 'Toutes les demandes' : 'Historique'}
        </h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  {isAdmin && (
                    <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                      Employé
                    </th>
                  )}
                  <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Période
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Jours
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-neutral-50 transition-colors">
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-sm font-medium">
                            {leave.user?.firstName?.[0]}{leave.user?.lastName?.[0]}
                          </div>
                          <span className="font-medium text-neutral-900">
                            {leave.user?.firstName} {leave.user?.lastName}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <Badge variant="default">{LEAVE_TYPE_LABELS[leave.type]}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-neutral-900">
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-medium">
                        {getDayCount(leave.startDate, leave.endDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={STATUS_CONFIG[leave.status].variant}>
                        {STATUS_CONFIG[leave.status].label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {leave.status === 'PENDING' && !isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(leave)}
                        >
                          <X className="w-4 h-4 text-red-500" />
                          Annuler
                        </Button>
                      )}
                      {isAdmin && leave.status !== 'PENDING' && leave.approvedBy && (
                        <span className="text-sm text-neutral-500">
                          Par {leave.approvedBy.firstName} {leave.approvedBy.lastName}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {filteredLeaves.length === 0 && (
          <Card className="p-12 text-center">
            <CalendarOff className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900">Aucune demande</h3>
            <p className="text-neutral-500 mt-1">
              Créez une demande de congé pour commencer
            </p>
          </Card>
        )}
      </div>

      {/* Create Leave Modal */}
      <CreateLeaveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />
    </div>
  );
};

// Create Leave Modal
interface CreateLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLeaveInput) => void;
  isLoading: boolean;
}

const CreateLeaveModal = ({ isOpen, onClose, onSubmit, isLoading }: CreateLeaveModalProps) => {
  const [formData, setFormData] = useState<CreateLeaveInput>({
    startDate: '',
    endDate: '',
    type: 'PAID',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate) {
      toast.error('Veuillez sélectionner les dates');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle demande de congé" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Date de début *"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
          <Input
            type="date"
            label="Date de fin *"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            min={formData.startDate}
            required
          />
        </div>
        <Select
          label="Type de congé"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as LeaveType })}
          options={[
            { value: 'PAID', label: 'Congé payé' },
            { value: 'UNPAID', label: 'Congé sans solde' },
            { value: 'SICK', label: 'Maladie' },
            { value: 'OTHER', label: 'Autre' },
          ]}
        />
        <Input
          label="Motif (optionnel)"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Raison de la demande..."
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Envoyer la demande
          </Button>
        </div>
      </form>
    </Modal>
  );
};
