import { z } from 'zod';

// Auth validators
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

// User validators
export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional().default('EMPLOYEE'),
});

export const updateUserSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  isActive: z.boolean().optional(),
});

// Project validators
export const createProjectSchema = z.object({
  code: z.string().min(1, 'Code requis').max(20, 'Code trop long'),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// Task validators
export const createTaskSchema = z.object({
  code: z.string().min(1, 'Code requis').max(20, 'Code trop long'),
  label: z.string().min(1, 'Libellé requis'),
  description: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  projectId: z.string().min(1, 'Projet requis'),
});

export const updateTaskSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

// Time entry validators
export const createTimeEntrySchema = z.object({
  date: z.string().transform((str) => new Date(str)),
  hours: z.number().positive().max(24, 'Maximum 24 heures par jour'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'Projet requis'),
  taskId: z.string().min(1, 'Tâche requise'),
});

export const updateTimeEntrySchema = z.object({
  hours: z.number().positive().max(24).optional(),
  description: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
});

export const validateWeekSchema = z.object({
  weekNumber: z.number().min(1).max(53),
  year: z.number().min(2020).max(2100),
});

// Leave validators
export const createLeaveSchema = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  type: z.enum(['PAID', 'UNPAID', 'SICK', 'OTHER']).optional().default('PAID'),
  reason: z.string().optional(),
});

export const updateLeaveStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// Holiday validators
export const createHolidaySchema = z.object({
  date: z.string().transform((str) => new Date(str)),
  name: z.string().min(1, 'Nom requis'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type ValidateWeekInput = z.infer<typeof validateWeekSchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
