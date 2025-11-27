import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Chronova database...');

  // ============ TYPES DE TÂCHES ============
  const tacheTypes = [
    { tache_type: 'Câblage', code: 'CAB', couleur: '#3B82F6', ordre: 1 },
    { tache_type: 'DAO', code: 'DAO', couleur: '#8B5CF6', ordre: 2 },
    { tache_type: 'Programmation', code: 'PROG', couleur: '#22C55E', ordre: 3 },
    { tache_type: 'SCADA', code: 'SCADA', couleur: '#F97316', ordre: 4 },
    { tache_type: 'Mise en service', code: 'MES', couleur: '#EF4444', ordre: 5 },
    { tache_type: 'Étude', code: 'ETU', couleur: '#06B6D4', ordre: 6 },
    { tache_type: 'Autre', code: 'AUT', couleur: '#6B7280', ordre: 7, is_default: true },
  ];

  for (const tt of tacheTypes) {
    await prisma.tacheType.upsert({
      where: { code: tt.code },
      update: {},
      create: tt,
    });
  }
  console.log('✅ Types de tâches créés');

  // ============ STATUTS PROJET ============
  const projetStatuts = [
    { status: 'En_cours' as const },
    { status: 'Stoppe' as const },
    { status: 'Termine' as const },
    { status: 'Annule' as const },
  ];

  for (const ps of projetStatuts) {
    await prisma.projetStatus.upsert({
      where: { id: BigInt(projetStatuts.indexOf(ps) + 1) },
      update: {},
      create: ps,
    });
  }
  console.log('✅ Statuts projet créés');

  // ============ FONCTIONS SALARIÉS ============
  const fonctions = [
    { fonction: 'Cableur' as const, description: 'Câbleur électrique' },
    { fonction: 'DAO' as const, description: 'Dessinateur DAO' },
    { fonction: 'Prog' as const, description: 'Programmeur automate' },
    { fonction: 'Chef_Projet' as const, description: 'Chef de projet' },
    { fonction: 'Admin' as const, description: 'Administrateur' },
    { fonction: 'Autre' as const, description: 'Autre fonction' },
  ];

  for (const f of fonctions) {
    await prisma.salarieFonction.upsert({
      where: { id: BigInt(fonctions.indexOf(f) + 1) },
      update: {},
      create: f,
    });
  }
  console.log('✅ Fonctions salariés créées');

  // ============ STATUTS SALARIÉS ============
  const salarieStatuts = [
    { status: 'Salarie' as const, description: 'CDI/CDD' },
    { status: 'Interim' as const, description: 'Intérimaire' },
    { status: 'Sous_traitant' as const, description: 'Sous-traitant' },
    { status: 'Apprentissage' as const, description: 'Apprenti' },
    { status: 'Stage' as const, description: 'Stagiaire' },
    { status: 'Autre' as const, description: 'Autre' },
  ];

  for (const s of salarieStatuts) {
    await prisma.salarieStatus.upsert({
      where: { id: BigInt(salarieStatuts.indexOf(s) + 1) },
      update: {},
      create: s,
    });
  }
  console.log('✅ Statuts salariés créés');

  // ============ ADMIN ============
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
  console.log('✅ Admin créé:', admin.email);

  // ============ SALARIÉS DE TEST ============
  const employeePassword = await bcrypt.hash('Test123!', 10);

  // Fonction Câbleur
  const fonctionCableur = await prisma.salarieFonction.findFirst({ where: { fonction: 'Cableur' } });
  const fonctionProg = await prisma.salarieFonction.findFirst({ where: { fonction: 'Prog' } });
  const fonctionChefProjet = await prisma.salarieFonction.findFirst({ where: { fonction: 'Chef_Projet' } });
  const statusSalarie = await prisma.salarieStatus.findFirst({ where: { status: 'Salarie' } });

  const jean = await prisma.salarie.upsert({
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
      salarie_fonction_id: fonctionCableur?.id,
      salarie_status_id: statusSalarie?.id,
    },
  });

  const marie = await prisma.salarie.upsert({
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
      salarie_fonction_id: fonctionChefProjet?.id,
      salarie_status_id: statusSalarie?.id,
    },
  });

  const pierre = await prisma.salarie.upsert({
    where: { email: 'pierre.durand@chronova.local' },
    update: { password_hash: employeePassword },
    create: {
      email: 'pierre.durand@chronova.local',
      password_hash: employeePassword,
      nom: 'Durand',
      prenom: 'Pierre',
      role: 'Salarie',
      actif: true,
      date_entree: new Date(),
      salarie_fonction_id: fonctionProg?.id,
      salarie_status_id: statusSalarie?.id,
    },
  });

  console.log('✅ Salariés créés:', jean.email, marie.email, pierre.email);

  // ============ CLIENT ============
  const client = await prisma.client.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      nom: 'Client Demo',
      code_client: 'DEMO',
      email: 'contact@clientdemo.fr',
      ville: 'Paris',
      actif: true,
    },
  });
  console.log('✅ Client créé:', client.nom);

  // ============ PROJET AVEC TÂCHES ============
  const statusEnCours = await prisma.projetStatus.findFirst({ where: { status: 'En_cours' } });
  const tacheCablage = await prisma.tacheType.findFirst({ where: { code: 'CAB' } });
  const tacheProg = await prisma.tacheType.findFirst({ where: { code: 'PROG' } });
  const tacheScada = await prisma.tacheType.findFirst({ where: { code: 'SCADA' } });

  const projet = await prisma.projet.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      code_projet: 'PRJ-001',
      nom: 'Ligne Production Alpha',
      description: 'Installation complète ligne de production',
      client_id: client.id,
      projet_status_id: statusEnCours?.id,
      actif: true,
      start_date: new Date(),
      budget_heures: 200,
    },
  });
  console.log('✅ Projet créé:', projet.nom);

  // Ajouter les tâches au projet
  if (tacheCablage) {
    const tacheProjetCab = await prisma.tacheProjet.upsert({
      where: { projet_id_tache_type_id: { projet_id: projet.id, tache_type_id: tacheCablage.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheCablage.id,
        heures_prevues: 80,
      },
    });

    // Assigner Jean (câbleur) à la tâche câblage
    await prisma.tacheProjetSalarie.upsert({
      where: { tache_projet_id_salarie_id: { tache_projet_id: tacheProjetCab.id, salarie_id: jean.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheCablage.id,
        tache_projet_id: tacheProjetCab.id,
        salarie_id: jean.id,
      },
    });
    console.log('✅ Jean assigné au câblage');
  }

  if (tacheProg) {
    const tacheProjetProg = await prisma.tacheProjet.upsert({
      where: { projet_id_tache_type_id: { projet_id: projet.id, tache_type_id: tacheProg.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheProg.id,
        heures_prevues: 60,
      },
    });

    // Assigner Pierre (programmeur) à la programmation
    await prisma.tacheProjetSalarie.upsert({
      where: { tache_projet_id_salarie_id: { tache_projet_id: tacheProjetProg.id, salarie_id: pierre.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheProg.id,
        tache_projet_id: tacheProjetProg.id,
        salarie_id: pierre.id,
      },
    });
    console.log('✅ Pierre assigné à la programmation');
  }

  if (tacheScada) {
    const tacheProjetScada = await prisma.tacheProjet.upsert({
      where: { projet_id_tache_type_id: { projet_id: projet.id, tache_type_id: tacheScada.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheScada.id,
        heures_prevues: 40,
      },
    });

    // Assigner Pierre aussi au SCADA
    await prisma.tacheProjetSalarie.upsert({
      where: { tache_projet_id_salarie_id: { tache_projet_id: tacheProjetScada.id, salarie_id: pierre.id } },
      update: {},
      create: {
        projet_id: projet.id,
        tache_type_id: tacheScada.id,
        tache_projet_id: tacheProjetScada.id,
        salarie_id: pierre.id,
      },
    });
    console.log('✅ Pierre assigné au SCADA');
  }

  console.log('\n🎉 Seeding terminé!');
  console.log('\n📋 Comptes disponibles:');
  console.log('   Admin: admin@chronova.local / Admin123!');
  console.log('   Manager: marie.martin@chronova.local / Test123!');
  console.log('   Câbleur: jean.dupont@chronova.local / Test123!');
  console.log('   Programmeur: pierre.durand@chronova.local / Test123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
