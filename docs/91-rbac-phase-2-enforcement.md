# RBAC Phase 2: Backend & Frontend Enforcement

## Overview

Cette phase implémente l'enforcement complet des permissions RBAC avec:
- Middleware `requirePermission` sur les routes backend (CRM, Notes)
- Guards de route frontend avec mode lecture seule
- Protection des actions (création, édition, suppression)
- Configuration des vues pour les invités

## Architecture

### Middleware Backend (`requirePermission`)

Le middleware vérifie les permissions avant l'exécution des handlers de route:

```typescript
router.get("/api/clients", requirePermission("crm", "read"), handler);
router.post("/api/clients", requirePermission("crm", "create"), handler);
router.patch("/api/clients/:id", requirePermission("crm", "update"), handler);
router.delete("/api/clients/:id", requirePermission("crm", "delete"), handler);
```

#### Sous-vues (Subviews)

Certains modules ont des sous-vues configurables:
- `crm.clients` - Accès à la liste des clients
- `crm.opportunities` - Accès au pipeline des opportunités
- `crm.kpis` - Accès aux KPIs

```typescript
// Vérifie crm:read + subview crm.clients activée
router.get("/api/clients", requirePermission("crm", "read", "crm.clients"), handler);
```

### Composants Frontend

#### PermissionGuard

Protège une page entière et affiche un écran d'accès refusé si l'utilisateur n'a pas la permission:

```tsx
<PermissionGuard module="crm" action="read">
  <PageContent />
</PermissionGuard>
```

#### ReadOnlyBadge

Affiche un badge "Lecture seule" quand l'utilisateur a uniquement accès en lecture:

```tsx
<ReadOnlyBadge module="crm" />
// Affiche: [Eye icon] Lecture seule
```

#### Can Component

Affiche conditionnellement du contenu basé sur les permissions:

```tsx
<Can module="crm" action="create">
  <Button>Créer</Button>
</Can>
```

### Hook usePermissions

```typescript
const { can, isReadOnly } = usePermissions();

// Vérifier une permission
if (can("notes", "create")) { ... }

// Vérifier le mode lecture seule
if (isReadOnly("crm")) { ... }
```

## Routes Protégées

### CRM Routes

| Route | Permission | Sous-vue |
|-------|------------|----------|
| GET /api/clients | crm:read | crm.clients |
| POST /api/clients | crm:create | - |
| PATCH /api/clients/:id | crm:update | - |
| DELETE /api/clients/:id | crm:delete | - |
| GET /api/opportunities | crm:read | crm.opportunities |
| POST /api/opportunities | crm:create | - |
| GET /api/crm/kpis | crm:read | crm.kpis |

### Notes Routes

| Route | Permission |
|-------|------------|
| GET /api/notes | notes:read |
| POST /api/notes | notes:create |
| PATCH /api/notes/:id | notes:update |
| DELETE /api/notes/:id | notes:delete |

## Configuration des Vues Invités

### API Endpoints

```typescript
// Récupérer la config de vue pour un module
GET /api/views/me?module=crm

// Définir un template de vue invité (admin seulement)
POST /api/views/template/guest
{
  "module": "crm",
  "config": {
    "subviewsEnabled": { "crm.clients": true, "crm.opportunities": false },
    "layout": "list"
  },
  "applyToAll": true // Appliquer à tous les invités existants
}
```

### Structure de Configuration

```typescript
interface ModuleViewConfig {
  subviewsEnabled?: Record<string, boolean>;
  layout?: 'list' | 'grid' | 'kanban';
}
```

## Comportement par Rôle

| Rôle | Accès | Création | Édition | Suppression |
|------|-------|----------|---------|-------------|
| owner | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ |
| member | ✅ | ✅ | ✅ | ❌ |
| guest | Configurable | ❌ | ❌ | ❌ |

## Tests

Pour tester le système:

1. Se connecter en tant qu'invité
2. Vérifier que le badge "Lecture seule" apparaît
3. Vérifier que les boutons créer/éditer/supprimer sont masqués
4. Tester les routes API directement avec curl pour confirmer le blocage

```bash
# Devrait retourner 403 pour un invité
curl -X POST /api/clients -H "X-User-Role: guest"
```

## Fichiers Clés

- `server/middleware/auth.ts` - Middleware requirePermission
- `server/services/permissionService.ts` - Logique des permissions
- `client/src/hooks/usePermissions.ts` - Hook de permissions
- `client/src/components/Can.tsx` - Composants PermissionGuard, ReadOnlyBadge, Can
- `client/src/pages/crm.tsx` - Page CRM protégée
- `client/src/pages/notes.tsx` - Page Notes protégée
