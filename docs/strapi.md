# PlanBase — Architecture Config & Strapi

## Objectif

PlanBase utilise Strapi comme back-office dynamique pour :

- Feature flags
- Enums (valeurs de select)
- Templates (CDC, Roadmap, OKR...)
- Registry global (config metier)
- Plans & pricing

L'objectif est de ne plus redeployer l'application pour modifier des valeurs de configuration.

## Architecture globale

```
Strapi (admin.planbase.io)
        | (API token securise)
Express backend (/api/config/*)
        |
React frontend (useConfig hook)
```

- Strapi = source de verite
- Backend = couche d'agregation + fallback
- Frontend = consommation via hooks

## Variables d'environnement requises (Render)

### Backend (planbase)

```
STRAPI_URL=https://admin.planbase.io
STRAPI_API_TOKEN=xxxxxxxxxxxxxxxx
```

### Strapi (planbase-admin)

Configurer normalement Supabase + DB Postgres.

## Endpoints backend importants

### Sanity check

```
GET /api/config/ping
```

Doit retourner :

```json
{ "ok": true }
```

### Configuration complete

```
GET /api/config/all
```

Retourne :

```json
{
  "plans": [],
  "featureFlags": [],
  "featureFlagsMap": {},
  "registry": [],
  "registryMap": {},
  "cdcTemplates": [],
  "roadmapTemplates": [],
  "okrTemplates": [],
  "resourceTemplates": [],
  "faq": [],
  "onboarding": [],
  "accountActions": []
}
```

> Si 404 :
> - Verifier que le backend est bien deploye
> - Verifier que Render pointe vers le bon repo (planbase)
> - Verifier que le build a bien genere dist/index.js
> - Verifier que la route est definie avant serveStatic() (ordre middleware)

## Strapi — Structure attendue

### 1. Feature Flags

Content-type : `feature-flags`

Champs :
- `key` (string, unique)
- `enabled` (boolean)
- `description` (optional)

Exemple :
```
key: okr_tree_view
enabled: true
```

### 2. Config Registry (Enums dynamiques)

Content-type : `configs`

Champs :
- `key` (string)
- `value` (JSON)
- `is_active` (boolean)

## Enums dynamiques supportes

| Key | Description |
|-----|-------------|
| project.stages | Etapes projet |
| task.priorities | Priorites tache |
| task.statuses | Statuts tache |
| billing.statuses | Statuts facturation |
| time.categories | Categories temps |
| thresholds | Seuils metier |

### Exemple JSON — project.stages

```json
[
  { "key": "prospection", "label": "Prospection", "order": 10 },
  { "key": "in_progress", "label": "En cours", "order": 20 },
  { "key": "delivered", "label": "Livre", "order": 30 }
]
```

## Frontend — Consommation

Hook principal :

```typescript
useConfig()
```

Retourne :

```json
{
  "projectStages": [],
  "taskPriorities": [],
  "taskStatuses": [],
  "billingStatuses": [],
  "timeCategories": [],
  "thresholds": {}
}
```

Toujours fallback sur valeurs hardcodees si Strapi est indisponible.

## Securite & Bonnes pratiques

- Toujours Save + Publish dans Strapi
- Ne pas exposer les endpoints publics inutiles
- Utiliser API Token Read Only
- Ne jamais supprimer les fallbacks hardcodes
- Toujours valider le type JSON cote backend

## Scenario de test rapide

### 1. Verifier connexion

```
https://app.planbase.io/api/config/ping
```

### 2. Verifier config

```
https://app.planbase.io/api/config/all
```

### 3. Modifier un enum

1. Strapi > Configs
2. Modifier `project.stages`
3. Publish
4. Refresh PlanBase
5. Verifier changement sans redeploy

## Problemes connus

### 404 sur /api/config/all

Cause probable :
- Mauvais start command Render
- dist/index.js non genere
- Mauvais repo branche
- Route definie apres serveStatic() (ordre middleware)

### Creation projets [Recovered]

Cause : Script de restauration ou fallback interne

Solution :
- Validation en POST/PATCH sur /api/projects
- Bloquer noms contenant [Recovered], Projet manquant, etc.

## Workflow recommande

- Quand tu modifies Strapi : pas besoin de redeployer PlanBase
- Quand tu modifies backend Express : push sur repo planbase, Render redeploy
- Quand tu modifies Strapi code : push sur repo planbase-admin, Render redeploy

## Etat actuel

Si :
- /api/config/all fonctionne
- Les enums changent dynamiquement
- Feature flags remontent
- Aucun projet [Recovered] ne se recree

Alors Strapi est correctement integre.

## Prochaine etape recommandee

- Ajouter versioning des configs
- Ajouter audit log sur changements Strapi
- Ajouter environnement staging
- Ajouter cache Redis pour config
