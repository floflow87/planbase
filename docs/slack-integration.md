# Intégration Slack — Documentation PlanBase

## Disponibilité

> **Module réservé au plan Agence uniquement.**  
> L'intégration Slack et le moteur d'automatisation ne sont pas disponibles pour les plans Freelance ou Starter.  
> Le bouton "Automatisations" (éclair) reste visible mais affiche un message d'accès restreint pour les utilisateurs hors plan Agence.  
> L'onglet "Intégrations" des Paramètres affiche également le statut de connexion Slack, accessible en lecture seule sur les autres plans.

---

## Vue d'ensemble

L'intégration Slack de PlanBase permet à chaque organisation de connecter son propre espace de travail Slack. Une fois connectée, vous pouvez configurer des automatisations pour envoyer des notifications Slack automatiquement en fonction d'événements (création d'une tâche, changement de statut d'un deal, mise à jour d'une roadmap, etc.).

---

## Architecture technique

| Élément | Détail |
|---|---|
| **Type OAuth** | OAuth 2.0 (Slack Incoming Webhooks + Bot Token) |
| **Scopes demandés** | `channels:read`, `chat:write`, `incoming-webhook` |
| **Stockage du token** | Colonne JSONB `settings` de la table `accounts` (par organisation) |
| **Multi-tenant** | Chaque organisation stocke son propre token — aucun token partagé |
| **App Slack** | Une seule app Slack partagée (client ID/secret commun à tous les orgs) |

---

## Flux OAuth (étape par étape)

```
Utilisateur clique "Connecter Slack"
  → Frontend appelle GET /api/slack/oauth/start
  → Backend génère l'URL OAuth Slack avec state = accountId + timestamp
  → Redirect vers Slack (autorisation utilisateur)
  → Slack redirige vers GET /api/slack/oauth/callback?code=...&state=...
  → Backend échange le code contre un access_token via l'API Slack
  → Token stocké dans accounts.settings.slack{ token, teamId, teamName, channelId, webhookUrl }
  → Redirect vers /settings?tab=integrations&slack=success
```

---

## Variables d'environnement requises

| Variable | Description |
|---|---|
| `SLACK_CLIENT_ID` | ID client de l'app Slack (Replit Secret) |
| `SLACK_CLIENT_SECRET` | Secret client de l'app Slack (Replit Secret) |
| `SLACK_REDIRECT_DOMAIN` | Domaine de base pour le callback OAuth (ex: `https://app.planbase.io`) |

> **Attention :** `SLACK_REDIRECT_DOMAIN` ne doit pas avoir de barre oblique finale (`/`).  
> Correct : `https://app.planbase.io`  
> Incorrect : `https://app.planbase.io/`

L'URL de callback complète construite par le backend :  
`${SLACK_REDIRECT_DOMAIN}/api/slack/oauth/callback`

---

## Configuration dans la Slack App (api.slack.com)

1. Aller sur [api.slack.com/apps](https://api.slack.com/apps) → votre app
2. **OAuth & Permissions** → Redirect URLs → ajouter :
   - `https://app.planbase.io/api/slack/oauth/callback` (production)
   - `https://votre-replit-url.replit.dev/api/slack/oauth/callback` (développement)
3. **Bot Token Scopes** (minimum requis) :
   - `channels:read` — lister les channels disponibles
   - `chat:write` — envoyer des messages
   - `incoming-webhook` — webhook entrant
4. **Activer Incoming Webhooks** dans la section dédiée

---

## Routes serveur

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/slack/oauth/start` | Génère et renvoie l'URL d'autorisation Slack |
| `GET` | `/api/slack/oauth/callback` | Reçoit le code OAuth, échange contre un token, stocke en DB |
| `GET` | `/api/slack/status` | Retourne `{ connected, teamName, channelId }` pour l'org courante |
| `GET` | `/api/slack/channels` | Liste les channels du workspace connecté |
| `DELETE` | `/api/slack/disconnect` | Supprime le token Slack de l'org courante |

---

## Emplacement dans l'interface (Paramètres)

L'intégration Slack se gère dans **Paramètres → Intégrations**.  
L'onglet est accessible uniquement aux administrateurs de l'organisation.

| Élément UI | Description |
|---|---|
| **Bouton "Connecter Slack"** | Lance le flux OAuth 2.0 pour associer un workspace Slack |
| **Statut connecté** | Affiche le nom du workspace, le channel par défaut, et un bouton "Déconnecter" |
| **Onglet Automatisations** | Vue globale de toutes les règles actives (toutes scopes confondues) |
| **Bouton "Gérer ce scope"** | Ouvre le drawer d'automatisation pré-rempli pour modifier une règle existante |

> L'onglet **Automatisations** est positionné après **Templates** dans la barre de navigation des paramètres.  
> L'onglet **Intégrations** est positionné après **Automatisations**, avant **Sécurité**.

---

## Moteur d'automatisation

Le moteur (`server/automationEngine.ts`) intercepte les événements métier émis depuis les routes et exécute les règles configurées.

### Scopes supportés

| Scope | Événements |
|---|---|
| `global` | Tous événements |
| `project` | `project.created`, `project.updated`, `project.milestone_reached`, tâches |
| `backlog` | `backlog.ticket_created`, `backlog.sprint_started`, `backlog.sprint_completed`, etc. |
| `crm` | `crm.deal_created`, `crm.deal_won`, `crm.stage_changed`, `crm.client_created` |
| `roadmap` | `roadmap.updated`, `roadmap.item_created`, `roadmap.item_completed` |
| `notes` | `note.created`, `note.updated` |

### Variables système injectées automatiquement

| Variable | Source |
|---|---|
| `{{date}}` | Date ISO courante (injectée par le moteur pour tous les événements) |
| `{{user_name}}` | Résolu depuis l'`account_id` de la session |

---

## Utilisation dans les automatisations

Une fois Slack connecté, vous pouvez configurer des automatisations depuis n'importe quelle page (CRM, Backlog, Roadmap, Tâches, Notes) en cliquant sur le bouton **Automatisations** (icône éclair).

### Exemple d'automatisation Slack

| Champ | Valeur exemple |
|---|---|
| **Déclencheur** | `crm.deal_won` — Deal gagné |
| **Condition** | `stage` = `Gagné` |
| **Action** | Envoyer dans Slack channel `#commercial` |
| **Message** | `Deal gagné avec {{client_name}} !` |

### Variables de message disponibles

| Variable | Remplacée par |
|---|---|
| `{{client_name}}` | Nom du client |
| `{{project_name}}` | Nom du projet |
| `{{user_name}}` | Nom de l'utilisateur déclencheur |
| `{{priority}}` | Priorité (basse / moyenne / haute / critique) |
| `{{status}}` | Statut de l'élément |
| `{{stage}}` | Étape du deal CRM |

---

## Stockage en base de données

Le token Slack est stocké dans la table `accounts` dans la colonne JSONB `settings` :

```json
{
  "slack": {
    "token": "xoxb-...",
    "teamId": "T01ABC123",
    "teamName": "Mon Workspace",
    "channelId": "C01DEF456",
    "webhookUrl": "https://hooks.slack.com/services/..."
  }
}
```

Chaque organisation (`account_id`) possède ses propres credentials — il n'y a aucun partage entre organisations.

---

## Débogage courant

| Symptôme | Cause probable | Solution |
|---|---|---|
| `'/api/slack/oauth/start' is not a valid HTTP method` | Arguments inversés dans `apiRequest(url, method)` | Vérifier l'ordre des arguments |
| `invalid_redirect_uri` depuis Slack | URL de callback non enregistrée dans l'app Slack | Ajouter l'URL dans les Redirect URLs de l'app |
| Bouton "Connecter Slack" ne répond pas | Version de prod pas déployée | Redéployer sur Render |
| `channel_not_found` lors de l'envoi | Channel ID invalide ou bot non invité | Inviter le bot dans le channel avec `/invite @PlanBase` |
| Token expiré | Slack révoque les tokens inactifs après 30 jours | Déconnecter et reconnecter Slack |

---

## Sécurité

- Les tokens sont stockés côté serveur uniquement, jamais exposés au frontend
- Le paramètre `state` OAuth contient `accountId:timestamp` pour prévenir les attaques CSRF
- Les routes `/api/slack/*` requièrent une session authentifiée (`requireAuth + requireOrgMember`)
- Déconnexion : supprime uniquement les données Slack de l'org de l'utilisateur courant
