# Module Feedback — Documentation

## Vue d'ensemble

Le module Feedback de Planbase permet de collecter, qualifier et exploiter les retours utilisateurs (bugs, suggestions, demandes) directement dans le workflow produit. Il combine collecte publique, gestion privée par backlog et intelligence artificielle pour transformer un flux de feedbacks bruts en actions priorisées (tickets, epics, roadmap).

Trois grandes briques :

1. **Collecte** — page publique partageable, paramétrable par projet/backlog
2. **Inbox & qualification** — drawer de détail, statuts, scoring, archivage
3. **Intelligence (V3)** — analyse IA par feedback, clusters thématiques, recherche sémantique, génération de tickets/epics depuis un cluster

---

## 1. Architecture

### Tables Postgres (Supabase)

Toutes définies dans `shared/schema.ts` et protégées par RLS sur `account_id`.

| Table | Rôle |
|---|---|
| `project_feedback_settings` | Paramètres niveau projet (publication, branding du formulaire) |
| `project_feedbacks` | Le feedback lui-même (titre, description, contributeur, type, importance, statut, scoring, colonnes IA `ai_*`, lien vers ticket) |
| `feedback_clusters` | Cluster thématique (titre, résumé, statut `proposed` / `validated` / `dismissed` / `archived`) |
| `feedback_cluster_items` | Table de jonction cluster ↔ feedback |

