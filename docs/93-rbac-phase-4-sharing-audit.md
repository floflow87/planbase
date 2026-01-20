# RBAC Phase 4 - Partage Sécurisé et Audit Trail

## Résumé

Cette phase étend le système RBAC avec :
- **Partage par liens publics** : Liens tokenisés pour partager des ressources en lecture seule
- **Portée des invités** : Restriction des membres guest à des projets spécifiques
- **Audit trail** : Journalisation de tous les événements de permissions/partage
- **Packs de permissions** : Préréglages pour appliquer rapidement des configurations

## Tables de Base de Données

### share_links
Stocke les liens de partage avec tokens hachés.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | UUID unique (auto-generated) |
| organization_id | uuid | Compte propriétaire (FK accounts) |
| created_by_member_id | uuid | ID du membre créateur (FK organization_members) |
| resource_type | text | Type de ressource (project, roadmap, backlog, note, document, profitability_project) |
| resource_id | text | ID de la ressource partagée |
| token_hash | text | Hash SHA-256 du token (jamais le token brut) - indexé unique |
| permissions | jsonb | Permissions accordées (défaut: { read: true }) |
| expires_at | timestamp | Date d'expiration optionnelle |
| revoked_at | timestamp | Date de révocation (null si actif) |
| last_accessed_at | timestamp | Dernier accès au lien |
| access_count | integer | Nombre d'accès (défaut: 0) |
| created_at | timestamp | Date de création |

### member_project_access
Restreint les membres guest à des projets spécifiques.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | UUID unique (auto-generated) |
| organization_id | uuid | Compte propriétaire (FK accounts) |
| member_id | uuid | ID du membre organization (FK organization_members) |
| project_id | uuid | ID du projet accessible |
| access_level | text | Niveau d'accès: 'read' ou 'comment' (défaut: read) |
| created_at | timestamp | Date de création |

### audit_events
Journalise tous les événements liés aux permissions et au partage.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | UUID unique (auto-generated) |
| organization_id | uuid | Compte concerné (FK accounts) |
| actor_member_id | uuid | ID du membre effectuant l'action (null pour accès public) |
| action_type | text | Type d'action (voir liste ci-dessous) |
| resource_type | text | Type de ressource (optionnel) |
| resource_id | text | ID de la ressource (optionnel) |
| meta | jsonb | Données supplémentaires (diff, IP, userAgent, etc.) |
| created_at | timestamp | Date de l'événement

### Types d'actions d'audit

```typescript
const AUDIT_ACTION_TYPES = [
  "permission.updated",       // Permission modifiée
  "permission.reset",         // Permissions réinitialisées au rôle par défaut
  "share.created",            // Lien de partage créé
  "share.accessed",           // Lien de partage utilisé (accès public)
  "share.revoked",            // Lien de partage révoqué
  "pack.applied",             // Pack de permissions appliqué
  "project_access.granted",   // Accès projet accordé à un membre
  "project_access.revoked",   // Accès projet révoqué
  "member.role_changed",      // Rôle modifié
  "member.removed",           // Membre supprimé
] as const;
```

## Sécurité des Liens de Partage

### Création d'un lien
1. Génération d'un token aléatoire via `crypto.randomBytes(32)`
2. Hashage SHA-256 du token
3. Stockage du hash uniquement (jamais le token brut)
4. Retour du token au créateur une seule fois

### Validation d'un lien
1. Réception du token dans l'URL publique
2. Hashage du token reçu
3. Comparaison avec le hash stocké (constant-time)
4. Vérification de l'expiration et de la révocation
5. Journalisation de l'accès dans audit_events

### Code de validation
```typescript
// shareLinkService.ts - validateShareToken et recordShareAccess
async function validateShareToken(token: string): Promise<ValidateShareTokenResult> {
  const tokenHash = hashToken(token);
  const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash));

  if (!shareLink) return { valid: false, error: "not_found" };
  if (shareLink.revokedAt) return { valid: false, error: "revoked" };
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) return { valid: false, error: "expired" };

  return { valid: true, shareLink };
}

async function recordShareAccess(shareLink: ShareLink, meta: { ip?: string; userAgent?: string } = {}): Promise<void> {
  // Update access statistics
  await db.update(shareLinks).set({
    lastAccessedAt: new Date(),
    accessCount: sql`${shareLinks.accessCount} + 1`,
  }).where(eq(shareLinks.id, shareLink.id));

  // Log audit event with metadata
  await logShareAccessed(shareLink.organizationId, shareLink.id, shareLink.resourceType, shareLink.resourceId, meta);
}
```

