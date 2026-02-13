# Configuration de l'Export PDF

## 📋 Vue d'ensemble

La fonctionnalité d'export PDF permet de générer des fichiers PDF depuis les documents existants tout en préservant la mise en page. **Les PDFs sont générés à la volée et streamés directement au client de manière sécurisée**, sans être stockés dans un bucket public.

## ✅ Architecture Sécurisée

### Streaming Direct vs Stockage Public

Pour des raisons de **sécurité et confidentialité**, l'export PDF fonctionne de la manière suivante :

1. ✅ **Génération à la demande** : Le PDF est généré uniquement quand l'utilisateur clique sur "Exporter"
2. ✅ **Streaming sécurisé** : Le PDF est envoyé directement au navigateur via une connexion authentifiée
3. ✅ **Pas de stockage public** : Les PDFs ne sont **jamais** stockés dans un bucket accessible publiquement
4. ✅ **Contrôle d'accès** : Seuls les utilisateurs autorisés (owner/collaborator du compte) peuvent exporter

### Pourquoi ne pas utiliser Supabase Storage ?

❌ **Stockage public** = Risque de fuite de données sensibles (NDAs, contrats)
✅ **Streaming direct** = Sécurité maximale pour vos documents confidentiels

### Prérequis

**Aucun bucket Supabase n'est nécessaire !** L'export PDF fonctionne immédiatement sans configuration supplémentaire.

## 🚀 Utilisation

### Export d'un document en PDF

1. Ouvrez un document dans l'interface
2. Cliquez sur le bouton **Download** (icône bleue) dans la barre d'outils
3. Le système va :
   - Convertir le contenu TipTap en HTML sécurisé (avec sanitization anti-XSS)
   - Générer un PDF avec Puppeteer (Chromium)
   - Streamer le PDF directement vers votre navigateur
   - Déclencher le téléchargement automatique

### Caractéristiques du PDF généré

- **Format** : A4
- **Marges** : 20mm (haut/bas), 15mm (gauche/droite)
- **Typographie** :
  - Titres : Poppins (police Buddy Design System)
  - Corps : Inter (12px)
