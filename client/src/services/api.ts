import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type {
  Salarie,
  Projet,
  Client,
  TacheType,
  TacheProjet,
  SalariePointage,
  SalarieCp,
  ValidationSemaine,
  JourFerie,
  SalarieFonction,
  SalarieStatus,
  LoginInput,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs d'auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const authApi = {
  login: async (data: LoginInput) => {
    const res = await api.post<{ token: string; user: Salarie }>('/auth/login', data);
    return res.data;
  },
  me: async () => {
    const res = await api.get<Salarie>('/auth/me');
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.put('/auth/password', { currentPassword, newPassword });
    return res.data;
  },
};

// ============ SALARIES ============
export const salariesApi = {
  getAll: async (params?: { actif?: boolean; fonction_id?: string; search?: string }) => {
    const res = await api.get<Salarie[]>('/salaries', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Salarie>(`/salaries/${id}`);
    return res.data;
  },
  getFonctions: async () => {
    const res = await api.get<SalarieFonction[]>('/salaries/fonctions');
    return res.data;
  },
  getStatuts: async () => {
    const res = await api.get<SalarieStatus[]>('/salaries/statuts');
    return res.data;
  },
  create: async (data: Partial<Salarie> & { password?: string }) => {
    const res = await api.post<Salarie>('/salaries', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Salarie>) => {
    const res = await api.put<Salarie>(`/salaries/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/salaries/${id}`);
    return res.data;
  },
};

// ============ PROJETS ============
export const projetsApi = {
  getAll: async (params?: { actif?: boolean; status_id?: string; client_id?: string }) => {
    const res = await api.get<Projet[]>('/projets', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Projet>(`/projets/${id}`);
    return res.data;
  },
  // Récupérer les projets assignés au salarié connecté
  getMesProjets: async () => {
    const res = await api.get<Projet[]>('/projets/mes-projets');
    return res.data;
  },
  getStatuts: async () => {
    const res = await api.get('/projets/statuts');
    return res.data;
  },
  create: async (data: Partial<Projet>) => {
    const res = await api.post<Projet>('/projets', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Projet>) => {
    const res = await api.put<Projet>(`/projets/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete(`/projets/${id}`);
    return res.data;
  },
  addTache: async (projetId: number, data: { type_tache: string; budget_heures?: number }) => {
    const res = await api.post(`/projets/${projetId}/taches`, data);
    return res.data;
  },
  addAffectation: async (projetId: number, data: { tache_projet_id: number; salarie_id: number }) => {
    const res = await api.post(`/projets/${projetId}/affectations`, data);
    return res.data;
  },
};

// ============ CLIENTS ============
export const clientsApi = {
  getAll: async (params?: { actif?: boolean; search?: string }) => {
    const res = await api.get<Client[]>('/clients', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Client>(`/clients/${id}`);
    return res.data;
  },
  create: async (data: Partial<Client>) => {
    const res = await api.post<Client>('/clients', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Client>) => {
    const res = await api.put<Client>(`/clients/${id}`, data);
    return res.data;
  },

  delete: async (id: number) => {
  const res = await api.delete(`/clients/${id}`);
  return res.data;
},
};

// ============ TACHES ============
export const tachesApi = {
  getTypes: async (params?: { actif?: boolean }) => {
    const res = await api.get<TacheType[]>('/taches', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<TacheType>(`/taches/${id}`);
    return res.data;
  },
  create: async (data: Partial<TacheType>) => {
    const res = await api.post<TacheType>('/taches', data);
    return res.data;
  },
  update: async (id: string, data: Partial<TacheType>) => {
    const res = await api.put<TacheType>(`/taches/${id}`, data);
    return res.data;
  },
};

// ============ POINTAGES ============
export const pointagesApi = {
  getAll: async (params?: { salarie_id?: string; projet_id?: string; annee?: number; semaine?: number; status?: string }) => {
    const res = await api.get<SalariePointage[]>('/pointages', { params });
    return res.data;
  },
  getSemaine: async (annee: number, semaine: number) => {
    const res = await api.get<{
      pointages: SalariePointage[];
      conges: SalarieCp;
      validation: ValidationSemaine;
      jours_feries: JourFerie[];
    }>(`/pointages/semaine/${annee}/${semaine}`);
    return res.data;
  },
  create: async (data: {
    projet_id: string;
    tache_projet_id?: string;
    annee: number;
    semaine: number;
    heure_lundi?: number;
    heure_mardi?: number;
    heure_mercredi?: number;
    heure_jeudi?: number;
    heure_vendredi?: number;
    heure_samedi?: number;
    heure_dimanche?: number;
    commentaire?: string;
  }) => {
    const res = await api.post<SalariePointage>('/pointages', data);
    return res.data;
  },
  soumettre: async (annee: number, semaine: number) => {
    const res = await api.post('/pointages/soumettre', { annee, semaine });
    return res.data;
  },
  valider: async (salarie_id: string, annee: number, semaine: number) => {
    const res = await api.post('/pointages/valider', { salarie_id, annee, semaine });
    return res.data;
  },
  rejeter: async (salarie_id: string, annee: number, semaine: number, commentaire: string) => {
    const res = await api.post('/pointages/rejeter', { salarie_id, annee, semaine, commentaire });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/pointages/${id}`);
    return res.data;
  },
};

// ============ CONGES ============
export const congesApi = {
  getAll: async (params?: { salarie_id?: string; annee?: number; status?: string; type?: string }) => {
    const res = await api.get<SalarieCp[]>('/conges', { params });
    return res.data;
  },
  getJoursFeries: async (annee?: number) => {
    const res = await api.get<JourFerie[]>('/conges/jours-feries', { params: { annee } });
    return res.data;
  },
  create: async (data: {
    annee: number;
    semaine: number;
    cp_lundi?: boolean;
    cp_mardi?: boolean;
    cp_mercredi?: boolean;
    cp_jeudi?: boolean;
    cp_vendredi?: boolean;
    type_conge?: string;
    commentaire?: string;
  }) => {
    const res = await api.post<SalarieCp>('/conges', data);
    return res.data;
  },
  soumettre: async (id: string) => {
    const res = await api.post(`/conges/${id}/soumettre`);
    return res.data;
  },
  valider: async (id: string) => {
    const res = await api.post(`/conges/${id}/valider`);
    return res.data;
  },
  rejeter: async (id: string, commentaire: string) => {
    const res = await api.post(`/conges/${id}/rejeter`, { commentaire });
    return res.data;
  },
};

// ============ DASHBOARD ============
export const dashboardApi = {
  getStats: async () => {
    const res = await api.get('/dashboard/stats');
    return res.data;
  },
  getHeuresProjet: async () => {
    const res = await api.get('/dashboard/heures-projet');
    return res.data;
  },
  getValidations: async () => {
    const res = await api.get('/dashboard/validations');
    return res.data;
  },
  getMesStats: async () => {
    const res = await api.get('/dashboard/mes-stats');
    return res.data;
  },
  getNotifications: async () => {
    const res = await api.get('/dashboard/notifications');
    return res.data;
  },
  marquerNotificationLue: async (id: string) => {
    const res = await api.put(`/dashboard/notifications/${id}/lue`);
    return res.data;
  },
};

export default api;
