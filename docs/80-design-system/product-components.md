# Product Components

Business-specific components that connect config, semantics, and primitives.

## ProjectStageBadge

Displays the current stage of a project.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stageKey` | ProjectStageKey | - | Project stage key |
| `size` | "sm" \| "md" \| "lg" | "md" | Badge size |
| `dotOnly` | boolean | false | Show only dot indicator |

### Usage

```tsx
import { ProjectStageBadge } from "@/design-system/product";

<ProjectStageBadge stageKey={project.stage} />
<ProjectStageBadge stageKey="en_cours" size="sm" />
<ProjectStageBadge stageKey="termine" dotOnly />
```

## TaskPriorityBadge

Displays the priority level of a task.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `priorityKey` | TaskPriorityKey | - | Task priority key |
| `size` | "sm" \| "md" \| "lg" | "md" | Badge size |
| `showIcon` | boolean | false | Show icon alongside label |
| `iconOnly` | boolean | false | Show only icon |

### Usage

```tsx
import { TaskPriorityBadge } from "@/design-system/product";

<TaskPriorityBadge priorityKey={task.priority} />
<TaskPriorityBadge priorityKey="high" showIcon />
<TaskPriorityBadge priorityKey="critical" iconOnly />
```

### Icons

- **critical** - AlertTriangle (red)
- **high** - ArrowUp (orange)
- **medium** - ArrowRight (blue)
- **low** - ArrowDown (gray)

## TaskStatusBadge

Displays the current status of a task.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `statusKey` | TaskStatusKey | - | Task status key |
| `size` | "sm" \| "md" \| "lg" | "md" | Badge size |
| `showIcon` | boolean | false | Show icon alongside label |
| `iconOnly` | boolean | false | Show only icon |

### Usage

```tsx
import { TaskStatusBadge } from "@/design-system/product";

<TaskStatusBadge statusKey={task.status} />
<TaskStatusBadge statusKey="in_progress" showIcon />
<TaskStatusBadge statusKey="done" iconOnly />
```

### Icons

- **todo** - Circle (gray)
- **in_progress** - PlayCircle (blue)
- **review** - Eye (yellow)
- **done** - CheckCircle (green)
- **blocked** - XCircle (red)

## BillingStatusBadge

Displays the billing status of a project.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `statusKey` | BillingStatusKey | - | Billing status key |
| `size` | "sm" \| "md" \| "lg" | "md" | Badge size |
| `showIcon` | boolean | false | Show icon alongside label |
| `iconOnly` | boolean | false | Show only icon |

### Usage

```tsx
import { BillingStatusBadge } from "@/design-system/product";

<BillingStatusBadge statusKey={project.billingStatus} />
<BillingStatusBadge statusKey="paid" showIcon />
<BillingStatusBadge statusKey="overdue" iconOnly />
```

### Icons

- **not_billed** - FileQuestion (gray)
- **pending** - Clock (yellow)
- **partial** - TrendingUp (blue)
- **paid** - CheckCircle2 (green)
- **overdue** - AlertCircle (red)
- **cancelled** - XCircle (gray)

## Creating New Product Components

1. Create file in `client/src/design-system/product/`
2. Import config helpers from `@shared/config`
3. Import semantic classes from `@shared/design/semantics`
4. Use base Badge or primitive components
5. Accept the domain key as primary prop
6. Include optional size, showIcon, iconOnly props
7. Add `data-testid` with pattern `badge-{type}-{key}`
8. Export from `client/src/design-system/product/index.ts`
