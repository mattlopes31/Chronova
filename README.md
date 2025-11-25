# ⏱️ TimeTrack Pro

<div align="center">

![TimeTrack Pro](https://img.shields.io/badge/TimeTrack-Pro-0066FF?style=for-the-badge&logo=clockify&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

**Application de gestion des heures par tâche et projet pour les équipes industrielles**

[Démo en ligne](#) • [Documentation](#documentation) • [Installation](#installation) • [Contribution](#contribution)

</div>

---

## 📋 Table des matières

- [Aperçu](#-aperçu)
- [Fonctionnalités](#-fonctionnalités)
- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [API Documentation](#-api-documentation)
- [Contribution](#-contribution)
- [Licence](#-licence)

---

## 🎯 Aperçu

**TimeTrack Pro** est une solution complète de gestion du temps de travail conçue pour les entreprises industrielles. Elle permet aux salariés de pointer leurs heures sur des tâches spécifiques (câblage, programmation SCADA, schémas, mise en service, etc.) tout en offrant aux administrateurs une vue d'ensemble détaillée de la productivité.

### Problèmes résolus

- ✅ Suivi précis des heures par tâche et par projet
- ✅ Validation hebdomadaire des feuilles de temps
- ✅ Gestion des congés et jours fériés
- ✅ Dashboard analytique pour les managers
- ✅ Comparaison temps estimé vs temps réel

---

## ✨ Fonctionnalités

### 👤 Espace Salarié

| Fonctionnalité | Description |
|----------------|-------------|
| 🔐 **Authentification sécurisée** | Connexion par identifiant/mot de passe avec récupération par email |
| 📅 **Calendrier interactif** | Saisie des heures sur un calendrier hebdomadaire intuitif |
| 📊 **Vue hebdomadaire** | Affichage intelligent des semaines avec total d'heures en fin de ligne |
| ✅ **Validation des semaines** | Verrouillage des semaines après validation |
| 🏖️ **Gestion des congés** | Déclaration des jours de congé (cases grisées) |
| 🔴 **Jours fériés** | Visualisation claire des jours fériés (cases rouges) |

### 👑 Espace Administrateur

| Fonctionnalité | Description |
|----------------|-------------|
| 👥 **Gestion des salariés** | Création, modification, suppression des comptes |
| 📁 **Gestion des projets** | Création de projets avec ID, nom, description |
| 📋 **Gestion des tâches** | Définition des tâches avec temps estimé |
| 👁️ **Vue globale** | Visualisation des heures de tous les salariés |
| ✏️ **Édition avancée** | Modification des semaines validées |
| 📈 **Dashboard analytique** | Statistiques détaillées par salarié/projet/tâche |

### 📊 Dashboard & Analytics

- Heures totales par mois/salarié
- Répartition par type de tâche
- Comparaison temps estimé vs réalisé
- Export des données (CSV, PDF)
- Graphiques interactifs

---

## 🛠️ Stack Technique

### Frontend

```
React 18          → Interface utilisateur moderne
TypeScript        → Typage statique robuste
Tailwind CSS      → Styling utilitaire
Zustand           → State management léger
React Query       → Gestion des données serveur
React Router      → Navigation SPA
Recharts          → Visualisations graphiques
date-fns          → Manipulation des dates
```

### Backend

```
Node.js 20        → Runtime JavaScript
Express.js        → Framework HTTP
TypeScript        → Typage statique
Prisma            → ORM moderne
PostgreSQL        → Base de données relationnelle
JWT               → Authentification
Nodemailer        → Envoi d'emails
Zod               → Validation des données
```

### DevOps & Outils

```
Docker            → Conteneurisation
Docker Compose    → Orchestration locale
ESLint            → Linting du code
Prettier          → Formatage automatique
Vitest            → Tests unitaires
GitHub Actions    → CI/CD
```

---

## 🏗️ Architecture

```
timetrack-pro/
├── 📁 client/                    # Application React
│   ├── 📁 src/
│   │   ├── 📁 components/        # Composants réutilisables
│   │   │   ├── 📁 ui/            # Composants UI de base
│   │   │   ├── 📁 calendar/      # Composants calendrier
│   │   │   ├── 📁 dashboard/     # Composants dashboard
│   │   │   └── 📁 layout/        # Layout & navigation
│   │   ├── 📁 pages/             # Pages de l'application
│   │   ├── 📁 hooks/             # Hooks personnalisés
│   │   ├── 📁 stores/            # État global (Zustand)
│   │   ├── 📁 services/          # Appels API
│   │   ├── 📁 types/             # Types TypeScript
│   │   └── 📁 utils/             # Fonctions utilitaires
│   ├── 📄 package.json
│   └── 📄 vite.config.ts
│
├── 📁 server/                    # API Node.js
│   ├── 📁 src/
│   │   ├── 📁 controllers/       # Logique métier
│   │   ├── 📁 middlewares/       # Middlewares Express
│   │   ├── 📁 routes/            # Définition des routes
│   │   ├── 📁 services/          # Services métier
│   │   ├── 📁 validators/        # Validation Zod
│   │   └── 📄 index.ts           # Point d'entrée
│   ├── 📁 prisma/
│   │   └── 📄 schema.prisma      # Schéma de BDD
│   └── 📄 package.json
│
├── 📄 docker-compose.yml         # Configuration Docker
├── 📄 .env.example               # Variables d'environnement
└── 📄 README.md
```

### Modèle de données

```prisma
User (Salarié)
├── id, email, password, firstName, lastName
├── role (ADMIN | EMPLOYEE)
└── assignedTasks[], timeEntries[], leaveRequests[]

Project (Projet)
├── id, code, name, description
├── estimatedHours, status
└── tasks[], assignments[]

Task (Tâche)
├── id, code, label, description
├── estimatedHours, projectId
└── timeEntries[]

TimeEntry (Pointage)
├── id, date, hours, validated
├── userId, projectId, taskId
└── weekNumber, year

LeaveRequest (Congé)
├── id, startDate, endDate, type
├── status, userId
└── approved, approvedBy
```

---

## 🚀 Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- npm ou yarn
- Docker (optionnel)

### Installation rapide avec Docker

```bash
# Cloner le repository
git clone https://github.com/votre-username/timetrack-pro.git
cd timetrack-pro

# Copier les variables d'environnement
cp .env.example .env

# Lancer avec Docker Compose
docker-compose up -d

# L'application est accessible sur http://localhost:3000
```

### Installation manuelle

```bash
# Cloner le repository
git clone https://github.com/votre-username/timetrack-pro.git
cd timetrack-pro

# Installation des dépendances serveur
cd server
npm install

# Configuration de la base de données
npx prisma migrate dev
npx prisma db seed

# Installation des dépendances client
cd ../client
npm install

# Lancer le serveur de développement
cd ../server && npm run dev &
cd ../client && npm run dev
```

---

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/timetrack"

# JWT
JWT_SECRET="votre-secret-jwt-très-sécurisé"
JWT_EXPIRES_IN="7d"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="votre-email@gmail.com"
SMTP_PASS="votre-mot-de-passe-app"

# Application
APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"

# Admin par défaut
ADMIN_EMAIL="admin@entreprise.com"
ADMIN_PASSWORD="Admin123!"
```

---

## 📖 Utilisation

### Premier démarrage

1. **Connexion Admin** : Utilisez les identifiants par défaut
2. **Créer les tâches types** : Câbleur, Programme SCADA, Schéma de câblage, etc.
3. **Créer les projets** : Avec leur code, nom et description
4. **Créer les salariés** : Assignez-leur des tâches

### Pour les salariés

1. Se connecter avec ses identifiants
2. Naviguer vers le calendrier
3. Cliquer sur une journée pour saisir les heures
4. Sélectionner le projet et la tâche
5. Valider la semaine en fin de semaine

### Pour les administrateurs

1. Accéder au Dashboard pour voir les statistiques
2. Gérer les utilisateurs, projets et tâches
3. Visualiser et éditer les feuilles de temps
4. Approuver les demandes de congés

---

## 📚 API Documentation

### Authentification

```http
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Utilisateurs

```http
GET    /api/users           # Liste (admin)
POST   /api/users           # Créer (admin)
GET    /api/users/:id       # Détail
PUT    /api/users/:id       # Modifier (admin)
DELETE /api/users/:id       # Supprimer (admin)
```

### Projets

```http
GET    /api/projects        # Liste
POST   /api/projects        # Créer (admin)
GET    /api/projects/:id    # Détail
PUT    /api/projects/:id    # Modifier (admin)
DELETE /api/projects/:id    # Supprimer (admin)
```

### Pointages

```http
GET    /api/time-entries              # Mes pointages
POST   /api/time-entries              # Créer
PUT    /api/time-entries/:id          # Modifier
DELETE /api/time-entries/:id          # Supprimer
POST   /api/time-entries/validate-week # Valider semaine
GET    /api/time-entries/all          # Tous (admin)
```

### Congés

```http
GET    /api/leaves          # Mes congés
POST   /api/leaves          # Demander
PUT    /api/leaves/:id      # Modifier
DELETE /api/leaves/:id      # Annuler
POST   /api/leaves/:id/approve # Approuver (admin)
```

---

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:coverage

# Tests E2E
npm run test:e2e
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

1. **Fork** le projet
2. **Créer** une branche (`git checkout -b feature/AmazingFeature`)
3. **Commit** les changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir** une Pull Request

### Guidelines

- Suivre les conventions de code existantes
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire

---

## 📄 Licence

Distribué sous licence MIT. Voir `LICENSE` pour plus d'informations.

---

## 📞 Support

- 📧 Email : support@timetrack-pro.com
- 🐛 Issues : [GitHub Issues](https://github.com/votre-username/timetrack-pro/issues)
- 💬 Discussions : [GitHub Discussions](https://github.com/votre-username/timetrack-pro/discussions)

---

<div align="center">

**Fait avec ❤️ pour simplifier la gestion du temps**

⭐ Star ce repo si vous le trouvez utile !

</div>
