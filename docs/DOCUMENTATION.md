# Documentation Planbase

## Vue d'ensemble

Planbase est une plateforme SaaS modulaire complète conçue pour les freelances et créateurs de startups. Elle centralise la gestion de projets, clients, tâches, notes et fichiers avec des fonctionnalités d'intelligence artificielle intégrées.

## Table des matières

1. [Architecture technique](#architecture-technique)
2. [Fonctionnalités implémentées](#fonctionnalités-implémentées)
3. [Structure de la base de données](#structure-de-la-base-de-données)
4. [Guide d'utilisation](#guide-dutilisation)
5. [Configuration et déploiement](#configuration-et-déploiement)

---

## Architecture technique

### Stack technologique

**Frontend**
- React 18 avec TypeScript
- Vite pour le build et le développement
- Wouter pour le routing
- TanStack Query (React Query v5) pour la gestion du state serveur
- Shadcn/ui + Tailwind CSS pour les composants UI
- Framer Motion pour les animations
- Lucide React pour les icônes

**Backend**
- Node.js avec Express et TypeScript
- Architecture REST API
- Middleware d'authentification basé sur les headers (dev)

**Base de données**
- Supabase PostgreSQL
- Drizzle ORM pour les requêtes
- Extensions PostgreSQL :
  - `pgvector` pour les embeddings AI (recherche sémantique)
  - `pg_trgm` pour la recherche floue
  - `pgcrypto` et `uuid-ossp` pour la génération d'UUID

**Services externes**
- Supabase Auth (authentification multi-comptes)
- Supabase Storage (stockage de fichiers)
- OpenAI API :
  - GPT-5 pour résumés, extraction d'actions
  - Whisper pour transcription audio
  - text-embedding-ada-002 pour embeddings sémantiques
- Gmail API (intégration email - à venir)

### Système de design (Buddy)

**Typographie**
- Police principale : Montserrat (globale)
- Police secondaire : Inter

**Palette de couleurs**
- Primary : Violet (`#7C3AED`)
- Accent : Cyan (`#06B6D4`)
- Success : Green (`#10B981`)
- Support complet du mode sombre

**Composants**
- Tous les composants utilisent Shadcn/ui
- Design entièrement responsive (mobile-first)
- Animations subtiles avec Framer Motion

---

## Fonctionnalités implémentées

### 1. Tableau de bord (Dashboard)

**KPI en temps réel**
- Nombre total de clients
- Nombre total de projets
- Nombre d'opportunités (clients en prospection/qualified/negotiation)
- Nombre de tâches actives

**Activités récentes**
- Liste des 10 dernières activités
- Filtrage par type d'activité
- Affichage chronologique avec timestamps

**Projets en cours**
- Vue carte des projets actifs
- Progression visuelle avec barre de progression
- Liens directs vers les détails de projet

### 2. CRM (Gestion clients)

**Liste des clients**
- Affichage en tableau avec pagination
- Recherche par nom
- Filtrage par statut (prospecting, qualified, negotiation, won, lost)
- Badge de statut coloré
- Tri par colonnes

**Détails client**
- Informations complètes (nom, type, statut, budget, notes)
- Édition inline avec autosave
- Suppression avec confirmation
- Onglets personnalisables :
  - **Infos** : Données de base du client
  - **Contacts** : Liste des contacts associés
  - **Projets** : Projets liés au client
  - **Activités** : Historique des interactions
  - **Onglets personnalisés** : Ajout d'onglets avec champs custom

**Champs personnalisés**
- Création d'onglets custom par compte
- Ajout de champs personnalisés par onglet :
  - Types supportés : text, date, number, link, boolean, checkbox, multiselect
  - Options configurables pour multiselect
  - Ordre personnalisable par drag & drop
- Valeurs sauvegardées par client
- Suppression avec AlertDialog de confirmation

**Contacts**
- Gestion des contacts liés à un client
- Civilité, nom, prénom, email, téléphone, mobile
- Position/rôle dans l'entreprise
- Contact principal (isPrimary)
- CRUD complet

### 3. Gestion de projets

**Liste des projets**
- Vue carte responsive
- Filtrage par étape (prospection, en_cours, termine, signe)
- Recherche par nom
- Badge de statut et catégorie
- Progression visuelle des tâches
- Informations : client, budget, dates

**Détails de projet**
- Informations complètes avec édition
- Description détaillée
- Période (dates de début/fin)
- Barre de progression basée sur les tâches terminées
- **Tâches associées** :
  - Organisées par colonnes (statuts Kanban)
  - Accordion par colonne avec compteurs
  - Clic sur tâche ouvre le popup de détail/édition
  - Icône poubelle pour suppression (avec confirmation)

**Vue des tâches du projet**
- Vue Liste par défaut (changé depuis Kanban)
- Vue Kanban disponible
- Drag & drop pour réorganiser les tâches
- Colonnes personnalisables (couleurs, noms, ordre)

### 4. Gestion des tâches

**Caractéristiques des tâches**
- Titre et description
- Priorité (low, medium, high)
- Statut (colonnes Kanban personnalisables)
- Date d'échéance
- Assignation à un utilisateur
- **Évaluation de l'effort** (1-5 étoiles)
- Lien vers client (optionnel)
- Lien vers projet (optionnel)
- Position dans la colonne (drag & drop)

**Édition des tâches**
- Popup de détail avec tous les champs éditables :
  - Titre
  - Description
  - Priorité
  - Assigné à
  - Date d'échéance
  - Effort (1-5 étoiles : très facile → très difficile)
  - Statut (changement de colonne)
- **Autosave automatique** (debounced à 500ms)
- Message indicatif : "Les changements sont automatiquement sauvegardés"

**Vues disponibles**
- Vue Liste (défaut) : liste détaillée avec tri et filtres
- Vue Kanban : colonnes drag & drop
- Filtres : par projet, client, assigné, priorité, date

**Suppression**
- Icône poubelle sur chaque tâche
- AlertDialog de confirmation avant suppression

### 5. Colonnes de tâches personnalisables

**Gestion des colonnes**
- Création de colonnes par projet
- Personnalisation :
  - Nom de la colonne
  - Couleur (picker de couleur)
  - Ordre/position
- Colonnes par défaut : "À faire", "En cours", "Terminé"
- Drag & drop pour réorganiser les colonnes
- Suppression de colonnes (avec gestion des tâches associées)

### 6. Activités

**Suivi des activités**
- Enregistrement automatique des actions
- Types d'activités : client_created, project_created, task_completed, etc.
- Métadonnées associées (JSON)
- Filtrage par type
- Affichage chronologique

### 7. Multi-tenancy (Comptes)

**Architecture multi-comptes**
- Système de comptes (accounts) avec RLS
- Un propriétaire par compte (ownerUserId)
- Plans : starter, pro, enterprise
- Settings configurables (JSON)

**Utilisateurs**
- Rôles : owner, collaborator, client_viewer
- Profils complets : firstName, lastName, email, avatar
- Lien avec Supabase Auth (id = auth.users.id)
- Genre et position

**Invitations**
- Système d'invitation par email
- Token d'invitation avec expiration
- Statuts : pending, accepted, revoked, expired

### 8. Système OKR (Objectifs et Résultats Clés)

**Vue d'ensemble**
Le système OKR permet de définir des objectifs stratégiques pour chaque projet et de les suivre via des résultats clés mesurables. Les résultats clés peuvent être liés à des éléments de travail existants (tâches, epics, sprints, roadmap).

**Modèle de données**
- `okr_objectives` : Objectifs stratégiques par projet
  - `id` : UUID unique
  - `projectId` : Lien vers le projet
  - `title` : Titre de l'objectif
  - `description` : Description détaillée (optionnelle)
  - `type` : Type d'objectif (business, product, technical, operational)
  - `targetPhase` : Phase cible (mvp, growth, scale, enterprise)
  - `status` : Statut (draft, active, completed, cancelled)
  - `progress` : Progression globale (0-100%)
  - `startDate` / `endDate` : Période de l'objectif
  - `order` : Position dans la liste

- `okr_key_results` : Résultats clés par objectif
  - `id` : UUID unique
  - `objectiveId` : Lien vers l'objectif parent
  - `title` : Titre du résultat clé
  - `description` : Description (optionnelle)
  - `metricType` : Type de métrique (percentage, number, currency, boolean)
  - `startValue` / `targetValue` / `currentValue` : Valeurs de suivi
  - `progress` : Progression calculée (0-100%)
  - `status` : Statut (not_started, on_track, at_risk, behind, completed)
  - `order` : Position dans la liste

- `okr_links` : Liens entre Key Results et entités
  - `id` : UUID unique
  - `keyResultId` : Lien vers le résultat clé
  - `entityType` : Type d'entité (task, epic, sprint, roadmap_item)
  - `entityId` : ID de l'entité liée

**Vues disponibles**

*Vue Liste*
- Affichage des objectifs en cartes avec KR sous forme de liste
- Barre de progression par objectif
- Actions rapides : créer KR, lier entité, supprimer
- Tâches liées affichées avec fond blanc (`bg-white dark:bg-gray-900`)

*Vue Hiérarchique (Arbre)*
- Structure arborescente : Objectif → Key Results → Entités liées
- Tâches liées affichées horizontalement sous chaque KR avec `flex-wrap`
- Fond blanc pour les entités liées (`bg-white dark:bg-gray-900`)
- Taille de police : 11px pour les titres des entités liées
- Clic sur une tâche ouvre le `TaskDetailModal` avec édition complète

**Fonctionnalités des liens**

*Types d'entités supportés*
- **Tâche** : Lien vers une tâche du projet (affiche titre + badge)
- **Epic** : Lien vers un epic du backlog
- **Sprint** : Lien vers un sprint
- **Roadmap Item** : Lien vers une étape de la roadmap

*Création de liens*
1. Cliquer sur l'icône de lien à côté d'un KR
2. Sélectionner le type d'entité
3. Choisir l'entité dans la liste déroulante
4. Confirmer pour créer le lien

*Création de tâche depuis un KR*
1. Cliquer sur l'icône + à côté d'un KR
2. Saisir le titre de la nouvelle tâche
3. La tâche est créée dans le backlog du projet
4. Un lien automatique est créé vers le KR

**Intégration TaskDetailModal**

En cliquant sur une tâche liée (dans les deux vues), le panneau de détail de tâche s'ouvre avec toutes les fonctionnalités :
- Édition du titre et description
- Changement de statut/colonne
- Assignation utilisateur
- Priorité et date d'échéance
- Effort (1-5 étoiles)
- Autosave automatique (500ms debounce)

**Données requises pour le composant OkrTreeView**
```typescript
const usersQuery = useQuery({ queryKey: ["/api/accounts/:accountId/users"] });
const projectsQuery = useQuery({ queryKey: ["/api/projects"] });
const taskColumnsQuery = useQuery({ queryKey: ["/api/task-columns"] });
const backlogsQuery = useQuery({ queryKey: ["/api/backlogs"] });
const tasksQuery = useQuery({ queryKey: [`/api/projects/${projectId}/tasks`] });
```

**Sécurité multi-tenant**
- Toutes les tables OKR incluent `accountId` pour le RLS
- Les tâches sont récupérées via `/api/projects/:projectId/tasks` avec scoping accountId+projectId
- Les liens ne peuvent référencer que des entités du même compte/projet

**Styles UI/UX**
- Fond blanc pour les entités liées : `bg-white dark:bg-gray-900`
- Layout horizontal en vue arbre : `flex flex-wrap gap-1.5`
- Police des titres d'entités : `text-[11px]`
- Badges de type : `text-[9px]` avec variant secondary
- Interaction hover : classe `hover-elevate`
- Bouton de suppression de lien : icône poubelle avec `stopPropagation`

**Toast notifications**
- Création de lien : "Lien créé avec succès"
- Suppression de lien : "Lien supprimé"
- Création de tâche depuis KR : "Tâche créée et liée au Key Result"

**Endpoints API**
```
GET    /api/projects/:projectId/okr/objectives
POST   /api/projects/:projectId/okr/objectives
PATCH  /api/projects/:projectId/okr/objectives/:id
DELETE /api/projects/:projectId/okr/objectives/:id

GET    /api/projects/:projectId/okr/objectives/:objectiveId/key-results
POST   /api/projects/:projectId/okr/objectives/:objectiveId/key-results
PATCH  /api/projects/:projectId/okr/key-results/:id
DELETE /api/projects/:projectId/okr/key-results/:id

GET    /api/projects/:projectId/okr/key-results/:keyResultId/links
POST   /api/projects/:projectId/okr/key-results/:keyResultId/links
DELETE /api/projects/:projectId/okr/links/:id

POST   /api/projects/:projectId/okr/key-results/:keyResultId/create-task
```

### 9. Sécurité et authentification

**Authentification actuelle (développement)**
- Authentification basée sur les headers
- Header `x-user-id` pour identification
- **Note** : Production nécessitera JWT Supabase Auth complet

**Row Level Security (RLS)**
- Toutes les tables ont un `account_id`
- Policies RLS sur toutes les opérations
- Isolation complète des données par compte

**Gestion des secrets**
- Variables d'environnement pour :
  - DATABASE_URL (Supabase)
  - OPENAI_API_KEY
  - SUPABASE_* (URL, keys)
  - SESSION_SECRET
- Secrets gérés par Replit (hors git)

---

## Structure de la base de données

### Tables principales

#### Comptes et utilisateurs
- `accounts` : Comptes multi-tenant
- `app_users` : Utilisateurs de l'application
- `invitations` : Invitations à rejoindre un compte

#### CRM
- `clients` : Clients/prospects
- `contacts` : Contacts liés aux clients
- `client_custom_tabs` : Onglets personnalisés
- `client_custom_fields` : Champs personnalisés par onglet
- `client_custom_field_values` : Valeurs des champs custom par client

#### Projets et tâches
- `projects` : Projets
- `tasks` : Tâches (peuvent être liées à un projet ou indépendantes)
- `task_columns` : Colonnes Kanban par projet
- `deals` : Opportunités/deals (pipeline commercial)

#### Activités
- `activities` : Journal d'activités

#### Notes (prévu)
- `notes` : Notes avec support AI
- `note_versions` : Versioning des notes
- `note_shares` : Partage de notes
- `note_embeddings` : Embeddings pour recherche sémantique

#### Fichiers (prévu)
- `files` : Métadonnées des fichiers
- `file_versions` : Versioning des fichiers
- `file_shares` : Partage de fichiers
- `folders` : Organisation hiérarchique

#### Emails (prévu)
- `emails` : Emails synchronisés
- `email_attachments` : Pièces jointes

#### Produits et roadmap (prévu)
- `products` : Catalogue produits
- `features` : Fonctionnalités produit
- `roadmap_items` : Items de roadmap

#### OKR (Objectifs et Résultats Clés)
- `okr_objectives` : Objectifs stratégiques par projet
- `okr_key_results` : Résultats clés mesurables
- `okr_links` : Liens vers tâches, epics, sprints, roadmap

### Relations clés

```
accounts (1) ──→ (N) app_users
accounts (1) ──→ (N) clients
accounts (1) ──→ (N) projects
accounts (1) ──→ (N) tasks

clients (1) ──→ (N) contacts
clients (1) ──→ (N) projects
clients (1) ──→ (N) tasks (optionnel)
clients (1) ──→ (N) client_custom_field_values

projects (1) ──→ (N) tasks
projects (1) ──→ (N) task_columns

client_custom_tabs (1) ──→ (N) client_custom_fields
client_custom_fields (1) ──→ (N) client_custom_field_values

app_users (1) ──→ (N) tasks (assignation)
```

### Indexes importants

- `account_id` sur toutes les tables (multi-tenancy)
- `client_id` sur contacts, projects, tasks
- `project_id` sur tasks
- `column_id` sur tasks
- Indexes composites pour les requêtes fréquentes

---

## Guide d'utilisation

### Démarrage rapide

1. **Authentification** : Le système utilise actuellement un header `x-user-id` (développement)
2. **Tableau de bord** : Vue d'ensemble de votre activité
3. **Créer un client** : CRM → Nouveau client
4. **Créer un projet** : Projets → Nouveau projet (lier à un client)
5. **Ajouter des tâches** : Dans un projet ou via Tâches
6. **Personnaliser les onglets** : Client detail → Onglets custom

### Workflow typique

**Gestion d'un nouveau client**
1. Créer le client dans CRM (type, statut, budget)
2. Ajouter des contacts associés
3. Créer des onglets personnalisés si besoin (ex: "Documents légaux")
4. Ajouter des champs custom (ex: "Numéro SIRET", "Date de signature")
5. Créer un projet lié au client
6. Ajouter des tâches au projet

**Gestion des tâches**
1. Créer une tâche (via projet ou module Tâches)
2. Cliquer sur la tâche pour ouvrir le popup de détail
3. Éditer les paramètres :
   - Titre et description
   - Priorité (Basse/Moyenne/Haute)
   - Assignation
   - Date d'échéance
   - Effort (1-5 étoiles)
   - Statut (colonne Kanban)
4. Les modifications sont automatiquement sauvegardées (500ms après arrêt de frappe)
5. Fermer le popup quand terminé

**Organisation des tâches**
1. Vue Liste : filtrage et tri avancés
2. Vue Kanban : drag & drop entre colonnes
3. Personnaliser les colonnes (noms, couleurs)
4. Suivre la progression via les barres de progression

### Fonctionnalités clés

**Champs personnalisés**
- Créez des onglets custom pour vos clients
- Ajoutez des champs spécifiques à votre business
- Types disponibles : texte, date, nombre, lien, case à cocher, sélection multiple
- Suppression avec confirmation (prévient perte de données)

**Autosave intelligent**
- Édition de tâches : sauvegarde auto après 500ms d'inactivité
- Pas de bouton "Enregistrer" nécessaire
- Indicateur visuel : "Les changements sont automatiquement sauvegardés"

**Système de progression**
- Barres de progression basées sur les tâches terminées
- Pourcentage d'avancement affiché
- Compteurs de tâches par statut

**Suppression sécurisée**
- AlertDialog de confirmation pour toute suppression
- Messages clairs sur les conséquences
- Avertissement de perte de données pour les onglets custom

---

## Configuration et déploiement

### Variables d'environnement

```env
# Supabase
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...

# Session
SESSION_SECRET=random-secret-key

# PostgreSQL (détails)
PGHOST=...
PGPORT=5432
PGUSER=...
PGPASSWORD=...
PGDATABASE=...
```

### Installation

```bash
# Installation des dépendances
npm install

# Synchronisation du schéma de base de données
npm run db:push

# En cas de conflit, forcer la synchronisation
npm run db:push --force

# Démarrage en développement
npm run dev
```

### Migrations de base de données

**Important** : Ne jamais écrire de migrations SQL manuelles

```bash
# Après modification du schéma dans shared/schema.ts
npm run db:push

# Si avertissement de perte de données
npm run db:push --force
```

### Structure du projet

```
planbase/
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Composants réutilisables
│   │   ├── pages/       # Pages de l'application
│   │   ├── lib/         # Utilities et configuration
│   │   └── hooks/       # Custom React hooks
├── server/              # Backend Express
│   ├── routes.ts        # Routes API
│   ├── storage.ts       # Interface de stockage
│   └── index.ts         # Point d'entrée
├── shared/              # Code partagé
│   └── schema.ts        # Schéma Drizzle ORM
├── design_guidelines.md # Guidelines de design
└── replit.md           # Documentation du projet
```

### Workflows Replit

**Start application**
- Commande : `npm run dev`
- Lance le serveur Express (backend) sur le port 5000
- Lance le serveur Vite (frontend) avec HMR
- Les deux serveurs partagent le même port

### Tests et qualité

**ESLint et TypeScript**
- Vérification de type stricte activée
- Linting automatique
- Formatage avec Prettier (via EditorConfig)

---

## Évolutions futures prévues

### Authentification production
- JWT Supabase Auth complet
- Vérification de signature
- Gestion des sessions
- Rotation des refresh tokens

### Fonctionnalités AI
- Notes avec résumés automatiques (GPT-5)
- Transcription audio (Whisper)
- Recherche sémantique (pgvector)
- Extraction automatique d'actions

### Intégrations
- Gmail (synchronisation emails)
- Calendrier (Google Calendar, Outlook)
- Stripe (paiements)
- Zapier/Make (automatisations)

### Modules avancés
- Gestion de fichiers avec versioning
- Produits et roadmap
- Pipeline de deals
- Reporting et analytics
- Export de données

---

## Support et contribution

### Conventions de code

**TypeScript**
- Types stricts partout
- Interfaces pour les objets complexes
- Types inférés de Drizzle pour les entités DB

**React**
- Hooks pour la logique
- Composants fonctionnels uniquement
- TanStack Query pour le state serveur
- Props typées

**CSS/Tailwind**
- Utiliser les classes utilitaires Tailwind
- Composants Shadcn/ui pour l'UI
- Variables CSS pour les couleurs (mode sombre)
- Responsive mobile-first

### Git workflow

```bash
# Créer une branche pour une feature
git checkout -b feature/nom-feature

# Commit réguliers avec messages clairs
git commit -m "feat: ajout de [fonctionnalité]"

# Push vers GitHub
git push origin feature/nom-feature
```

### Bonnes pratiques

1. **Toujours tester** avant de commiter
2. **Ne jamais commiter de secrets** dans le code
3. **Documenter** les changements importants
4. **Suivre les conventions** de nommage
5. **Utiliser les AlertDialog** pour les actions destructives
6. **Implémenter l'autosave** pour les formulaires complexes
7. **Ajouter des data-testid** pour les tests E2E

---

## Changelog

### Version actuelle (MVP)

**Fonctionnalités principales**
- ✅ Dashboard avec KPI
- ✅ CRM complet (clients, contacts)
- ✅ Onglets et champs personnalisés
- ✅ Gestion de projets
- ✅ Gestion de tâches avec Kanban
- ✅ Colonnes personnalisables
- ✅ Édition de tâches en popup avec autosave
- ✅ Système de notes d'effort (1-5 étoiles)
- ✅ Multi-tenancy avec RLS
- ✅ Activités et historique

**Améliorations récentes**
- Système OKR complet avec objectifs, key results et liens vers entités
- Vue hiérarchique OKR avec tâches liées affichées horizontalement
- Intégration TaskDetailModal dans les vues OKR pour édition complète
- Fond blanc pour les tâches liées (bg-white dark:bg-gray-900)
- Correction du calcul du KPI "Opportunités" (exclusion won/lost)
- Vue Liste par défaut pour les tâches de projet
- Accordion pour les catégories de tâches avec collapse/expand
- AlertDialog pour toutes les suppressions
- Popup de détail de tâche avec édition complète
- Autosave débounced (500ms) pour l'édition de tâches
- Réduction des tailles de police (text-sm, text-xs, text-[11px])
- Routes API corrigées : `/api/clients/:clientId/field-values`

**À venir**
- Notes avec AI
- Fichiers avec versioning
- Gmail integration
- Produits et roadmap
- Authentification production complète

---

## License

Propriétaire - Tous droits réservés

---

**Date de dernière mise à jour** : 18 janvier 2026
**Version** : 1.1.0
