# 🚀 Déploiement sur Render

## Configuration requise pour l'export PDF

L'export PDF utilise Puppeteer qui nécessite Chromium. Sur Render, Chromium est installé **automatiquement au premier démarrage** et mis en cache pour les démarrages suivants.

## ⚙️ Configuration étape par étape

### 1. Pousser les fichiers sur Git (via l'interface Replit)

Les fichiers `render-build.sh` et `render-start.sh` sont déjà créés et configurés. Sur Replit :

1. Ouvrez l'onglet **Git** (icône dans la barre latérale gauche)
2. Tous les fichiers modifiés apparaissent automatiquement
3. Replit committe et pousse automatiquement les changements vers votre repository

**Note** : Les scripts `.sh` sont automatiquement rendus exécutables lors du déploiement sur Render (via `chmod +x` dans le script de build).

### 2. Configuration Render

Dans votre **Dashboard Render** > **Settings** :

#### Build Command
```bash
./render-build.sh
```

#### Start Command
```bash
./render-start.sh
```

### 3. Comment ça fonctionne

**Build (`render-build.sh`)** :
- Installe les dépendances npm
- Build l'application (frontend + backend)
- **Ne télécharge PAS Chrome** (gagner du temps de build)

**Start (`render-start.sh`)** :
- Vérifie si Chrome est installé dans `~/.cache/puppeteer`
- Si absent : l'installe (seulement au premier démarrage, ~2-3 minutes)
- Si présent : utilise la version cachée (instantané)
- Démarre l'application

**Avantages de cette approche** :
- ✅ Chrome est installé dans `/opt/render/.cache/puppeteer` (persisté par Render)
- ✅ Pas de re-téléchargement à chaque build (~130MB économisés)
- ✅ Installation une seule fois, réutilisé ensuite
- ✅ Builds plus rapides

**Note** : Le premier démarrage prendra 2-3 minutes pour installer Chrome. Les démarrages suivants seront instantanés grâce au cache.

### 3. Variables d'environnement

Assurez-vous d'avoir toutes les variables d'environnement configurées dans Render :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Mode de production | `production` |
| `DATABASE_URL` | URL Supabase PostgreSQL | `postgresql://...` |
| `SUPABASE_URL` | URL de votre projet Supabase | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Clé publique Supabase | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase | `eyJhbG...` |
| `OPENAI_API_KEY` | Clé API OpenAI | `sk-...` |
| `SESSION_SECRET` | Secret pour les sessions | Générer avec `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | ID client Google OAuth | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Secret client Google OAuth | `GOCSPX-...` |

**⚠️ Ne pas définir** `PUPPETEER_EXECUTABLE_PATH` sur Render - laissez Puppeteer utiliser son Chromium installé par défaut.

## 🐛 Dépannage

### Premier démarrage très lent

**C'est normal !** Au premier démarrage, Chrome (~130MB) est téléchargé et installé. Cela prend 2-3 minutes.

**Logs attendus lors du premier start** :
```
🚀 Render Start Script for Puppeteer
📥 Chrome not found, checking Puppeteer cache...
📥 Installing Chrome for Puppeteer (first run only)...
✅ Chrome installed successfully
▶️  Starting application...
```

**Démarrages suivants** : Instantanés (Chrome est en cache).

### Erreur : "Could not find Chrome"

**Cause** : Chrome n'a pas pu s'installer au démarrage.

**Solution** :
1. Vérifiez les **logs runtime** (pas build) dans Render
2. Cherchez le message `📥 Installing Chrome for Puppeteer`
3. Si l'installation échoue, redéployez l'application
4. Si le problème persiste, effacez le cache :
   - Dashboard Render > **Settings** > **Build & Deploy**
   - **Clear build cache**
   - Redéployez

### Erreur de mémoire (Timeout)

Si Puppeteer timeout pendant l'export PDF :
- Augmentez la RAM : Dashboard Render > **Settings** > Instance Type
- Minimum recommandé : **512MB**

## 📝 Checklist de déploiement

- [ ] Scripts `render-build.sh` et `render-start.sh` ajoutés au repository
- [ ] Scripts rendus exécutables (`chmod +x`)
- [ ] Build Command configurée : `./render-build.sh`
- [ ] Start Command configurée : `./render-start.sh`
- [ ] Toutes les variables d'environnement configurées dans Render
- [ ] Premier démarrage : attendre 2-3 minutes (installation Chrome)
- [ ] Test d'export PDF depuis l'interface

## 🔍 Logs de diagnostic

### Logs au démarrage (premier run)
```
🚀 Render Start Script for Puppeteer
📥 Installing Chrome for Puppeteer (first run only)...
✅ Chrome installed successfully
▶️  Starting application...
```

### Logs lors de l'export PDF
```
📄 Starting PDF export for document: abc-123
🚀 Using Puppeteer bundled Chromium
📄 HTML content length: 3646
📄 Generating PDF with Puppeteer...
✅ PDF generated, buffer size: 56789 bytes
✅ PDF export successful, sending to client
```

Si vous voyez ces logs, l'export PDF fonctionne correctement ! 🎉
