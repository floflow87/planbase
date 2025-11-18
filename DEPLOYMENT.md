# Guide de Déploiement Planbase

## 🚨 Configuration Base de Données Production

### ⚠️ IMPORTANT : Utiliser UNIQUEMENT Supabase

Cette application est configurée pour utiliser **Supabase PostgreSQL** (projet: `gfftezyrhsxtaeceuszd`, région: `eu-north-1`).

**NE PAS utiliser Neon ou toute autre base de données.**

### Configuration Requise

Pour garantir que la production utilise Supabase :

1. **Variables d'environnement de production** (obligatoires) :
   ```
   SUPABASE_URL=https://gfftezyrhsxtaeceuszd.supabase.co
   SUPABASE_DB_PASSWORD=[votre mot de passe DB Supabase]
   SUPABASE_SERVICE_ROLE_KEY=[votre clé service role]
   SUPABASE_ANON_KEY=[votre clé anon]
   ```

2. **NE PAS utiliser** :
   - ❌ Le module `postgresql-16` dans `.replit` (qui activerait Neon)
   - ❌ La variable `DATABASE_URL` auto-générée par Replit

3. **Le fichier `server/db.ts`** est déjà configuré pour :
   - Se connecter à Supabase via `SUPABASE_URL` et `SUPABASE_DB_PASSWORD`
   - Utiliser le pooler Transaction (port 6543) pour la compatibilité IPv4
   - Région: `eu-north-1` (Stockholm)

### Vérification

Pour vérifier que vous utilisez Supabase :
```bash
# Le log au démarrage doit afficher :
🔗 Connecting to Supabase (project: gfftezyrhsxtaeceuszd, region: eu-north-1, pooler: Transaction)
```

---

## 🏢 Multi-Tenancy : Partage des Données Dev/Production

### Problème Courant

**Symptôme** : En production, vous ne voyez pas vos données de développement, uniquement les nouvelles données créées.

**Cause** : L'application utilise un système multi-tenant où chaque compte (`account_id`) a ses propres données isolées.

- En **développement** : Utilise l'account_id par défaut `b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4`
- En **production** : Crée automatiquement un nouveau compte lors de la première connexion

### Solution : Unifier les Comptes

Pour que dev et production partagent les mêmes données :

1. **Identifier votre email de production** (celui utilisé pour se connecter)

2. **Exécuter le script de configuration** :
   ```bash
   npx tsx scripts/fix-production-account-id.ts <votre-email>
   ```
   
   Exemple :
   ```bash
   npx tsx scripts/fix-production-account-id.ts floflow87@planbase.io
   ```

3. **Se déconnecter puis se reconnecter en production**

4. ✅ Toutes vos données dev sont maintenant visibles en production !

### Comment ça marche

Le script met à jour les métadonnées Supabase de votre utilisateur pour utiliser le même `account_id` que dev :

```javascript
user_metadata: {
  account_id: "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4", // ← Account ID de dev
  role: "owner"
}
```

### Vérification

Après reconnexion, vérifiez dans les logs de production :

```bash
✅ Using account: b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4
```

---

## 🔄 Keep-Alive : Maintenir l'Application Active

### Problème
Les déploiements Replit Autoscale peuvent s'endormir après 15 minutes d'inactivité.

### Solution 1 : Monitoring Externe (Recommandé pour Autoscale)

L'application expose deux endpoints de health check :

- **`/healthz`** : Endpoint détaillé avec statut et métrics
  ```json
  {
    "status": "ok",
    "timestamp": "2025-11-18T09:35:15.427Z",
    "service": "planbase",
    "uptime": 24.388573241
  }
  ```

- **`/ping`** : Endpoint minimal
  ```json
  {
    "status": "ok"
  }
  ```

#### Configuration UptimeRobot (Gratuit)

1. Créer un compte sur [uptimerobot.com](https://uptimerobot.com)
2. Ajouter un nouveau monitor :
   - **Type** : HTTP(s)
   - **URL** : `https://[votre-app].replit.app/ping`
   - **Interval** : 5 minutes (le minimum en version gratuite)
   - **Nom** : Planbase Keep-Alive
3. Sauvegarder

**Avantages** :
- ✅ Gratuit (jusqu'à 50 monitors)
- ✅ Interface web simple
- ✅ Notifications en cas de downtime
- ✅ Statistiques d'uptime

#### Alternatives

1. **Cron-job.org** (gratuit, ping toutes les 5 min)
2. **BetterUptime** (gratuit, monitoring avancé)
3. **Pingdom** (version d'essai gratuite)
4. **Script Cron sur VPS** :
   ```bash
   # Ajouter au crontab : */12 * * * * (toutes les 12 minutes)
   */12 * * * * curl -s https://[votre-app].replit.app/ping > /dev/null
   ```

### Solution 2 : Reserved VM Deployment (Recommandé pour Production)

Pour une application qui doit être **toujours active** sans ping externe :

1. Dans votre workspace Replit, cliquer sur **Publish**
2. Choisir **Reserved VM** au lieu de **Autoscale**
3. Configurer les ressources (CPU/RAM)
4. Publier

**Avantages** :
- ✅ Toujours actif (pas de sleep)
- ✅ Performance constante
- ✅ VM dédiée
- ✅ Idéal pour production

**Inconvénient** :
- 💰 Coût mensuel (selon les ressources)

### Recommandation

**Pour le développement/staging** : Autoscale + UptimeRobot (gratuit)

**Pour la production** : Reserved VM Deployment

---

## 📋 Checklist de Déploiement

Avant de publier en production :

- [ ] Vérifier que `SUPABASE_URL` et `SUPABASE_DB_PASSWORD` sont configurés
- [ ] Vérifier que le module `postgresql-16` n'est PAS dans `.replit`
- [ ] Tester les endpoints `/healthz` et `/ping`
- [ ] Configurer UptimeRobot (Autoscale) ou Reserved VM
- [ ] Vérifier les logs au démarrage pour confirmer la connexion Supabase
- [ ] Configurer `SESSION_SECRET`, `OPENAI_API_KEY`, et autres secrets
- [ ] Tester l'authentification en production
- [ ] Vérifier les CORS (domaines autorisés dans `server/index.ts`)

---

## 🔐 Secrets de Production

Secrets requis pour la production :

```
SUPABASE_URL
SUPABASE_DB_PASSWORD
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
VITE_SUPABASE_URL (frontend)
VITE_SUPABASE_ANON_KEY (frontend)
SESSION_SECRET
OPENAI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

**⚠️ Ne jamais commiter ces secrets dans Git !**
