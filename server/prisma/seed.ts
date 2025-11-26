import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Chronova database...');

  // Créer ou mettre à jour le compte admin
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  
  const admin = await prisma.salarie.upsert({
    where: { email: 'admin@chronova.local' },
    update: { 
      password_hash: adminPassword,
      actif: true 
    },
    create: {
      email: 'admin@chronova.local',
      password_hash: adminPassword,
      nom: 'Admin',
      prenom: 'Chronova',
      role: 'Admin',
      actif: true,
      date_entree: new Date(),
    },
  });

  console.log('✅ Admin créé/mis à jour:', admin.email);

  // Créer quelques salariés de test
  const employeePassword = await bcrypt.hash('Test123!', 10);

  const employee1 = await prisma.salarie.upsert({
    where: { email: 'jean.dupont@chronova.local' },
    update: { password_hash: employeePassword },
    create: {
      email: 'jean.dupont@chronova.local',
      password_hash: employeePassword,
      nom: 'Dupont',
      prenom: 'Jean',
      role: 'Salarie',
      actif: true,
      date_entree: new Date(),
    },
  });

  const employee2 = await prisma.salarie.upsert({
    where: { email: 'marie.martin@chronova.local' },
    update: { password_hash: employeePassword },
    create: {
      email: 'marie.martin@chronova.local',
      password_hash: employeePassword,
      nom: 'Martin',
      prenom: 'Marie',
      role: 'Manager',
      actif: true,
      date_entree: new Date(),
    },
  });

  console.log('✅ Employés créés:', employee1.email, employee2.email);

  // Vérifier/créer un client de test
  const client = await prisma.client.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      nom: 'Client Demo',
      email: 'contact@clientdemo.fr',
      ville: 'Paris',
      actif: true,
    },
  });

  console.log('✅ Client créé:', client.nom);

  // Créer un projet de test
  let projet;
  try {
    projet = await prisma.projet.upsert({
      where: { id: BigInt(1) },
      update: {},
      create: {
        code_projet: 'PRJ-001',
        nom: 'Projet Demo',
        description: 'Projet de démonstration',
        client_id: client.id,
        actif: true,
        start_date: new Date(),
      },
    });
    console.log('✅ Projet créé:', projet.nom);
  } catch (e) {
    console.log('⚠️ Projet déjà existant ou erreur');
  }

  console.log('\n🎉 Seeding terminé!');
  console.log('\n📋 Comptes disponibles:');
  console.log('   Admin: admin@chronova.local / Admin123!');
  console.log('   Manager: marie.martin@chronova.local / Test123!');
  console.log('   Salarié: jean.dupont@chronova.local / Test123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
