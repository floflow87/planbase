# 🚀 Déploiement sur Render

## Configuration requise pour l'export PDF

L'export PDF utilise Puppeteer qui nécessite Chromium. Sur Render, vous devez installer Chromium pendant le build.

## ⚙️ Configuration étape par étape

### 1. Rendre le script de build exécutable (une seule fois)

**Avant de pousser sur Git**, exécutez localement :

```bash
chmod +x render-build.sh
git add render-build.sh .puppeteerrc.cjs .gitignore
git commit -m "Add Render build script for Puppeteer"
git push
```

### 2. Configuration Render

Dans votre **Dashboard Render** > **Settings** :

#### Build Command
Utilisez le script de build personnalisé :

```bash
./render-build.sh
```

#### Start Command
```bash
npm start
```

### 3. Comment ça fonctionne

Le script `render-build.sh` :

1. **Installe les dépendances** : `npm ci`
2. **Configure le cache Puppeteer** : Dans `.cache/puppeteer` (persiste entre les builds)
3. **Vérifie si Chrome est déjà installé** : Évite de télécharger à chaque build (~130MB)
4. **Installe Chrome si nécessaire** : `npx puppeteer browsers install chrome`
5. **Build l'application** : `npm run build`

Le fichier `.puppeteerrc.cjs` configure automatiquement Puppeteer pour utiliser le cache local.

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

### Erreur : "Could not find Chrome"

**Solution 1 : Vérifier le build**
1. Vérifiez que le script d'installation s'exécute dans les logs de build Render
2. Cherchez le message `✅ Chromium installed successfully`

**Solution 2 : Cache Render**
Si le problème persiste, effacez le cache de build sur Render :
1. Dashboard Render > **Settings** > **Build & Deploy**
2. Cliquez sur **Clear build cache**
3. Déclenchez un nouveau déploiement

**Solution 3 : Vérifier les logs**
Consultez les logs de déploiement pour voir si l'installation de Chromium s'est bien déroulée.

### Erreur de mémoire (Timeout)

Si Puppeteer timeout, augmentez la RAM :
1. Dashboard Render > **Settings**
2. Changez le **Instance Type** vers un plan avec plus de RAM (minimum 512MB recommandé)

## 📝 Checklist de déploiement

- [ ] Script de build modifié dans `package.json` pour installer Chromium
- [ ] Toutes les variables d'environnement configurées dans Render
- [ ] Build réussi avec le message "Chromium installed successfully" dans les logs
- [ ] L'application démarre sans erreur
- [ ] Test d'export PDF depuis l'interface

## 🔍 Logs de diagnostic

Une fois déployé, testez l'export PDF. Les logs serveur afficheront :

```
📄 Starting PDF export for document: abc-123
🚀 Using Puppeteer bundled Chromium
✅ PDF generated, buffer size: 56789 bytes
✅ PDF export successful, sending to client
```

Si vous voyez ces logs, l'export PDF fonctionne correctement ! 🎉
