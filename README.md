# Chronova

_Application de gestion du temps, des projets et des salariés pour PME et équipes techniques._

---

##  Aperçu

Chronova permet aux salariés de pointer leurs heures sur des projets et des tâches précises, et aux managers / administrateurs de suivre l'activité en temps réel :

- Suivi des heures par **projet**, **tâche** et **salarié**
- Vue **calendrier** et **hebdomadaire** des pointages
- Gestion des **projets**, **clients** et **salariés**
- Tableau de bord pour accéder rapidement aux principales sections (pointage, calendrier, validations, etc.)

---

##  Fonctionnalités principales

###  Côté salarié

- Connexion sécurisée (email + mot de passe)
- Page **Pointage** avec vue hebdomadaire (par jour, par projet, par tâche)
- Sélection de tâches (programmation, câblage, etc.) par projet
- Récapitulatif des heures, heures supplémentaires et heures dues
- Vue **Calendrier** et **Calendrier view** pour visualiser les semaines et les heures déclarées

### Côté manager / admin

- Gestion des **salariés** : création, édition, désactivation / réactivation
- Gestion des **clients** et **projets**
- Vue des **pointages** de tous les salariés (page Admin)
- Tableau de bord transformé en **hub de navigation** (accès rapide aux principales pages)
- Filtrage et tri des données (par salarié, projet, période, etc.)

---

## Stack technique

### Frontend (`client/`)

- **React 18** + **TypeScript**
- **Vite** (dev server & build)
- **React Router v6** (navigation)
- **@tanstack/react-query** (requêtes API & cache)
- **Zustand** (store d'authentification)
- **Tailwind CSS** (design moderne)
- **lucide-react** (icônes)
- **date-fns** (gestion des dates)

### Backend (`server/`)

- **Node.js** + **Express**
- **TypeScript**
- **Prisma** + **PostgreSQL**
- **JWT** (authentification)
- **Zod** (validation)

### Base de données (`database/`)

- Script SQL d'initialisation : `database/chronova_database.sql`

---

## Structure du projet

```bash
Chronova/
├── client/               # Frontend React (Chronova Client)
│   ├── src/
│   │   ├── components/   # Layout, UI, pointage, etc.
│   │   ├── pages/        # Dashboard, Calendrier, Pointage, Projets, Salariés...
│   │   ├── services/     # Appels API (axios)
│   │   ├── stores/       # Zustand (auth)
│   │   ├── types/        # Types partagés
│   │   └── utils/        # Fonctions utilitaires (dates, etc.)
│   └── vite.config.ts
│
├── server/               # API Node/Express (Chronova Server)
│   ├── src/
│   │   ├── routes/       # Routes API (auth, projets, pointages, salariés, etc.)
│   │   ├── middlewares/  # Auth, erreurs...
│   │   └── index.ts      # Point d'entrée serveur
│   ├── prisma/
│   │   └── schema.prisma # Modèle de données
│   └── package.json
│
├── database/             # Scripts SQL et exports
├── docker-compose.yml    # Lancement complet (db + API + client)
└── README.md
```

---

##  Démarrage rapide

### 1. Prérequis

- Node.js **18+**
- npm (ou pnpm / yarn)
- PostgreSQL **15+** (ou Docker)

### 2. Lancement complet avec Docker (recommandé)

À la racine du projet :

```bash
# Cloner le dépôt
git clone https://github.com/<votre-username>/Chronova.git
cd Chronova

# Démarrer la base, l'API et le client
docker-compose up -d
```

Par défaut :

- API accessible sur `http://localhost:4000`
- Frontend accessible sur `http://localhost:3000`

### 3. Lancement en mode développeur (sans Docker)

#### Backend

```bash
cd server
npm install

# Configurer Prisma / base de données
npm run db:migrate      # ou npm run db:push
npm run db:seed         # si nécessaire

# Lancer l'API
npm run dev
```

#### Frontend

Dans un autre terminal :

```bash
cd client
npm install
npm run dev
```

Par défaut, Vite démarre sur `http://localhost:5173`.

---

##  Configuration

### Variables d'environnement serveur (`server/.env`)

Exemple minimal :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chronova"

JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="7d"
```

### Variables d'environnement client (`client/.env`)

```env
VITE_API_URL="http://localhost:4000/api"
```

---

## Pages principales de l’interface

- `/login` : connexion
- `/dashboard` : hub de navigation (cartes cliquables vers les autres pages)
- `/pointage` : pointage hebdomadaire des heures
- `/calendrier` : vue calendrier classique
- `/calendrier-view` : vue calendrier avancée (cartes hebdos, résumé mensuel)
- `/projets` / `/projets-details` : gestion et détail des projets
- `/clients` : gestion des clients
- `/salaries` : gestion des salariés (désactivation / réactivation, tri actifs/inactifs)
- `/admin/pointages` (selon routes) : vue admin des pointages

---

##  Scripts utiles

### Client (`client/`)

```bash
npm run dev       # Démarrage en développement
npm run build     # Build de production
npm run preview   # Prévisualisation du build
```

### Serveur (`server/`)

```bash
npm run dev        # Démarrage en développement
npm run build      # Build TypeScript
npm run start      # Lancer la version compilée

npm run db:migrate # Migrations Prisma
npm run db:seed    # Seed de la base
```

---

##  Contribution

1. Forker le dépôt
2. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commiter vos changements : `git commit -m "Ajout: ma fonctionnalité"`
4. Pousser la branche : `git push origin feature/ma-fonctionnalite`
5. Ouvrir une Pull Request

Merci de respecter le style de code existant (TypeScript, formatage automatique, etc.).

---

## Licence

Ce projet est distribué sous licence **MIT**. Voir le fichier `LICENSE`.

