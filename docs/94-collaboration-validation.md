# Phase 5: Collaboration avancée et workflows de validation

## Vue d'ensemble

La Phase 5 introduit des fonctionnalités de collaboration avancée permettant aux équipes de gérer les approbations, les décisions clés et de fournir une vue exécutive des projets.

## Fonctionnalités implémentées

### 1. Workflow d'approbation (Approval Workflow)

**Statuts disponibles:**
- `draft` - Brouillon, pas encore soumis
- `pending_approval` - En attente de validation
- `approved` - Approuvé
- `rejected` - Refusé
- `changes_requested` - Modifications demandées

**Table `approvals`:**
```sql
- id: UUID (clé primaire)
- account_id: UUID (référence au compte)
- project_id: UUID (optionnel, référence au projet)
- resource_type: VARCHAR (type de ressource: milestone, deliverable, etc.)
- resource_id: UUID (ID de la ressource)
- status: approval_status (enum)
- requested_by: UUID (utilisateur demandeur)
- decided_by: UUID (utilisateur décideur, nullable)
- comment: TEXT (commentaire optionnel)
- created_at: TIMESTAMP
- decided_at: TIMESTAMP (nullable)
```

### 2. Types de commentaires structurés

**Types disponibles pour `ticket_comments.comment_type`:**
- `note` - Note standard (par défaut)
- `decision` - Décision importante
- `question` - Question à clarifier
- `client_feedback` - Retour client
- `blocking_issue` - Problème bloquant

**Restriction guests:** Les utilisateurs invités ne peuvent créer que des commentaires de type `question` ou `client_feedback`.

### 3. Timeline des décisions

**Route:** `GET /api/projects/:projectId/decisions`

Combine les événements d'audit liés aux décisions et les commentaires de type "decision" pour afficher une chronologie complète des décisions du projet.

**Données retournées:**
```typescript
{
  events: AuditEvent[], // Événements approval.requested, approval.decided, decision.created
  comments: TicketComment[] // Commentaires de type 'decision'
}
```

### 4. Vue exécutive

**Route:** `GET /api/projects/:projectId/executive`

Fournit un tableau de bord synthétique pour les dirigeants avec:

**KPIs:**
- Heures totales passées
- Budget du projet
- Avancement (%)
- Marge projetée (%)

**Sections:**
- Prochain jalon (avec date cible et statut)
- Validations en attente
- Décisions récentes
- Problèmes bloquants

## Endpoints API

### Approbations

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/approvals` | Liste des approbations (filtrable par resourceType, resourceId, status) |
| GET | `/api/approvals/:id` | Détails d'une approbation |
| POST | `/api/approvals/request` | Demander une validation |
| POST | `/api/approvals/decide` | Rendre une décision (approuver/refuser/demander modifications) |

### Vues projet

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/projects/:id/decisions` | Timeline des décisions |
| GET | `/api/projects/:id/executive` | Vue exécutive KPIs |

## Composants Frontend

### ApprovalBadge
Badge visuel affichant le statut d'approbation avec icône et couleur appropriées.

```tsx
import { ApprovalBadge } from "@/components/approvals";

<ApprovalBadge status="pending_approval" size="sm" />
```

### ApprovalDrawer
Panneau latéral pour gérer les demandes et décisions de validation.

```tsx
import { ApprovalDrawer } from "@/components/approvals";

<ApprovalDrawer 
  open={isOpen}
  onOpenChange={setIsOpen}
  resourceType="milestone"
  resourceId={milestoneId}
  resourceTitle="Sprint 3 - Livraison"
  projectId={projectId}
/>
```

## Pages

### Timeline des décisions
**Route:** `/projects/:projectId/decisions`

Affiche une chronologie visuelle des événements de validation et décisions avec:
- Indicateurs colorés par type d'événement
- Informations sur l'acteur et la date
- Détails des commentaires de décision

### Vue exécutive
**Route:** `/projects/:projectId/executive`

Dashboard synthétique présentant:
- 4 KPIs en cartes (heures, budget, avancement, marge)
- Prochain jalon
- Validations en attente
- Décisions récentes
- Problèmes bloquants

## Migration base de données

Les migrations sont exécutées automatiquement au démarrage via `server/migrations-startup.ts`:

1. Création de la table `approvals` avec contraintes
2. Ajout de la colonne `comment_type` à `ticket_comments`
3. Création de l'index sur `approvals(resource_type, resource_id)`

## Sécurité

- Toutes les routes sont protégées par authentification
- Les approbations respectent l'isolation par `account_id`
- Les événements d'audit tracent toutes les actions de validation
- Les guests ont des restrictions sur les types de commentaires

## Intégration avec l'existant

- **Audit Trail:** Les décisions créent des événements `approval.requested` et `approval.decided`
- **RBAC:** Les permissions existantes s'appliquent aux routes d'approbation
- **Projets:** Le statut d'approbation peut déclencher la validation automatique des jalons
