import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth.js';

const prisma = new PrismaClient();
const router = Router();

// Get dashboard summary (admin only)
router.get('/summary', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) - 1 : now.getMonth();

    const monthStart = startOfMonth(new Date(targetYear, targetMonth));
    const monthEnd = endOfMonth(new Date(targetYear, targetMonth));
    const yearStart = startOfYear(new Date(targetYear, 0));
    const yearEnd = endOfYear(new Date(targetYear, 0));

    // Total hours this month
    const monthlyHours = await prisma.timeEntry.aggregate({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { hours: true },
    });

    // Total hours this year
    const yearlyHours = await prisma.timeEntry.aggregate({
      where: {
        date: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: { hours: true },
    });

    // Active employees count
    const employeesCount = await prisma.user.count({
      where: { isActive: true, role: 'EMPLOYEE' },
    });

    // Active projects count
    const projectsCount = await prisma.project.count({
      where: { status: 'ACTIVE' },
    });

    // Pending leave requests
    const pendingLeaves = await prisma.leaveRequest.count({
      where: { status: 'PENDING' },
    });

    // Hours by project this month
    const hoursByProject = await prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { hours: true },
    });

    const projectsData = await prisma.project.findMany({
      where: {
        id: { in: hoursByProject.map((h) => h.projectId) },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const projectsMap = new Map(projectsData.map((p) => [p.id, p]));

    // Hours by task type this month
    const hoursByTask = await prisma.timeEntry.groupBy({
      by: ['taskId'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { hours: true },
    });

    const tasksData = await prisma.task.findMany({
      where: {
        id: { in: hoursByTask.map((h) => h.taskId) },
      },
      select: {
        id: true,
        label: true,
        code: true,
      },
    });

    const tasksMap = new Map(tasksData.map((t) => [t.id, t]));

    // Hours by employee this month
    const hoursByEmployee = await prisma.timeEntry.groupBy({
      by: ['userId'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { hours: true },
    });

    const employeesData = await prisma.user.findMany({
      where: {
        id: { in: hoursByEmployee.map((h) => h.userId) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const employeesMap = new Map(employeesData.map((e) => [e.id, e]));

    return res.json({
      totals: {
        monthlyHours: monthlyHours._sum.hours || 0,
        yearlyHours: yearlyHours._sum.hours || 0,
        employeesCount,
        projectsCount,
        pendingLeaves,
      },
      hoursByProject: hoursByProject.map((h) => ({
        project: projectsMap.get(h.projectId),
        hours: h._sum.hours || 0,
      })),
      hoursByTask: hoursByTask.map((h) => ({
        task: tasksMap.get(h.taskId),
        hours: h._sum.hours || 0,
      })),
      hoursByEmployee: hoursByEmployee.map((h) => ({
        employee: employeesMap.get(h.userId),
        hours: h._sum.hours || 0,
      })),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get detailed report (admin only)
router.get('/report', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, userId, projectId, taskId, groupBy } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate et endDate sont requis' });
    }

    let where: any = {
      date: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    };

    if (userId) where.userId = userId;
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;

    // Get all entries with details
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            estimatedHours: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            label: true,
            estimatedHours: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { user: { lastName: 'asc' } }],
    });

    // Group data based on groupBy parameter
    let grouped: any = {};

    if (groupBy === 'employee') {
      entries.forEach((entry) => {
        const key = entry.userId;
        if (!grouped[key]) {
          grouped[key] = {
            employee: entry.user,
            totalHours: 0,
            entries: [],
          };
        }
        grouped[key].totalHours += entry.hours;
        grouped[key].entries.push(entry);
      });
    } else if (groupBy === 'project') {
      entries.forEach((entry) => {
        const key = entry.projectId;
        if (!grouped[key]) {
          grouped[key] = {
            project: entry.project,
            totalHours: 0,
            entries: [],
          };
        }
        grouped[key].totalHours += entry.hours;
        grouped[key].entries.push(entry);
      });
    } else if (groupBy === 'task') {
      entries.forEach((entry) => {
        const key = entry.taskId;
        if (!grouped[key]) {
          grouped[key] = {
            task: entry.task,
            totalHours: 0,
            entries: [],
          };
        }
        grouped[key].totalHours += entry.hours;
        grouped[key].entries.push(entry);
      });
    } else if (groupBy === 'date') {
      entries.forEach((entry) => {
        const key = format(entry.date, 'yyyy-MM-dd');
        if (!grouped[key]) {
          grouped[key] = {
            date: key,
            totalHours: 0,
            entries: [],
          };
        }
        grouped[key].totalHours += entry.hours;
        grouped[key].entries.push(entry);
      });
    } else {
      // No grouping
      grouped = { all: { entries, totalHours: entries.reduce((s, e) => s + e.hours, 0) } };
    }

    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    return res.json({
      totalHours,
      entriesCount: entries.length,
      grouped: Object.values(grouped),
    });
  } catch (error) {
    console.error('Report error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get monthly trend (admin only)
router.get('/trend', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const monthlyData = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = startOfMonth(new Date(targetYear, month));
      const monthEnd = endOfMonth(new Date(targetYear, month));

      const hours = await prisma.timeEntry.aggregate({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: { hours: true },
      });

      monthlyData.push({
        month: month + 1,
        monthName: format(monthStart, 'MMM'),
        hours: hours._sum.hours || 0,
      });
    }

    return res.json(monthlyData);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Compare estimated vs actual (admin only)
router.get('/comparison', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get all active projects with estimated hours
    const projects = await prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: {
        tasks: true,
      },
    });

    const comparison = await Promise.all(
      projects.map(async (project) => {
        const actualHours = await prisma.timeEntry.aggregate({
          where: { projectId: project.id },
          _sum: { hours: true },
        });

        // Get task-level breakdown
        const taskBreakdown = await Promise.all(
          project.tasks.map(async (task) => {
            const taskActual = await prisma.timeEntry.aggregate({
              where: { taskId: task.id },
              _sum: { hours: true },
            });

            return {
              task: {
                id: task.id,
                code: task.code,
                label: task.label,
              },
              estimated: task.estimatedHours || 0,
              actual: taskActual._sum.hours || 0,
              variance: (taskActual._sum.hours || 0) - (task.estimatedHours || 0),
            };
          })
        );

        return {
          project: {
            id: project.id,
            code: project.code,
            name: project.name,
          },
          estimated: project.estimatedHours || 0,
          actual: actualHours._sum.hours || 0,
          variance: (actualHours._sum.hours || 0) - (project.estimatedHours || 0),
          taskBreakdown,
        };
      })
    );

    return res.json(comparison);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export { router as dashboardRouter };
