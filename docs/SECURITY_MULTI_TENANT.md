# 🔐 Sécurité Multi-Tenant - Isolation des Données

## Architecture Multi-Tenant

Planbase utilise une architecture **multi-tenant** où chaque compte (`account`) est **complètement isolé** des autres comptes. Cette isolation est garantie à plusieurs niveaux :

### 1. **Niveau Base de Données : Row Level Security (RLS)**

#### Politiques RLS Supabase

Toutes les tables qui contiennent `account_id` **DOIVENT** avoir des politiques RLS activées pour garantir l'isolation :

```sql
-- ============================================
-- ACTIVATION DE RLS SUR TOUTES LES TABLES
-- ============================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLITIQUES RLS - COMPTES (accounts)
-- ============================================

-- Les utilisateurs peuvent voir leur propre compte
CREATE POLICY "Users can view own account" 
ON accounts FOR SELECT 
USING (id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

-- Les propriétaires peuvent modifier leur compte
CREATE POLICY "Owners can update own account" 
ON accounts FOR UPDATE 
USING (
  id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' = 'owner'
);

-- ============================================
-- POLITIQUES RLS - UTILISATEURS (app_users)
-- ============================================

-- Les utilisateurs peuvent voir les autres utilisateurs de leur compte
CREATE POLICY "Users can view users from same account" 
ON app_users FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

-- Les propriétaires peuvent inviter des utilisateurs
CREATE POLICY "Owners can create users" 
ON app_users FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' = 'owner'
);

-- Les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Users can update own profile" 
ON app_users FOR UPDATE 
USING (id = auth.uid());

-- ============================================
-- POLITIQUES RLS - CLIENTS
-- ============================================

-- Lecture : Tous les utilisateurs du compte peuvent voir les clients
CREATE POLICY "Users can view clients from same account" 
ON clients FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

-- Création : Owner et Collaborator peuvent créer des clients
CREATE POLICY "Owner and Collaborator can create clients" 
ON clients FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- Modification : Owner et Collaborator peuvent modifier les clients
CREATE POLICY "Owner and Collaborator can update clients" 
ON clients FOR UPDATE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- Suppression : Owner et Collaborator peuvent supprimer les clients
CREATE POLICY "Owner and Collaborator can delete clients" 
ON clients FOR DELETE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- ============================================
-- POLITIQUES RLS - PROJETS
-- ============================================

CREATE POLICY "Users can view projects from same account" 
ON projects FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

CREATE POLICY "Owner and Collaborator can create projects" 
ON projects FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can update projects" 
ON projects FOR UPDATE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can delete projects" 
ON projects FOR DELETE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- ============================================
-- POLITIQUES RLS - TÂCHES
-- ============================================

CREATE POLICY "Users can view tasks from same account" 
ON tasks FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

CREATE POLICY "Owner and Collaborator can create tasks" 
ON tasks FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can update tasks" 
ON tasks FOR UPDATE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can delete tasks" 
ON tasks FOR DELETE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- ============================================
-- POLITIQUES RLS - NOTES
-- ============================================

CREATE POLICY "Users can view notes from same account" 
ON notes FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

CREATE POLICY "Owner and Collaborator can create notes" 
ON notes FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can update notes" 
ON notes FOR UPDATE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can delete notes" 
ON notes FOR DELETE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

-- ============================================
-- POLITIQUES RLS - DOCUMENTS
-- ============================================

CREATE POLICY "Users can view documents from same account" 
ON documents FOR SELECT 
USING (account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id');

CREATE POLICY "Owner and Collaborator can create documents" 
ON documents FOR INSERT 
WITH CHECK (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can update documents" 
ON documents FOR UPDATE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);

CREATE POLICY "Owner and Collaborator can delete documents" 
ON documents FOR DELETE 
USING (
  account_id = (auth.jwt() ->> 'user_metadata')::json ->> 'account_id'
  AND (auth.jwt() ->> 'user_metadata')::json ->> 'role' IN ('owner', 'collaborator')
);
```

**⚠️ IMPORTANT :** Ces politiques doivent être appliquées sur **TOUTES** les tables avec `account_id`. Adaptez le pattern ci-dessus pour chaque table restante (contacts, activities, deals, etc.).

### 2. **Niveau Middleware Backend : requireAuth**

Toutes les routes protégées utilisent le middleware `requireAuth` qui :

1. **Valide le JWT Supabase** pour authentifier l'utilisateur
2. **Extrait `account_id`** depuis `user_metadata` du JWT
3. **Attache `req.accountId`** à la requête pour filtrage ultérieur
4. **Vérifie l'existence** du compte et de l'utilisateur dans la base

```typescript
// server/middleware/auth.ts
export const requireAuth = async (req, res, next) => {
  // Validation JWT Supabase
  const token = req.headers.authorization?.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Extraction account_id depuis user_metadata
  req.accountId = user.user_metadata?.account_id;
  req.userId = user.id;
  req.userRole = user.user_metadata?.role;
  
  next();
};
```

### 3. **Niveau Routes : Filtrage Systématique**

**RÈGLE D'OR :** Toutes les requêtes qui lisent/écrivent des données **DOIVENT** filtrer par `req.accountId`.