## Packs de Permissions

Préréglages prédéfinis pour simplifier la configuration.

### Packs disponibles

| Pack | Description | Modules |
|------|-------------|---------|
| admin | Accès administrateur complet | Tous les modules - toutes les actions |
| member | Membre standard de l'équipe | CRM, Projects, Tasks, Notes, Documents (CRUD) |
| guest | Accès limité en lecture | Projects, Notes, Documents (lecture seule) |
| client_portal | Portail client restreint | Projects (lecture), Documents (lecture) |
| collaborator | Collaborateur avec droits partiels | Projects, Tasks, Notes (CRUD), Documents (lecture) |

### Structure d'un pack
```typescript
interface PermissionPack {
  id: string;
  name: string;
  description: string;
  permissions: Record<RbacModule, Record<RbacAction, boolean>>;
  defaultSubviews?: Record<string, string[]>;
  suggestedForRole?: RbacRole;
}
```

## Endpoints API

### Liens de partage

```
GET    /api/share-links                  # Liste des liens (filtrable par resourceType, resourceId)
POST   /api/share-links                  # Créer un lien
DELETE /api/share-links/:id              # Révoquer un lien
GET    /api/share/:token                 # Accès public (retourne la ressource en lecture seule)
```

### Audit

```
GET    /api/audit                        # Liste des événements (filtrable par action, actorId, dates)
```

### Permission packs

```
GET    /api/permission-packs             # Liste des packs disponibles
POST   /api/permission-packs/:packId/apply # Appliquer un pack à un membre
```

### Accès projets guests

```
GET    /api/member-project-access/:memberId          # Projets accessibles par un guest
POST   /api/member-project-access/:memberId/:projectId  # Accorder accès
DELETE /api/member-project-access/:memberId/:projectId  # Révoquer accès
```

## Composants Frontend

### ShareDrawer
Drawer pour créer/gérer les liens de partage depuis n'importe quelle ressource.

```tsx
<ShareDrawer
  open={open}
  onOpenChange={setOpen}
  resourceType="project"
  resourceId={projectId}
/>
```

### SharePublicPage
Page publique accessible via `/share/:token` pour visualiser les ressources partagées.

- Affichage read-only des données
- Vue adaptée selon le type de ressource
- Pas d'authentification requise
- Design épuré et professionnel

### AuditTab
Onglet dans les paramètres pour visualiser l'historique d'audit.

- Filtrage par type d'action
- Filtrage par période
- Badges colorés par catégorie d'action
- Détails en JSON pour les métadonnées

### PermissionPacksUI
Interface pour appliquer des packs de permissions.

```tsx
<PermissionPacksUI
  memberId={memberId}
  memberName={memberName}
  currentRole={role}
  onPackApplied={handleRefresh}
/>
```

- Affichage des packs recommandés en premier
- Prévisualisation des permissions avant application
- Confirmation avant application

## Intégration

### Dans Settings
```tsx
// Onglet Permissions - Accordion pour les packs
<PermissionPacksUI memberId={selectedMemberId} ... />

// Onglet Audit - Historique complet
<AuditTab />
```

### Dans les pages ressources
```tsx
// Bouton de partage dans la toolbar
<Button onClick={() => setShareOpen(true)}>
  <Share2 className="w-4 h-4" />
  Partager
</Button>
<ShareDrawer
  open={shareOpen}
  onOpenChange={setShareOpen}
  resourceType="project"
  resourceId={id}
/>
```

## Tests manuels

1. **Création de lien** : Vérifier que le token est retourné une seule fois
2. **Accès public** : Tester `/share/:token` avec un token valide
3. **Expiration** : Créer un lien avec expiration et vérifier le blocage après expiration
4. **Révocation** : Révoquer un lien et vérifier qu'il n'est plus accessible
5. **Audit** : Vérifier que les événements apparaissent dans l'onglet Audit
6. **Packs** : Appliquer un pack et vérifier les permissions résultantes

## Fichiers clés

- `shared/schema.ts` - Définitions des tables share_links, member_project_access, audit_events
- `shared/config/permissionPacks.ts` - Configuration des packs de permissions
- `server/services/shareLinkService.ts` - Logique de gestion des liens
- `server/services/auditService.ts` - Service de journalisation
- `server/routes.ts` - Endpoints API
- `client/src/components/share/ShareDrawer.tsx` - UI de partage
- `client/src/pages/share-public.tsx` - Page publique
- `client/src/components/settings/AuditTab.tsx` - Onglet audit
- `client/src/components/settings/PermissionPacksUI.tsx` - UI des packs
