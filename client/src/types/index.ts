export type Role = 'ADMIN' | 'EMPLOYEE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveType = 'PAID' | 'UNPAID' | 'SICK' | 'OTHER';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
  projectAssignments?: ProjectAssignment[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  estimatedHours?: number;
  totalHoursSpent?: number;
  createdAt?: string;
  tasks?: Task[];
  assignments?: ProjectAssignment[];
}

export interface Task {
  id: string;
  code: string;
  label: string;
  description?: string;
  estimatedHours?: number;
  totalHoursSpent?: number;
  isActive: boolean;
  projectId: string;
  project?: Pick<Project, 'id' | 'code' | 'name'>;
}

export interface ProjectAssignment {
  id: string;
  userId: string;
  projectId: string;
  project?: Project;
  user?: User;
}

export interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description?: string;
  validated: boolean;
  weekNumber: number;
  year: number;
  userId: string;
  user?: User;
  projectId: string;
  project: Pick<Project, 'id' | 'code' | 'name'>;
  taskId: string;
  task: Pick<Task, 'id' | 'code' | 'label'>;
}

export interface WeekValidation {
  id: string;
  userId: string;
  weekNumber: number;
  year: number;
  validated: boolean;
  validatedAt: string;
  totalHours: number;
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  status: LeaveStatus;
  reason?: string;
  createdAt: string;
  approvedAt?: string;
  userId: string;
  user?: User;
  approvedById?: string;
  approvedBy?: User;
}

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  year: number;
}

export interface LeaveDate {
  date: string;
  userId: string;
  userName: string;
  type: LeaveType;
}

export interface WeeklySummary {
  entries: TimeEntry[];
  totalHours: number;
  byDate: Record<string, TimeEntry[]>;
  byProject: Record<string, number>;
  validated: boolean;
  validatedAt?: string;
}

export interface UserWeeklySummary {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  totalHours: number;
  validated: boolean;
  validatedAt?: string;
  byDate: Record<string, number>;
  entries: TimeEntry[];
}

export interface DashboardSummary {
  totals: {
    monthlyHours: number;
    yearlyHours: number;
    employeesCount: number;
    projectsCount: number;
    pendingLeaves: number;
  };
  hoursByProject: Array<{
    project: Pick<Project, 'id' | 'code' | 'name'>;
    hours: number;
  }>;
  hoursByTask: Array<{
    task: Pick<Task, 'id' | 'code' | 'label'>;
    hours: number;
  }>;
  hoursByEmployee: Array<{
    employee: Pick<User, 'id' | 'firstName' | 'lastName'>;
    hours: number;
  }>;
}

export interface MonthlyTrend {
  month: number;
  monthName: string;
  hours: number;
}

export interface ProjectComparison {
  project: Pick<Project, 'id' | 'code' | 'name'>;
  estimated: number;
  actual: number;
  variance: number;
  taskBreakdown: Array<{
    task: Pick<Task, 'id' | 'code' | 'label'>;
    estimated: number;
    actual: number;
    variance: number;
  }>;
}

// Form inputs
export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  estimatedHours?: number;
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  code: string;
  label: string;
  description?: string;
  estimatedHours?: number;
  projectId: string;
}

export interface CreateTimeEntryInput {
  date: string;
  hours: number;
  description?: string;
  projectId: string;
  taskId: string;
}

export interface CreateLeaveInput {
  startDate: string;
  endDate: string;
  type?: LeaveType;
  reason?: string;
}
