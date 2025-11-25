import { PrismaClient, Role, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@timetrack.com' },
    update: {},
    create: {
      email: 'admin@timetrack.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'TimeTrack',
      role: Role.ADMIN,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create sample employees
  const employeePassword = await bcrypt.hash('Employee123!', 12);
  const employees = await Promise.all([
    prisma.user.upsert({
      where: { email: 'jean.dupont@timetrack.com' },
      update: {},
      create: {
        email: 'jean.dupont@timetrack.com',
        password: employeePassword,
        firstName: 'Jean',
        lastName: 'Dupont',
        role: Role.EMPLOYEE,
      },
    }),
    prisma.user.upsert({
      where: { email: 'marie.martin@timetrack.com' },
      update: {},
      create: {
        email: 'marie.martin@timetrack.com',
        password: employeePassword,
        firstName: 'Marie',
        lastName: 'Martin',
        role: Role.EMPLOYEE,
      },
    }),
    prisma.user.upsert({
      where: { email: 'pierre.durand@timetrack.com' },
      update: {},
      create: {
        email: 'pierre.durand@timetrack.com',
        password: employeePassword,
        firstName: 'Pierre',
        lastName: 'Durand',
        role: Role.EMPLOYEE,
      },
    }),
  ]);
  console.log('✅ Sample employees created');

  // Create sample projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { code: 'PRJ-001' },
      update: {},
      create: {
        code: 'PRJ-001',
        name: 'Installation Ligne Production A',
        description: 'Installation complète de la ligne de production A avec système SCADA',
        status: ProjectStatus.ACTIVE,
        estimatedHours: 500,
      },
    }),
    prisma.project.upsert({
      where: { code: 'PRJ-002' },
      update: {},
      create: {
        code: 'PRJ-002',
        name: 'Mise à niveau Système B',
        description: 'Mise à niveau du système de contrôle existant',
        status: ProjectStatus.ACTIVE,
        estimatedHours: 200,
      },
    }),
    prisma.project.upsert({
      where: { code: 'PRJ-003' },
      update: {},
      create: {
        code: 'PRJ-003',
        name: 'Maintenance Préventive Q1',
        description: 'Maintenance préventive trimestrielle',
        status: ProjectStatus.ACTIVE,
        estimatedHours: 100,
      },
    }),
  ]);
  console.log('✅ Sample projects created');

  // Create tasks for each project
  const taskTypes = [
    { code: 'CAB', label: 'Câblage', description: 'Travaux de câblage électrique', estimatedHours: 80 },
    { code: 'SCADA', label: 'Programme SCADA', description: 'Développement et configuration SCADA', estimatedHours: 120 },
    { code: 'SCHEMA', label: 'Schéma de câblage', description: 'Création des schémas électriques', estimatedHours: 40 },
    { code: 'MES', label: 'Mise en service', description: 'Mise en service et tests', estimatedHours: 60 },
    { code: 'DOC', label: 'Documentation', description: 'Rédaction de la documentation technique', estimatedHours: 20 },
    { code: 'TEST', label: 'Tests & Validation', description: 'Tests fonctionnels et validation', estimatedHours: 40 },
  ];

  for (const project of projects) {
    for (const taskType of taskTypes) {
      await prisma.task.upsert({
        where: {
          projectId_code: {
            projectId: project.id,
            code: taskType.code,
          },
        },
        update: {},
        create: {
          code: taskType.code,
          label: taskType.label,
          description: taskType.description,
          estimatedHours: taskType.estimatedHours,
          projectId: project.id,
        },
      });
    }
  }
  console.log('✅ Tasks created for all projects');

  // Assign employees to projects
  for (const employee of employees) {
    for (const project of projects) {
      await prisma.projectAssignment.upsert({
        where: {
          userId_projectId: {
            userId: employee.id,
            projectId: project.id,
          },
        },
        update: {},
        create: {
          userId: employee.id,
          projectId: project.id,
        },
      });
    }
  }
  console.log('✅ Employees assigned to projects');

  // Create French public holidays for 2025
  const holidays2025 = [
    { date: new Date('2025-01-01'), name: 'Jour de l\'An' },
    { date: new Date('2025-04-21'), name: 'Lundi de Pâques' },
    { date: new Date('2025-05-01'), name: 'Fête du Travail' },
    { date: new Date('2025-05-08'), name: 'Victoire 1945' },
    { date: new Date('2025-05-29'), name: 'Ascension' },
    { date: new Date('2025-06-09'), name: 'Lundi de Pentecôte' },
    { date: new Date('2025-07-14'), name: 'Fête Nationale' },
    { date: new Date('2025-08-15'), name: 'Assomption' },
    { date: new Date('2025-11-01'), name: 'Toussaint' },
    { date: new Date('2025-11-11'), name: 'Armistice' },
    { date: new Date('2025-12-25'), name: 'Noël' },
  ];

  for (const holiday of holidays2025) {
    await prisma.publicHoliday.upsert({
      where: { date: holiday.date },
      update: {},
      create: {
        date: holiday.date,
        name: holiday.name,
        year: 2025,
      },
    });
  }
  console.log('✅ Public holidays 2025 created');

  console.log('🎉 Seeding completed!');
  console.log('\n📋 Default credentials:');
  console.log('   Admin: admin@timetrack.com / Admin123!');
  console.log('   Employee: jean.dupont@timetrack.com / Employee123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
