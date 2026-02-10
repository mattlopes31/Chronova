import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  Shield,
  Briefcase,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salariesApi } from '@/services/api';
import { Card, Button, Badge, Modal, Input, Select, Checkbox, Spinner, EmptyState } from '@/components/ui';
import { format, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SalarieForm {
  id?: string;
  nom: string;
  prenom: string;
  email: string;
  password?: string;
  tel: string;
  role: 'Admin' | 'Manager' | 'Salarie';
  salarie_fonction_id: string;
  salarie_status_id: string;
  actif: boolean;
  date_entree: string;
  date_sortie: string;
  heures_hebdo: string;
  taux_horaire: string;
}

const initialForm: SalarieForm = {
  nom: '',
  prenom: '',
  email: '',
  password: '',
  tel: '',
  role: 'Salarie',
  salarie_fonction_id: '',
  salarie_status_id: '',
  actif: true,
  date_entree: format(new Date(), 'yyyy-MM-dd'),
  date_sortie: '',
  heures_hebdo: '35',
  taux_horaire: '',
};

export const SalariesPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterActif, setFilterActif] = useState<'all' | 'actif' | 'inactif'>('all');
  const [filterRole, setFilterRole] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSalarie, setSelectedSalarie] = useState<any>(null);
  const [form, setForm] = useState<SalarieForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);

  // Queries
  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ['salaries'],
    queryFn: () => salariesApi.getAll(),
  });

  const { data: fonctions = [] } = useQuery({
    queryKey: ['fonctions'],
    queryFn: () => salariesApi.getFonctions(),
  });

  const { data: statuts = [] } = useQuery({
    queryKey: ['statuts'],
    queryFn: () => salariesApi.getStatuts(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: salariesApi.create,
    onSuccess: () => {
      toast.success('Salarié créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => salariesApi.update(id, data),
    onSuccess: () => {
      toast.success('Salarié mis à jour');
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => salariesApi.update(id, data),
    onSuccess: () => {
      toast.success('Salarié désactivé');
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      setIsDeleteModalOpen(false);
      setSelectedSalarie(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la désactivation');
    },
  });

  // Filtrage et tri
  const filteredSalaries = salaries
    .filter((s: any) => {
      const matchSearch =
        s.nom.toLowerCase().includes(search.toLowerCase()) ||
        s.prenom.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase());

      const matchActif =
        filterActif === 'all' ||
        (filterActif === 'actif' && s.actif) ||
        (filterActif === 'inactif' && !s.actif);

      const matchRole = !filterRole || s.role === filterRole;

      return matchSearch && matchActif && matchRole;
    })
    .sort((a: any, b: any) => {
      // Trier par ordre alphabétique (nom puis prénom)
      const nomA = (a.nom || '').toLowerCase();
      const nomB = (b.nom || '').toLowerCase();
      if (nomA !== nomB) {
        return nomA.localeCompare(nomB, 'fr');
      }
      const prenomA = (a.prenom || '').toLowerCase();
      const prenomB = (b.prenom || '').toLowerCase();
      return prenomA.localeCompare(prenomB, 'fr');
    });

  // Handlers
  const openCreateModal = () => {
    setForm(initialForm);
    setSelectedSalarie(null);
    setIsModalOpen(true);
  };

  const openEditModal = (salarie: any) => {
    setSelectedSalarie(salarie);
    setForm({
      id: salarie.id,
      nom: salarie.nom,
      prenom: salarie.prenom,
      email: salarie.email,
      password: '',
      tel: salarie.tel || '',
      role: salarie.role,
      salarie_fonction_id: salarie.salarie_fonction_id?.toString() || '',
      salarie_status_id: salarie.salarie_status_id?.toString() || '',
      actif: salarie.actif,
      date_entree: salarie.date_entree ? format(parseISO(salarie.date_entree), 'yyyy-MM-dd') : '',
      date_sortie: salarie.date_sortie ? format(parseISO(salarie.date_sortie), 'yyyy-MM-dd') : '',
      heures_hebdo: salarie.heures_hebdo?.toString() || '35',
      taux_horaire: salarie.taux_horaire?.toString() || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(initialForm);
    setSelectedSalarie(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nom || !form.prenom || !form.email) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    if (!selectedSalarie && !form.password) {
      toast.error('Le mot de passe est obligatoire pour un nouveau salarié');
      return;
    }

    const data = {
      nom: form.nom,
      prenom: form.prenom,
      email: form.email,
      tel: form.tel || null,
      role: form.role,
      salarie_fonction_id: form.salarie_fonction_id ? parseInt(form.salarie_fonction_id) : null,
      salarie_status_id: form.salarie_status_id ? parseInt(form.salarie_status_id) : null,
      actif: form.actif,
      date_entree: form.date_entree || null,
      date_sortie: form.date_sortie || null,
      heures_hebdo: form.heures_hebdo ? parseFloat(form.heures_hebdo) : 35,
      taux_horaire: form.taux_horaire ? parseFloat(form.taux_horaire) : null,
      ...(form.password && { password: form.password }),
    };

    if (selectedSalarie) {
      updateMutation.mutate({ id: selectedSalarie.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = (salarie: any) => {
    setSelectedSalarie(salarie);
    setIsDeleteModalOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return <Badge variant="danger">Admin</Badge>;
      case 'Manager':
        return <Badge variant="info">Manager</Badge>;
      default:
        return <Badge variant="default">Salarié</Badge>;
    }
  };

  const getFonctionLabel = (id: string | null | undefined) => {
    if (!id) return '-';
    const f = fonctions.find((f: any) => String(f.id) === String(id));
    return f?.libelle || '-';
  };

  const getStatusLabel = (id: string | null | undefined) => {
    if (!id) return '-';
    const s = statuts.find((s: any) => String(s.id) === String(id));
    return s?.libelle || '-';
  };

  const isExpired = (dateSortie: string | null) => {
    if (!dateSortie) return false;
    return isPast(parseISO(dateSortie));
  };

  if (isLoading) {
    return <Spinner className="py-20" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Salariés</h1>
          <p className="text-gray-500">{salaries.length} salariés enregistrés</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau salarié
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
              placeholder="Rechercher par nom, prénom ou email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Select
            value={filterActif}
            onChange={(e) => setFilterActif(e.target.value as any)}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'actif', label: 'Actifs' },
              { value: 'inactif', label: 'Inactifs' },
            ]}
            className="w-36"
          />
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: '', label: 'Tous les rôles' },
              { value: 'Admin', label: 'Admin' },
              { value: 'Manager', label: 'Manager' },
              { value: 'Salarie', label: 'Salarié' },
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* Liste */}
      {filteredSalaries.length === 0 ? (
        <EmptyState
          icon={<UserX className="w-12 h-12" />}
          title="Aucun salarié trouvé"
          description="Modifiez vos filtres ou créez un nouveau salarié"
          action={
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un salarié
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredSalaries.map((salarie: any) => {
            const expired = isExpired(salarie.date_sortie);
            return (
              <Card
                key={salarie.id}
                className={`p-4 ${!salarie.actif || expired ? 'opacity-60 bg-gray-50' : ''}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar et infos principales */}
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        salarie.actif && !expired ? 'bg-primary-100' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`text-lg font-semibold ${
                          salarie.actif && !expired ? 'text-primary-700' : 'text-gray-500'
                        }`}
                      >
                        {salarie.prenom[0]}
                        {salarie.nom[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {salarie.prenom} {salarie.nom}
                        </h3>
                        {expired && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            Expiré
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {salarie.email}
                        </span>
                        {salarie.tel && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {salarie.tel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Infos secondaires */}
                  <div className="flex flex-wrap items-center gap-3">
                    {getRoleBadge(salarie.role)}
                    <Badge variant="default">
                      <Briefcase className="w-3 h-3 mr-1" />
                      {getFonctionLabel(salarie.salarie_fonction_id)}
                    </Badge>
                    <Badge variant={salarie.actif ? 'success' : 'danger'}>
                      {salarie.actif ? (
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
                    {salarie.date_entree && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Depuis {format(parseISO(salarie.date_entree), 'MMM yyyy', { locale: fr })}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(salarie)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmDelete(salarie)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      title="Désactiver le salarié"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Création/Édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedSalarie ? 'Modifier le salarié' : 'Nouveau salarié'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Prénom *"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                placeholder="Jean"
              />
              <Input
                label="Nom *"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Dupont"
              />
              <Input
                label="Email *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jean.dupont@entreprise.fr"
              />
              <Input
                label="Téléphone"
                value={form.tel}
                onChange={(e) => setForm({ ...form, tel: e.target.value })}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>

          {/* Authentification */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Authentification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label={selectedSalarie ? 'Nouveau mot de passe' : 'Mot de passe *'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password || ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={selectedSalarie ? 'Laisser vide pour ne pas changer' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <Select
                label="Rôle *"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                options={[
                  { value: 'Salarie', label: 'Salarié' },
                  { value: 'Manager', label: 'Manager' },
                  { value: 'Admin', label: 'Administrateur' },
                ]}
              />
            </div>
          </div>

          {/* Poste */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Poste et fonction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Fonction / Tâche"
                value={form.salarie_fonction_id}
                onChange={(e) => setForm({ ...form, salarie_fonction_id: e.target.value })}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...fonctions.map((f: any) => ({
                    value: f.id.toString(),
                    label: f.fonction.replace('_', ' '),
                  })),
                ]}
              />
              <Select
                label="Type de contrat"
                value={form.salarie_status_id}
                onChange={(e) => setForm({ ...form, salarie_status_id: e.target.value })}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...statuts.map((s: any) => ({
                    value: s.id.toString(),
                    label: s.status.replace('_', ' '),
                  })),
                ]}
              />
              <Input
                label="Heures hebdo"
                type="number"
                value={form.heures_hebdo}
                onChange={(e) => setForm({ ...form, heures_hebdo: e.target.value })}
                placeholder="35"
              />
              <Input
                label="Taux horaire (€)"
                type="number"
                value={form.taux_horaire}
                onChange={(e) => setForm({ ...form, taux_horaire: e.target.value })}
                placeholder="25.00"
              />
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Période d'activité</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Date d'entrée"
                type="date"
                value={form.date_entree}
                onChange={(e) => setForm({ ...form, date_entree: e.target.value })}
              />
              <Input
                label="Date de fin (optionnel)"
                type="date"
                value={form.date_sortie}
                onChange={(e) => setForm({ ...form, date_sortie: e.target.value })}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Si une date de fin est définie, le compte expirera automatiquement à cette date.
            </p>
          </div>

          {/* Statut actif */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <Checkbox
              checked={form.actif}
              onChange={(e) => setForm({ ...form, actif: e.target.checked })}
            />
            <div>
              <p className="font-medium text-gray-900">Compte actif</p>
              <p className="text-sm text-gray-500">
                Un compte inactif ne peut plus se connecter
              </p>
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
              {selectedSalarie ? 'Mettre à jour' : 'Créer le salarié'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Désactivation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Désactiver le salarié"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Êtes-vous sûr de vouloir désactiver{' '}
            <strong>
              {selectedSalarie?.prenom} {selectedSalarie?.nom}
            </strong>{' '}
            ? Le salarié ne pourra plus se connecter à l'application.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate({ id: selectedSalarie.id, data: { actif: false } })}
              isLoading={deleteMutation.isPending}
            >
              Désactiver le salarié
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