- **Couleurs** :
  - Titres H1 : violet primaire (#7C3AED)
  - Liens : violet primaire
  - Code : fond gris clair
- **Support complet** :
  - Texte riche (gras, italique, souligné, barré)
  - Listes à puces et numérotées
  - Listes de tâches avec cases à cocher
  - Blocs de code avec coloration
  - Citations
  - Tableaux
  - Images (avec redimensionnement automatique)
  - Alignement de texte

## 🗂️ Stockage des PDFs

Les PDFs ne sont **pas stockés** de manière permanente. Ils sont :
- Générés à la demande quand l'utilisateur clique sur "Exporter"
- Streamés directement au navigateur
- Téléchargés immédiatement sur l'ordinateur de l'utilisateur
- Supprimés de la mémoire serveur après l'envoi

Cette approche garantit :
- ✅ **Aucune trace des PDFs** sur les serveurs après téléchargement
- ✅ **Pas de coûts de stockage** pour les PDFs générés
- ✅ **Sécurité maximale** : pas de fichiers accessibles publiquement

## 🔧 Détails techniques

### Base de données

Deux nouveaux champs ont été ajoutés à la table `documents` :

- `source_type` : `TEXT NOT NULL DEFAULT 'template'`
  - Valeurs possibles : `'template'`, `'freeform'`, `'pdf_import'`
  - Indique l'origine du document
  - **Note** : Actuellement utilisé uniquement pour l'import futur de PDFs
- `pdf_storage_path` : `TEXT NULL`
  - **Réservé pour l'import futur** : stockera le chemin des PDFs importés
  - **Non utilisé pour l'export** : les PDFs exportés ne sont pas stockés

### API Endpoint

**POST** `/api/documents/:id/export-pdf`

**Comportement** :
- Génère le PDF à la volée
- Streams le PDF directement au client
- Headers de réponse :
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Document_Name.pdf"`
  - `Content-Length: {size}`

**Réponse** : Fichier binaire PDF (pas de JSON)

## ⚙️ Configuration de Production

### Puppeteer et Chromium

L'export PDF utilise **Puppeteer** pour générer les PDFs. En production, assurez-vous que :

#### Option 1 : Chromium Bundlé (Recommandé)
Par défaut, Puppeteer utilise son propre Chromium bundlé. **Aucune configuration supplémentaire n'est requise** dans la plupart des environnements cloud modernes.

#### Option 2 : Chromium Personnalisé
Si vous devez spécifier un chemin Chromium personnalisé (environnements restreints comme Replit), configurez la variable d'environnement :

```bash
PUPPETEER_EXECUTABLE_PATH=/path/to/chromium
```

### Variables d'Environnement

| Variable | Requis | Description | Exemple |
|----------|--------|-------------|---------|
| `PUPPETEER_EXECUTABLE_PATH` | Non | Chemin vers l'exécutable Chromium personnalisé | `/nix/store/.../chromium` (Replit) |
| `NODE_ENV` | Oui | Environnement d'exécution | `production` ou `development` |

### Debugging en Production

En cas d'erreur 500 lors de l'export PDF, vérifiez les logs serveur pour :

1. **Message d'erreur Puppeteer** : Affichera si Chromium ne peut pas être lancé
2. **Chemin Chromium** : Le log `🚀 Using...` indiquera le chemin utilisé
3. **Stack trace complète** : Disponible en mode development uniquement

**Logs typiques** :
```
📄 Starting PDF export for document: abc-123 Mon Document
🚀 Using Puppeteer bundled Chromium
📄 HTML content length: 1234
📄 Generating PDF with Puppeteer...
✅ PDF generated, buffer size: 56789 bytes
✅ PDF export successful, sending to client
```

### Dépannage Courant

| Erreur | Cause Probable | Solution |
|--------|---------------|----------|
| `Failed to launch chrome` | Chromium manquant ou incompatible | Installer Chromium ou configurer `PUPPETEER_EXECUTABLE_PATH` |
| `Timeout waiting for page` | Mémoire insuffisante | Augmenter la RAM disponible |
| `ECONNREFUSED` | Problème réseau interne | Vérifier les args Puppeteer (`--no-sandbox`) |

## 🔒 Sécurité Renforcée

### Protection Anti-SSRF Complète

**Mesures en place** :
✅ **Blocage de toutes les ressources externes** : Puppeteer bloque tous les téléchargements de ressources externes (images, fonts, CSS externes)
✅ **Seuls les data URIs sont autorisés** : Les images embarquées en base64 fonctionnent normalement
✅ **Sanitization HTML complète** : Tous les textes, URLs et attributs sont échappés/validés
✅ **Métadonnées sécurisées** : Nom du document et tous les champs sanitisés
✅ **Streaming direct** : Pas de stockage public, transmission HTTPS sécurisée

**Implications** :
- ❌ Les images hébergées sur des URLs externes (http://example.com/image.jpg) ne s'afficheront **pas** dans le PDF
- ✅ Les images embarquées en data URI (base64) fonctionnent parfaitement
- ✅ Protection maximale contre les attaques SSRF et XSS

## 🎯 Prochaines étapes (fonctionnalités futures)

### Sécurité
- Élimination complète du risque SSRF (résolution DNS ou blocage d'images)
- Authentification renforcée en développement

### Fonctionnalités
- Import de PDFs existants (type `pdf_import`)
- Visualisation de PDFs importés dans l'interface
- Historique de versions PDF
- Watermark personnalisable
- Templates de mise en page PDF personnalisés

## 🐛 Dépannage

### Puppeteer ne démarre pas
**Erreur** : `Failed to launch the browser process`

**Solution** : Les dépendances système de Chromium sont déjà installées. Si l'erreur persiste, redémarrez le workflow.

### Timeout lors de la génération
**Erreur** : `Navigation timeout of 30000 ms exceeded`

**Solution** : Le document contient probablement des images externes qui ne se chargent pas. Vérifiez les URLs des images dans le contenu.

### PDF vide ou mal formaté
**Problème** : Le PDF généré est vide ou le formatage est incorrect

**Solution** : Vérifiez que le contenu du document est au format TipTap JSON valide. Si le contenu ne peut pas être parsé, un message d'erreur sera affiché dans le PDF.

### Le téléchargement ne démarre pas
**Problème** : Rien ne se passe quand je clique sur le bouton d'export

**Solution** :
1. Vérifiez la console du navigateur pour des erreurs JavaScript
2. Assurez-vous que les popups ne sont pas bloquées
3. Vérifiez que votre navigateur autorise les téléchargements automatiques
