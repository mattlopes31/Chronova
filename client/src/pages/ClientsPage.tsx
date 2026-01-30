import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  UserCheck,
  UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clientsApi } from '@/services/api';
import { Card, Button, Badge, Modal, Input, Select, Checkbox, Spinner, EmptyState } from '@/components/ui';

interface ClientForm {
  id?: string;
  nom: string;
  code_client: string;
  email: string;
  tel: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  contact_nom: string;
  contact_email: string;
  contact_tel: string;
  notes: string;
  actif: boolean;
}

const initialForm: ClientForm = {
  nom: '',
  code_client: '',
  email: '',
  tel: '',
  adresse: '',
  code_postal: '',
  ville: '',
  pays: 'France',
  contact_nom: '',
  contact_email: '',
  contact_tel: '',
  notes: '',
  actif: true,
};

export const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterActif, setFilterActif] = useState<'all' | 'actif' | 'inactif'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [form, setForm] = useState<ClientForm>(initialForm);

  // Queries
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.getAll(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      toast.success('Client créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => clientsApi.update(id, data),
    onSuccess: () => {
      toast.success('Client mis à jour');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => {
      toast.success('Client supprimé');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDeleteModalOpen(false);
      setSelectedClient(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  // Filtrage
  const filteredClients = clients.filter((c: any) => {
    const matchSearch =
      c.nom?.toLowerCase().includes(search.toLowerCase()) ||
      c.code_client?.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_email || c.email)?.toLowerCase().includes(search.toLowerCase()) ||
      c.ville?.toLowerCase().includes(search.toLowerCase());

    const matchActif =
      filterActif === 'all' ||
      (filterActif === 'actif' && c.actif) ||
      (filterActif === 'inactif' && !c.actif);

    return matchSearch && matchActif;
  });

  // Handlers
  const openCreateModal = () => {
    setForm(initialForm);
    setSelectedClient(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: any) => {
    setSelectedClient(client);
    setForm({
      id: client.id,
      nom: client.nom || '',
      code_client: client.code_client || '',
      // Utiliser contact_email et contact_tel car email et tel n'existent pas dans le schéma
      email: client.contact_email || client.email || '',
      tel: client.contact_tel || client.tel || '',
      adresse: client.adresse || '',
      code_postal: client.cp || client.code_postal || '',
      ville: client.ville || '',
      pays: client.pays?.country_name || client.pays || 'France',
      pays_id: client.pays_id || client.pays?.id || '',
      contact_nom: client.contact_nom || '',
      contact_email: client.contact_email || '',
      contact_tel: client.contact_tel || '',
      notes: client.notes || '',
      actif: client.actif,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(initialForm);
    setSelectedClient(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nom) {
      toast.error('Le nom du client est obligatoire');
      return;
    }

    const data = {
      nom: form.nom,
      code_client: form.code_client || null,
      // email et tel sont mappés vers contact_email et contact_tel côté backend
      email: form.email || form.contact_email || null,
      tel: form.tel || form.contact_tel || null,
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      pays_id: form.pays_id || null,
      contact_nom: form.contact_nom || null,
      contact_email: form.contact_email || form.email || null,
      contact_tel: form.contact_tel || form.tel || null,
      notes: form.notes || null,
      actif: form.actif,
    };

    if (selectedClient) {
      updateMutation.mutate({ id: selectedClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = (client: any) => {
    setSelectedClient(client);
    setIsDeleteModalOpen(true);
  };

  // Générer un code client automatiquement
  const generateCode = () => {
    if (form.nom && !form.code_client) {
      const code = form.nom
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') + 
        Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setForm({ ...form, code_client: code });
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Clients</h1>
          <p className="text-gray-500">{clients.length} clients enregistrés</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
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
              placeholder="Rechercher par nom, code, email ou ville..."
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
        </div>
      </Card>

      {/* Liste */}
      {filteredClients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="Aucun client trouvé"
          description="Modifiez vos filtres ou créez un nouveau client"
          action={
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un client
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client: any) => (
            <Card
              key={client.id}
              className={`p-4 ${!client.actif ? 'opacity-60 bg-gray-50' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      client.actif ? 'bg-primary-100' : 'bg-gray-200'
                    }`}
                  >
                    <Building2
                      className={`w-5 h-5 ${
                        client.actif ? 'text-primary-600' : 'text-gray-500'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.nom}</h3>
                    {client.code_client && (
                      <span className="text-xs font-mono text-gray-500">
                        {client.code_client}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={client.actif ? 'success' : 'danger'}>
                  {client.actif ? 'Actif' : 'Inactif'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {(client.contact_email || client.email) && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{client.contact_email || client.email}</span>
                  </div>
                )}
                {(client.contact_tel || client.tel) && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{client.contact_tel || client.tel}</span>
                  </div>
                )}
                {client.ville && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>
                      {client.cp || client.code_postal} {client.ville}
                    </span>
                  </div>
                )}
              </div>

              {/* Contact principal */}
              {client.contact_nom && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Contact principal</p>
                  <p className="text-sm font-medium text-gray-900">{client.contact_nom}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(client)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => confirmDelete(client)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Création/Édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedClient ? 'Modifier le client' : 'Nouveau client'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Informations générales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nom du client *"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                onBlur={generateCode}
                placeholder="Entreprise ABC"
              />
              <Input
                label="Code client"
                value={form.code_client}
                onChange={(e) => setForm({ ...form, code_client: e.target.value.toUpperCase() })}
                placeholder="ABC001"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@entreprise.fr"
              />
              <Input
                label="Téléphone"
                value={form.tel}
                onChange={(e) => setForm({ ...form, tel: e.target.value })}
                placeholder="01 23 45 67 89"
              />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Adresse</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Adresse"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  placeholder="123 rue de l'Industrie"
                />
              </div>
              <Input
                label="Code postal"
                value={form.code_postal}
                onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
                placeholder="75001"
              />
              <Input
                label="Ville"
                value={form.ville}
                onChange={(e) => setForm({ ...form, ville: e.target.value })}
                placeholder="Paris"
              />
              <Input
                label="Pays"
                value={form.pays}
                onChange={(e) => setForm({ ...form, pays: e.target.value })}
                placeholder="France"
              />
            </div>
          </div>

          {/* Contact principal */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Contact principal</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Nom du contact"
                value={form.contact_nom}
                onChange={(e) => setForm({ ...form, contact_nom: e.target.value })}
                placeholder="Jean Dupont"
              />
              <Input
                label="Email du contact"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="j.dupont@entreprise.fr"
              />
              <Input
                label="Téléphone du contact"
                value={form.contact_tel}
                onChange={(e) => setForm({ ...form, contact_tel: e.target.value })}
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="Notes ou commentaires..."
            />
          </div>

          {/* Statut actif */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <Checkbox
              checked={form.actif}
              onChange={(e) => setForm({ ...form, actif: e.target.checked })}
            />
            <div>
              <p className="font-medium text-gray-900">Client actif</p>
              <p className="text-sm text-gray-500">
                Un client inactif n'apparaîtra plus dans les listes de sélection
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
              {selectedClient ? 'Mettre à jour' : 'Créer le client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Suppression */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Supprimer le client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Êtes-vous sûr de vouloir supprimer le client{' '}
            <strong>{selectedClient?.nom}</strong> ?
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            ⚠️ Cette action supprimera également tous les projets associés à ce client.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate(selectedClient.id)}
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