Colonnes `ai_*` sur `project_feedbacks` (renseignées par l'analyse IA) :
- `ai_summary`, `ai_suggested_type`, `ai_suggested_importance`, `ai_suggested_product_area`, `ai_suggested_tags`, `ai_embedding` (vecteur 1536), `analyzed_at`.

### Fichiers principaux

**Backend**
- `server/routes.ts` — toutes les routes `/api/(projects|backlogs)/.../feedbacks*` et `/feedback-clusters*`
- `server/lib/openai.ts` — `analyzeFeedback()`, `generateFeedbackClusters()`
- `server/storage.ts` — méthodes CRUD multi-tenant

**Frontend**
- `client/src/components/project/FeedbackTab.tsx` — composant principal V3 (vues Inbox / Clusters / Insights, drawer de détail, dialogs)
- `client/src/pages/feedback-public.tsx` — formulaire public

---

## 2. Endpoints API (résumé)

Toutes les routes privées passent par `requireAuth + requireOrgMember`.

### Feedbacks
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/backlogs/:backlogId/feedbacks` | Lister les feedbacks d'un backlog |
| POST | `/api/backlogs/:backlogId/feedbacks` | Créer manuellement un feedback |
| PATCH | `/api/backlogs/:backlogId/feedbacks/:id` | Mettre à jour (statut, qualification…) |
| DELETE | `/api/backlogs/:backlogId/feedbacks/:id` | Supprimer |
| POST | `.../:id/analyze` | Lancer l'analyse IA (résumé, type, tags, embedding) |
| POST | `.../:id/apply-ai-suggestions` | Appliquer les suggestions IA aux champs réels |
| GET | `.../:id/similar` | Retrouver les feedbacks sémantiquement proches |
| POST | `.../:id/create-ticket` | Convertir en user story |
| POST | `.../:id/link-ticket` | Rattacher à un ticket existant |

### Clusters
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/backlogs/:backlogId/feedback-clusters` | Lister les clusters (avec items) |
| POST | `.../feedback-clusters/generate` | Lancer la génération IA de clusters |
| POST | `.../feedback-clusters` | Créer un cluster manuellement |
| PATCH | `.../feedback-clusters/:id` | Modifier titre/résumé/statut |
| POST | `.../:id/add-feedback` | Ajouter un feedback au cluster |
| POST | `.../:id/remove-feedback` | Retirer un feedback du cluster |
| POST | `.../:id/create-ticket` | Créer un ticket depuis le cluster |
| POST | `.../:id/create-epic` | Créer un epic depuis le cluster |
| POST | `.../:id/link-ticket` | Lier le cluster à un ticket existant |

### Public
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/public/feedback/:shareToken` | Lire le formulaire public (sans auth) |
| POST | `/api/public/feedback/:shareToken` | Soumettre un feedback (sans auth) |

### Alertes & déduplication

Le service `server/services/alertService.ts` agrège les événements de fallback IA (Ollama → OpenAI) sur une fenêtre configurable (`ALERT_DEDUP_WINDOW_SECONDS`, défaut 300 s) pour éviter les rafales d'alertes pendant un incident. Une seule alerte consolidée part par fenêtre, indiquant le nombre total de requêtes affectées.

---

## 3. Cycle de vie d'un feedback

```
[public form] ──► new ──► to_qualify ──► qualified ──► linked_to_ticket
                  │                          │              │
                  └──► rejected              └──► converted_to_ticket
                                                       │
                                                       └──► archived
```

- **new** : juste reçu, pas encore traité
- **to_qualify** / **qualified** : en cours de tri
- **linked_to_ticket** / **converted_to_ticket** : rattaché à une user story
- **rejected** / **archived** : sorti du flux actif

---

## 4. Intelligence Feedback (V3)

### Analyse individuelle (`analyzeFeedback`)

Sur déclenchement manuel ou batch, GPT-5 reçoit titre + description + qualification existante et renvoie : résumé court, type suggéré, importance suggérée, product area, tags. En parallèle, un embedding `text-embedding-ada-002` (1536 dim.) est calculé et stocké dans `ai_embedding` (pgvector) pour la recherche sémantique.

### Recherche de feedbacks similaires

Endpoint `GET /feedbacks/:id/similar` — utilise l'opérateur de distance cosinus pgvector pour retrouver les `N` feedbacks les plus proches du feedback courant. Affiché dans la section IA du drawer.

### Clusters

`POST /feedback-clusters/generate` envoie les feedbacks éligibles à GPT-5 qui regroupe les feedbacks proches sémantiquement et propose pour chaque groupe : titre, résumé, type de regroupement, importance globale. Les clusters arrivent en statut `proposed` et doivent être validés.

Statuts de cluster :
- **proposed** — suggéré par l'IA, en attente de décision
- **validated** — confirmé, peut être converti en ticket/epic
- **dismissed** — rejeté (n'apparaît plus dans les indicateurs)
- **archived** — clos

Depuis un cluster validé : créer un ticket, créer un epic, ou rattacher à un ticket existant. Tous les feedbacks du cluster basculent alors en `linked_to_ticket`/`converted_to_ticket`.

---

## 5. Vues UI (FeedbackTab)

Trois sous-vues commutables via tabs en haut du composant :

### Inbox
Tableau filtrable des feedbacks (recherche texte, type, importance, statut, source). Les badges visuels dans la cellule Titre :
- **Brain (violet)** — feedback déjà analysé par l'IA
- **Layers (cyan)** — feedback appartenant à au moins un cluster actif (tooltip = nom(s) du/des cluster(s))

Un badge global dans l'en-tête `"N dans des clusters"` affiche la couverture de clustering.

Actions ligne par ligne : ouvrir le drawer, changer de statut, archiver. Drawer = qualification complète + section IA + bouton "Ajouter à un cluster" + lien/conversion vers ticket.

### Clusters
Liste de tous les clusters (proposed/validated/dismissed/archived) avec leurs feedbacks. Pour chacun : voir, valider, modifier titre/résumé, créer ticket/epic, lier à un ticket, dismiss.

### Insights
Synthèse statistique : répartition par statut/type, top product areas, top tickets liés, feedbacks à qualifier, bugs critiques sans ticket, etc.

---

## 6. Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | Clé pour GPT-5, embeddings, Whisper | requis |
| `ALERT_EMAIL` | Email destinataire des alertes IA | optionnel |
| `ALERT_WEBHOOK_URL` | Webhook destinataire des alertes IA | optionnel |
| `ALERT_DEDUP_WINDOW_SECONDS` | Fenêtre de regroupement des alertes | 300 |
