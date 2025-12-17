# Semantic Mappings

Bridge between business domain keys and design tokens.

## Intent System

Located at `shared/design/semantics/intents.ts`

### Available Intents

| Intent | Purpose | Color |
|--------|---------|-------|
| `success` | Positive states (completed, paid) | Green |
| `warning` | Caution states (pending, needs attention) | Yellow/Amber |
| `danger` | Error/critical (failed, overdue, blocked) | Red |
| `info` | Informational (in progress) | Blue |
| `neutral` | Default/inactive | Gray |
| `primary` | Brand/CTA emphasis | Violet |
| `accent` | Secondary emphasis | Cyan |

### Intent Variants

Each intent has 4 visual variants:

- `solid` - Filled background, white text
- `soft` - Light background, colored text (default)
- `outline` - Transparent with colored border
- `ghost` - Transparent, colored text, no border

### Usage

```typescript
import { getIntentClasses, getIntentStyle } from "@shared/design/semantics";

// Get Tailwind classes
const classes = getIntentClasses("success", "soft");
// "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ..."

// Get individual style properties
const style = getIntentStyle("warning", "outline");
// { bg: "...", text: "...", border: "..." }
```

## Business Mappings

### Project Stages

```typescript
import { getProjectStageIntent, getProjectStageClasses } from "@shared/design/semantics";

// Intent mapping
getProjectStageIntent("prospection"); // "warning"
getProjectStageIntent("termine");      // "success"

// Tailwind classes
getProjectStageClasses("en_cours");    // "bg-blue-100 text-blue-700 ..."
```

| Stage | Intent |
|-------|--------|
| prospection | warning |
| signe | primary |
| en_cours | info |
| livre | accent |
| termine | success |

### Task Priorities

```typescript
import { getTaskPriorityIntent, getTaskPriorityClasses } from "@shared/design/semantics";
```

| Priority | Intent |
|----------|--------|
| critical | danger |
| high | warning |
| medium | info |
| low | neutral |

### Task Statuses

```typescript
import { getTaskStatusIntent, getTaskStatusClasses } from "@shared/design/semantics";
```

| Status | Intent |
|--------|--------|
| todo | neutral |
| in_progress | info |
| review | warning |
| done | success |
| blocked | danger |

### Billing Statuses

```typescript
import { getBillingStatusIntent, getBillingStatusClasses } from "@shared/design/semantics";
```

| Status | Intent |
|--------|--------|
| not_billed | neutral |
| pending | warning |
| partial | info |
| paid | success |
| overdue | danger |
| cancelled | neutral |

## Adding New Mappings

1. Add the business key type to `shared/config/`
2. Create semantic mapping in `shared/design/semantics/`
3. Define intent mapping
4. Define color classes for backwards compatibility
5. Export from `shared/design/semantics/index.ts`
