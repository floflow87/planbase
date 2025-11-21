# 🚨 CRITICAL SECURITY TODO - À FAIRE AVANT LA PRODUCTION

## État actuel de la sécurité multi-tenant

### ⚠️ AVERTISSEMENT CRITIQUE

Le système multi-compte est **PARTIELLEMENT IMPLÉMENTÉ**. Plusieurs mesures de sécurité critiques doivent être appliquées **MANUELLEMENT** avant toute mise en production.

---

## 🔴 Actions obligatoires avant production

### 1. Appliquer les politiques RLS dans Supabase (CRITIQUE)

**Status:** ❌ NON FAIT - Les politiques SQL sont documentées mais **PAS APPLIQUÉES**

**Action requise:**
1. Se connecter au dashboard Supabase (projet: `gfftezyrhsxtaeceuszd`)
2. Aller dans SQL Editor
3. Copier-coller et exécuter **TOUS** les scripts SQL de `SECURITY_MULTI_TENANT.md`
4. Vérifier que les politiques RLS sont actives avec :
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'projects', 'notes', 'files', 'tasks', 'emails');
```

**Pourquoi c'est critique:**
Sans RLS, n'importe quel utilisateur authentifié peut accéder aux données d'autres comptes en modifiant les requêtes SQL directes. RLS fournit une **couche de sécurité au niveau de la base de données** indépendante du code applicatif.

---

### 2. Désactiver le mode développement en production

**Status:** ⚠️ DANGEREUX - Le middleware auth a un fallback développement

**Problème actuel:**
```typescript
// server/middleware/auth.ts (lignes 32-66)
if (process.env.NODE_ENV === 'development') {
  // Utilise un compte par défaut DEV_ACCOUNT_ID
  // Permet l'accès sans JWT valide
}
```

**Action requise:**
Vérifier que `NODE_ENV=production` est bien défini dans l'environnement de production (Render, Vercel, etc.)

**Test de vérification:**
```bash
# Dans l'environnement de production
echo $NODE_ENV  # Doit afficher "production"
```

---

### 3. Vérifier le filtrage par accountId dans TOUTES les routes

**Status:** ⚠️ PARTIEL - Certaines routes ne filtrent peut-être pas correctement

**Routes critiques à vérifier:**

| Route | Filtre accountId | Status |
|-------|------------------|--------|
| `/api/clients` | ✅ `storage.getClientsByAccountId(req.accountId)` | OK |
| `/api/projects` | ✅ `storage.getProjectsByAccountId(req.accountId)` | OK |
| `/api/notes` | ✅ `storage.getNotesByAccountId(req.accountId)` | OK |
| `/api/files` | ✅ `storage.getFilesByAccountId(req.accountId)` | OK |
| `/api/tasks` | ✅ `storage.getTasksByAccountId(req.accountId)` | OK |
| `/api/products` | ⚠️ À VÉRIFIER | ? |
| `/api/features` | ⚠️ À VÉRIFIER | ? |
| `/api/roadmaps` | ⚠️ À VÉRIFIER | ? |

**Action requise:**
Auditer **chaque route** dans `server/routes.ts` et s'assurer que:
1. Elle utilise `requireAuth` middleware
2. Elle filtre par `req.accountId` dans la requête de données
3. Elle vérifie l'appartenance avant toute modification/suppression

**Exemple de pattern sécurisé:**
```typescript
app.get("/api/clients", requireAuth, async (req, res) => {
  // ✅ BON: Filtre par accountId
  const clients = await storage.getClientsByAccountId(req.accountId!);
  res.json(clients);
});

app.delete("/api/clients/:id", requireAuth, async (req, res) => {
  const client = await storage.getClient(req.params.id);
  
  // ✅ BON: Vérifie l'appartenance avant suppression
  if (!client || client.accountId !== req.accountId) {
    return res.status(404).json({ error: "Client not found" });
  }
  
  await storage.deleteClient(req.params.id);
  res.json({ success: true });
});
```

**Exemple de pattern DANGEREUX:**
```typescript
app.get("/api/clients", requireAuth, async (req, res) => {
  // ❌ DANGEREUX: Récupère TOUS les clients de TOUS les comptes
  const allClients = await db.select().from(clients);
  res.json(allClients);
});
```

---

### 4. Améliorer le rollback du signup

**Status:** ⚠️ PARTIEL - Rollback implémenté mais peut laisser des données orphelines

**Problème actuel:**
Si l'inscription échoue après la création du compte Supabase mais avant la fin du processus, des données peuvent rester orphelines.

**Action requise:**
Implémenter une transaction complète ou améliorer le mécanisme de rollback dans `POST /api/auth/signup`.

**Solution recommandée:**
```typescript
// Utiliser un wrapper de transaction
try {
  // Créer account
  const account = await storage.createAccount(...);
  
  try {
    // Créer Supabase user
    const authData = await supabaseAdmin.auth.admin.createUser(...);
    
    try {
      // Créer app_user
      const appUser = await storage.createUser(...);
      
      // Succès complet
      return res.status(201).json({ ... });
      
    } catch (appUserError) {
      // Rollback: Supprimer Supabase user + account
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await db.delete(accounts).where(eq(accounts.id, account.id));
      throw appUserError;
    }
  } catch (authError) {
    // Rollback: Supprimer account uniquement
    await db.delete(accounts).where(eq(accounts.id, account.id));
    throw authError;
  }
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

---

## 🧪 Tests de sécurité recommandés

### Test 1: Isolation des données
1. Créer 2 comptes (Account A et Account B)
2. Créer un client dans Account A
3. Se connecter avec un utilisateur de Account B
4. Essayer d'accéder au client de Account A via `/api/clients/:id`
5. **Résultat attendu:** 404 ou erreur d'autorisation

### Test 2: Validation JWT
1. Se connecter normalement et récupérer le JWT
2. Modifier manuellement le `account_id` dans le JWT (décodage Base64)
3. Faire une requête avec le JWT modifié
4. **Résultat attendu:** 401 Unauthorized (JWT signature invalide)

### Test 3: RLS Supabase
1. Se connecter au compte A
2. Utiliser le SQL Editor Supabase pour faire:
```sql
SELECT * FROM clients WHERE account_id = '<account_b_id>';
```
3. **Résultat attendu:** Aucun résultat (RLS bloque l'accès)

---

## 📋 Checklist avant production

- [ ] Politiques RLS appliquées dans Supabase pour **toutes** les tables
- [ ] `NODE_ENV=production` défini dans l'environnement
- [ ] Audit complet de toutes les routes avec filtrage `req.accountId`
- [ ] Rollback du signup testé et robuste
- [ ] Tests de sécurité multi-tenant effectués
- [ ] Documentation de sécurité partagée avec l'équipe
- [ ] Plan de réponse aux incidents défini
- [ ] Logs de sécurité configurés et surveillés

---

## 🔗 Ressources

- Documentation complète: `SECURITY_MULTI_TENANT.md`
- Middleware auth: `server/middleware/auth.ts`
- Routes backend: `server/routes.ts`
- Schéma Supabase: `supabase-schema.sql`

---

**Date de création:** 2025-01-21  
**Dernière mise à jour:** 2025-01-21  
**Priorité:** 🔴 CRITIQUE - À traiter avant production
