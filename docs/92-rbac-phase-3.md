# RBAC Phase 3 - Comprehensive Module Enforcement

## Overview

Phase 3 extends RBAC (Role-Based Access Control) enforcement to all remaining modules in Planbase, ensuring that every route is protected with granular permissions and subview-level access control.

## Completed Scope

### Backend Route Protection

Applied the three-layer auth pattern to **212 routes** across all modules:

| Module | Routes Protected | Coverage |
|--------|-----------------|----------|
| **CRM** | 19/19 | 100% ✅ |
| **Projects** | 37/37 | 100% ✅ |
| **Product** | 56/56 | 100% ✅ |
| **Roadmap** | 28/28 | 100% ✅ |
| **Tasks** | 15/15 | 100% ✅ |
| **Profitability** | 12/12 | 100% ✅ |
| **Documents** | 23/23 | 100% ✅ |
| **Notes** | 22/22 | 100% ✅ |

**Three-layer Auth Pattern:**
```typescript
app.get("/api/module/resource", 
  requireAuth,           // Layer 1: JWT validation
  requireOrgMember,      // Layer 2: Organization membership
  requirePermission(     // Layer 3: RBAC permission check
    "module",           // Module name
    "action",           // read|create|update|delete
    "module.subview"    // Optional subview key
  ),
  async (req, res) => { ... }
);
```

### Subview Definitions

Added granular subview keys for all modules:

```typescript
// shared/schema.ts
export const CRM_SUBVIEWS = ['crm.clients', 'crm.opportunities', 'crm.kpis'];
export const PROJECTS_SUBVIEWS = ['projects.list', 'projects.details', 'projects.scope', 'projects.billing'];
export const PRODUCT_SUBVIEWS = ['product.backlog', 'product.epics', 'product.stats', 'product.retrospective', 'product.recipe'];
export const ROADMAP_SUBVIEWS = ['roadmap.gantt', 'roadmap.output', 'roadmap.okr', 'roadmap.tree'];
export const PROFITABILITY_SUBVIEWS = ['profitability.overview', 'profitability.byProject', 'profitability.simulations', 'profitability.resources'];
export const DOCUMENTS_SUBVIEWS = ['documents.list', 'documents.upload', 'documents.integrations'];
```

### Unified Context Endpoint

Created `/api/me/context` endpoint that aggregates:
- User info
- Organization info
- Membership role
- Full permissions matrix (module → action → boolean)
- Module views configuration (subviews enabled, layout preferences)

```typescript
// Response structure
{
  user: { id, email, displayName, ... },
  organization: { id, name, plan },
  membership: { id, role, status },
  permissions: {
    crm: { read: true, create: false, update: false, delete: false },
    projects: { read: true, create: true, update: true, delete: false },
    // ... all modules
  },
  moduleViews: {
    crm: { subviewsEnabled: { 'crm.clients': true, 'crm.opportunities': false } },
    // ... per-module view configs
  }
}
```

### Frontend Hooks

**useAppContext()** - Central permission management hook:
```typescript
const { 
  can,              // can(module, action) → boolean
  isReadOnly,       // isReadOnly(module) → boolean
  isSubviewEnabled, // isSubviewEnabled(module, subviewKey) → boolean
  hasModuleAccess,  // hasModuleAccess(module) → boolean
  isAdmin, isMember, isGuest
} = useAppContext();
```

**PermissionGuard** - React component for page-level protection:
```tsx
<PermissionGuard module="product" fallbackPath="/">
  <ProductPage />
</PermissionGuard>
```

**ReadOnlyBanner** - Visual indicator for read-only mode:
```tsx
<ReadOnlyBanner module="product" />
// Shows "Mode lecture seule" banner when user has read-only access
```

**useReadOnlyMode** - Hook for conditional button rendering:
```typescript
const { readOnly, canCreate, canUpdate, canDelete } = useReadOnlyMode("product");
// Use to show/hide create, edit, delete buttons
```

### Dynamic Sidebar

Updated `app-sidebar.tsx` to filter navigation items based on `hasModuleAccess()`. Modules with no read permission are hidden from the sidebar.

### Guest View Configuration

Extended `GuestViewConfig` component to support all 6 modules with:
- Collapsible accordion UI
- Per-subview toggle switches
- Batch save to `/api/views/template/guest/all`
- Default configurations for new guests

### Pages Updated with Guards

Applied `PermissionGuard`, `ReadOnlyBanner`, and conditional button rendering to:
- `/product` (product.tsx)
- `/roadmap` (roadmap.tsx)
- `/tasks` (tasks.tsx)
- `/documents` (documents.tsx)
- `/finance` (finance.tsx / profitability)

## Audit Script

Created `scripts/audit-permissions-coverage.ts` for ongoing verification:

```bash
npx tsx scripts/audit-permissions-coverage.ts
```

Outputs coverage report by module and identifies unprotected routes.

## Action Mapping

| HTTP Method | RBAC Action |
|-------------|-------------|
| GET | read |
| POST | create |
| PATCH/PUT | update |
| DELETE | delete |

## Security Notes

1. **Admin Override**: Admins bypass all permission checks
2. **Member Default**: Members get full access to all modules by default
3. **Guest Restrictions**: Guests have configurable, restrictive access
4. **Subview Filtering**: UI respects subview enabled/disabled state

## Future Improvements

1. **AST-based audit**: Replace regex-based audit with TypeScript AST parsing
2. **CI Integration**: Add audit script to CI pipeline with 100% threshold
3. **Audit logging**: Log permission denials for security monitoring
4. **Field-level permissions**: Add column-level restrictions for sensitive data
