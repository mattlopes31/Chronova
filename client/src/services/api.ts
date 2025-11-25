import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type {
  User,
  Project,
  Task,
  TimeEntry,
  LeaveRequest,
  PublicHoliday,
  LeaveDate,
  WeeklySummary,
  UserWeeklySummary,
  DashboardSummary,
  MonthlyTrend,
  ProjectComparison,
  LoginInput,
  CreateUserInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateTimeEntryInput,
  CreateLeaveInput,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
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

// Auth
export const authApi = {
  login: async (data: LoginInput) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', data);
    return res.data;
  },
  me: async () => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (token: string, password: string) => {
    const res = await api.post('/auth/reset-password', { token, password });
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    return res.data;
  },
};

// Users
export const usersApi = {
  getAll: async () => {
    const res = await api.get<User[]>('/users');
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<User>(`/users/${id}`);
    return res.data;
  },
  create: async (data: CreateUserInput) => {
    const res = await api.post<User>('/users', data);
    return res.data;
  },
  update: async (id: string, data: Partial<User>) => {
    const res = await api.put<User>(`/users/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
  assignProjects: async (id: string, projectIds: string[]) => {
    const res = await api.post(`/users/${id}/projects`, { projectIds });
    return res.data;
  },
  getProjects: async (id: string) => {
    const res = await api.get<Project[]>(`/users/${id}/projects`);
    return res.data;
  },
};

// Projects
export const projectsApi = {
  getAll: async (status?: string) => {
    const params = status ? { status } : {};
    const res = await api.get<Project[]>('/projects', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Project>(`/projects/${id}`);
    return res.data;
  },
  create: async (data: CreateProjectInput) => {
    const res = await api.post<Project>('/projects', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Project>) => {
    const res = await api.put<Project>(`/projects/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
  },
  assignUsers: async (id: string, userIds: string[]) => {
    const res = await api.post(`/projects/${id}/users`, { userIds });
    return res.data;
  },
};

// Tasks
export const tasksApi = {
  getAll: async (projectId?: string) => {
    const params = projectId ? { projectId } : {};
    const res = await api.get<Task[]>('/tasks', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<Task>(`/tasks/${id}`);
    return res.data;
  },
  create: async (data: CreateTaskInput) => {
    const res = await api.post<Task>('/tasks', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Task>) => {
    const res = await api.put<Task>(`/tasks/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/tasks/${id}`);
    return res.data;
  },
};

// Time Entries
export const timeEntriesApi = {
  getMyEntries: async (params?: { startDate?: string; endDate?: string; weekNumber?: number; year?: number }) => {
    const res = await api.get<TimeEntry[]>('/time-entries', { params });
    return res.data;
  },
  getAllEntries: async (params?: { startDate?: string; endDate?: string; weekNumber?: number; year?: number; userId?: string }) => {
    const res = await api.get<TimeEntry[]>('/time-entries/all', { params });
    return res.data;
  },
  getWeeklySummary: async (weekNumber: number, year: number) => {
    const res = await api.get<WeeklySummary>('/time-entries/weekly-summary', {
      params: { weekNumber, year },
    });
    return res.data;
  },
  getAllWeeklySummary: async (weekNumber: number, year: number) => {
    const res = await api.get<UserWeeklySummary[]>('/time-entries/weekly-summary/all', {
      params: { weekNumber, year },
    });
    return res.data;
  },
  create: async (data: CreateTimeEntryInput) => {
    const res = await api.post<TimeEntry>('/time-entries', data);
    return res.data;
  },
  update: async (id: string, data: Partial<TimeEntry>) => {
    const res = await api.put<TimeEntry>(`/time-entries/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/time-entries/${id}`);
    return res.data;
  },
  validateWeek: async (weekNumber: number, year: number) => {
    const res = await api.post('/time-entries/validate-week', { weekNumber, year });
    return res.data;
  },
  unvalidateWeek: async (userId: string, weekNumber: number, year: number) => {
    const res = await api.post('/time-entries/unvalidate-week', { userId, weekNumber, year });
    return res.data;
  },
};

// Leaves
export const leavesApi = {
  getMyLeaves: async (year?: number) => {
    const params = year ? { year } : {};
    const res = await api.get<LeaveRequest[]>('/leaves', { params });
    return res.data;
  },
  getAllLeaves: async (params?: { year?: number; status?: string; userId?: string }) => {
    const res = await api.get<LeaveRequest[]>('/leaves/all', { params });
    return res.data;
  },
  getCalendarLeaves: async (startDate: string, endDate: string) => {
    const res = await api.get<LeaveDate[]>('/leaves/calendar', {
      params: { startDate, endDate },
    });
    return res.data;
  },
  create: async (data: CreateLeaveInput) => {
    const res = await api.post<LeaveRequest>('/leaves', data);
    return res.data;
  },
  updateStatus: async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await api.put<LeaveRequest>(`/leaves/${id}/status`, { status });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/leaves/${id}`);
    return res.data;
  },
};

// Holidays
export const holidaysApi = {
  getByYear: async (year: number) => {
    const res = await api.get<PublicHoliday[]>('/holidays', { params: { year } });
    return res.data;
  },
  getByRange: async (startDate: string, endDate: string) => {
    const res = await api.get<PublicHoliday[]>('/holidays/range', {
      params: { startDate, endDate },
    });
    return res.data;
  },
  create: async (date: string, name: string) => {
    const res = await api.post<PublicHoliday>('/holidays', { date, name });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/holidays/${id}`);
    return res.data;
  },
  initYear: async (year: number) => {
    const res = await api.post(`/holidays/init/${year}`);
    return res.data;
  },
};

// Dashboard
export const dashboardApi = {
  getSummary: async (month?: number, year?: number) => {
    const params: Record<string, number> = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const res = await api.get<DashboardSummary>('/dashboard/summary', { params });
    return res.data;
  },
  getTrend: async (year?: number) => {
    const params = year ? { year } : {};
    const res = await api.get<MonthlyTrend[]>('/dashboard/trend', { params });
    return res.data;
  },
  getComparison: async () => {
    const res = await api.get<ProjectComparison[]>('/dashboard/comparison');
    return res.data;
  },
};

export default api;
