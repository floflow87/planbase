# Config Registry

The Config Registry provides a database-first configuration system with static defaults merged with per-account database overrides.

## Architecture

```
DEFAULTS (shared/config/*) 
    ↓ merged with
SYSTEM settings (settings table, scopeId=null)
    ↓ merged with  
ACCOUNT settings (settings table, scopeId=accountId)
    ↓ merged with
USER settings (settings table, scopeId=userId)
    ↓ merged with
PROJECT settings (settings table, scopeId=projectId)
    = EFFECTIVE CONFIG
```

Lower scopes override higher scopes. Arrays are replaced wholesale, objects are deep-merged.

## Default Configs

Located in `shared/config/`:

| File | Export | Description |
|------|--------|-------------|
| `projectStages.ts` | `PROJECT_STAGES` | Project pipeline stages |
| `taskStatuses.ts` | `TASK_STATUSES` | Task workflow statuses |
| `taskPriorities.ts` | `TASK_PRIORITIES` | Task priority levels |
| `billingStatuses.ts` | `BILLING_STATUSES` | Invoice/billing statuses |
| `timeCategories.ts` | `TIME_CATEGORIES` | Time tracking categories |
| `thresholds.ts` | `THRESHOLDS` | System thresholds and limits |

## Server Usage

```typescript
import { configService } from "./services/configService";

// Get effective config for an account
const config = await configService.resolveConfig(accountId);
console.log(config.effective['project.stages']);

// Update a setting
await configService.updateSetting(
  'project.stages',
  [...customStages],
  'ACCOUNT',
  accountId,
  updatedByUserId
);
```

## Frontend Usage

```typescript
import { useConfig } from "@/hooks/useConfig";

function MyComponent() {
  const { config, isLoading, updateConfig } = useConfig();
  
  if (isLoading) return <Skeleton />;
  
  const stages = config.effective['project.stages'];
  return (
    <Select>
      {stages.map(stage => (
        <SelectItem key={stage.key} value={stage.key}>
          {stage.label}
        </SelectItem>
      ))}
    </Select>
  );
}
```

## API Endpoints

### GET /api/config

Returns resolved configuration for the authenticated user's account.

**Response:**
```json
{
  "defaults": { ... },
  "overrides": { ... },
  "effective": { ... },
  "meta": {
    "resolvedAt": "2024-01-15T10:30:00Z",
    "accountId": "...",
    "userId": "..."
  }
}
```

### PUT /api/config/:key

Updates a configuration setting. **Requires owner role.**

**Request:**
```json
{
  "value": [...],
  "scope": "ACCOUNT"
}
```

## Caching

The ConfigService maintains an in-memory cache with 60-second TTL:
- SYSTEM changes invalidate entire cache
- ACCOUNT changes invalidate all users in that account
- USER changes invalidate that user's cache entries
- PROJECT changes invalidate project-specific entries

## Security

- GET requires authentication (valid session)
- PUT requires owner role (collaborators cannot modify configs)