#### ✅ Exemples de routes sécurisées :

```typescript
// GET /api/clients - Liste des clients du compte authentifié
app.get("/api/clients", requireAuth, async (req, res) => {
  const clients = await storage.getClientsByAccountId(req.accountId!);
  res.json(clients);
});

// GET /api/projects/:id - Détail d'un projet
app.get("/api/projects/:id", requireAuth, async (req, res) => {
  const project = await storage.getProject(req.params.id);
  
  // Vérification d'appartenance au compte
  if (!project || project.accountId !== req.accountId) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  res.json(project);
});

// POST /api/tasks - Créer une tâche
app.post("/api/tasks", requireAuth, async (req, res) => {
  const data = insertTaskSchema.parse(req.body);
  
  // Force account_id du compte authentifié
  const task = await storage.createTask({
    ...data,
    accountId: req.accountId!, // ⚠️ CRITIQUE : Toujours forcer l'accountId
    createdBy: req.userId!,
  });
  
  res.json(task);
});
```

#### ❌ Exemple de route DANGEREUSE (à ne JAMAIS faire) :

```typescript
// DANGER : Accepte n'importe quel accountId du body
app.post("/api/tasks", requireAuth, async (req, res) => {
  const data = insertTaskSchema.parse(req.body);
  
  // ❌ FAILLE : L'utilisateur peut injecter n'importe quel accountId
  const task = await storage.createTask(data);
  
  res.json(task);
});
```

### 4. **Niveau Storage Layer : Double Vérification**

Les fonctions du storage layer vérifient également l'`accountId` :

```typescript
// server/storage.ts
async getClient(accountId: string, id: string): Promise<Client | undefined> {
  const results = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.id, id),
      eq(clients.accountId, accountId) // ✅ Filtrage par accountId
    ));
  
  return results[0];
}
```

## Flux d'Inscription Multi-Compte

### 1. **Création de Compte via /api/auth/signup**

```
Utilisateur remplit formulaire
        ↓
POST /api/auth/signup
        ↓
1. Créer Account dans DB (plan: "starter")
        ↓
2. Créer utilisateur Supabase Auth
   - user_metadata.account_id = Account.id
   - user_metadata.role = "owner"
        ↓
3. Créer app_user dans DB
   - id = Supabase Auth User ID
   - accountId = Account.id
   - role = "owner"
        ↓
4. Connecter automatiquement l'utilisateur
        ↓
5. Rediriger vers /
```

### 2. **Authentification JWT**

Chaque requête authentifiée contient :

```json
{
  "sub": "user-uuid",
  "user_metadata": {
    "account_id": "account-uuid",
    "firstName": "Jean",
    "lastName": "Dupont",
    "role": "owner"
  }
}
```

## Checklist de Sécurité

### ✅ Avant de déployer en production :

- [ ] **RLS activé** sur toutes les tables avec `account_id`
- [ ] **Politiques RLS** créées pour SELECT, INSERT, UPDATE, DELETE
- [ ] **Toutes les routes** utilisent `requireAuth` middleware
- [ ] **Filtrage par `req.accountId`** sur toutes les routes de lecture
- [ ] **Force `accountId` du JWT** sur toutes les routes de création/modification
- [ ] **Tests d'isolation** entre comptes (voir section suivante)
- [ ] **Audit des logs** : aucune fuite de données entre comptes

### ✅ Tests d'Isolation à Effectuer :

1. **Créer 2 comptes de test** (Compte A et Compte B)
2. **Créer des données dans Compte A** (clients, projets, tâches)
3. **Se connecter avec Compte B**
4. **Vérifier** :
   - Aucun client de A visible dans B
   - Aucun projet de A visible dans B
   - Aucune tâche de A visible dans B
   - Impossible de modifier/supprimer des données de A depuis B
   - Recherche sémantique ne retourne pas de résultats de A
   - API `/api/clients/:id` retourne 404 pour un ID de A

## Rôles et Permissions

### Rôles disponibles :

- **`owner`** : Propriétaire du compte (créé à l'inscription)
  - Accès complet : CRUD sur toutes les données
  - Gestion des utilisateurs (invitations, rôles)
  - Modification des paramètres du compte
  
- **`collaborator`** : Collaborateur
  - CRUD sur clients, projets, tâches, notes, documents
  - Lecture seule sur les paramètres du compte
  
- **`client_viewer`** : Client externe (vue limitée)
  - Lecture seule sur les projets/documents partagés
  - Pas d'accès aux autres clients ou données internes

### Middleware de vérification de rôle :

```typescript
// server/middleware/auth.ts
export const requireRole = (...allowedRoles: string[]) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
};
```

## Recommandations Production

1. **Activer RLS sur Supabase** : Toutes les politiques doivent être en place
2. **Logs d'audit** : Logger toutes les opérations sensibles (création compte, modification rôles)
3. **Rate limiting** : Limiter les tentatives d'inscription/connexion
4. **Monitoring** : Alertes en cas de tentative d'accès cross-account
5. **Tests réguliers** : Scripts automatisés pour tester l'isolation

## Contact Sécurité

En cas de découverte de faille de sécurité concernant l'isolation multi-tenant, contactez immédiatement l'équipe de développement.
