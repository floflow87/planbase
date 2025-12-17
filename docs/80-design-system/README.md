# Buddy Design System V1

PlanBase's design system for consistent, maintainable UI across the application.

## Overview

The design system follows a 4-layer architecture:

1. **Tokens** - Foundational design values (colors, spacing, typography, shadows)
2. **Semantics** - Business-to-design mappings (intents, status colors)
3. **Primitives** - Atomic UI components (BadgeIntent)
4. **Product** - Business-specific components (ProjectStageBadge, TaskStatusBadge)

## Quick Start

### Using Product Components

```tsx
import { 
  ProjectStageBadge, 
  TaskPriorityBadge, 
  TaskStatusBadge,
  BillingStatusBadge 
} from "@/design-system/product";

// In your component:
<ProjectStageBadge stageKey={project.stage} />
<TaskPriorityBadge priorityKey={task.priority} showIcon />
<TaskStatusBadge statusKey={task.status} />
<BillingStatusBadge statusKey={project.billingStatus} />
```

### Using Toast Helpers

```tsx
import { toastSuccess, toastError, toastInfo } from "@/design-system/feedback";

// Success toast (GREEN)
toastSuccess({ title: "Saved!", description: "Your changes have been saved." });

// Error toast (RED)
toastError({ title: "Error", description: "Something went wrong." });

// Info toast (NEUTRAL)
toastInfo({ title: "Note", description: "Your session expires soon." });
```

## Documentation

- [Tokens](./tokens.md) - Color, spacing, typography, and shadow tokens
- [Semantics](./semantics.md) - Intent mappings and business-to-design bridges
- [Primitives](./primitives.md) - Atomic UI components
- [Product Components](./product-components.md) - Business-specific components
- [Do's and Don'ts](./do-dont.md) - Best practices and anti-patterns

## Key Principles

1. **Token-first** - Never use hardcoded colors or spacing in components
2. **Intent-based** - Use semantic intents (success, warning, danger) not raw colors
3. **Config-aware** - Components consume labels from `shared/config/`
4. **Dark mode ready** - All tokens include light/dark variants
5. **Progressive migration** - Adopt incrementally, no big bang refactors

## File Structure

```
shared/design/
├── tokens/           # Layer 1: Design tokens
│   ├── colors.ts
│   ├── spacing.ts
│   ├── radius.ts
│   ├── typography.ts
│   ├── shadows.ts
│   └── index.ts
├── semantics/        # Layer 2: Business mappings
│   ├── intents.ts
│   ├── projectStages.ts
│   ├── taskPriorities.ts
│   ├── taskStatuses.ts
│   ├── billingStatuses.ts
│   └── index.ts
└── index.ts

client/src/design-system/
├── primitives/       # Layer 3: Atomic components
│   ├── BadgeIntent.tsx
│   ├── cx.ts
│   └── index.ts
├── product/          # Layer 4: Business components
│   ├── ProjectStageBadge.tsx
│   ├── TaskPriorityBadge.tsx
│   ├── TaskStatusBadge.tsx
│   ├── BillingStatusBadge.tsx
│   └── index.ts
├── feedback/         # Toast utilities
│   ├── toast.ts
│   └── index.ts
└── index.ts
```
