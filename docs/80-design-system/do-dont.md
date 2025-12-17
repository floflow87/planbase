# Design System Do's and Don'ts

Best practices for maintaining consistency across the codebase.

## Do's

### Use Product Components

```tsx
// DO: Use centralized badge components
<ProjectStageBadge stageKey={project.stage} />
<TaskStatusBadge statusKey={task.status} />
```

### Use Toast Helpers

```tsx
// DO: Use typed toast helpers
import { toastSuccess, toastError } from "@/design-system/feedback";

toastSuccess({ title: "Saved!" });
toastError({ title: "Failed to save" });
```

### Use Intent-Based Styling

```tsx
// DO: Use semantic intents
<BadgeIntent intent="success">Completed</BadgeIntent>
<BadgeIntent intent="warning">Pending</BadgeIntent>
```

### Get Labels from Config

```tsx
// DO: Use config helpers
import { getProjectStageLabel } from "@shared/config";

const label = getProjectStageLabel(stage);
```

### Use Semantic Classes from Design System

```tsx
// DO: Use semantic class getters
import { getTaskStatusClasses } from "@shared/design/semantics";

const classes = getTaskStatusClasses("done");
```

## Don'ts

### Don't Hardcode Colors in Pages

```tsx
// DON'T: Hardcode status colors
<Badge className="bg-green-100 text-green-700">Terminé</Badge>

// DO: Use product component
<ProjectStageBadge stageKey="termine" />
```

### Don't Hardcode Labels

```tsx
// DON'T: Hardcode labels
<span>{status === "done" ? "Terminé" : "En cours"}</span>

// DO: Use config helpers
<span>{getTaskStatusLabel(status)}</span>
```

### Don't Create Custom Badge Styles for Statuses

```tsx
// DON'T: Create one-off badge styles
<Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
  En attente
</Badge>

// DO: Use design system
<BillingStatusBadge statusKey="pending" />
```

### Don't Use Raw Colors for Intent

```tsx
// DON'T: Use raw colors for semantic meaning
<div className="text-red-500">Error!</div>

// DO: Use intent-based styling or toast
toastError({ title: "Error!" });
```

### Don't Mix Intent Systems

```tsx
// DON'T: Mix different color systems
<Badge className="bg-green-100 border-emerald-200 text-teal-700">

// DO: Use consistent color scales
<Badge className="bg-green-100 border-green-200 text-green-700">
// Or better: use product components
```

### Don't Skip data-testid

```tsx
// DON'T: Forget test IDs on interactive elements
<button onClick={save}>Save</button>

// DO: Include test IDs
<button onClick={save} data-testid="button-save">Save</button>
```

## Migration Tips

1. **Start with high-visibility areas** - Dashboard, project list, task list
2. **Replace one badge type at a time** - All project stages, then priorities, etc.
3. **Search for color patterns** - `bg-green-`, `bg-red-`, `bg-yellow-`
4. **Use audit script** - Run `npx tsx scripts/audit-design-drift.ts`
5. **Don't refactor everything at once** - Progressive migration is safer

## Adding New Statuses

1. Add to config in `shared/config/`
2. Add intent mapping in `shared/design/semantics/`
3. Add color classes for the new key
4. Update product component if needed
5. Components will auto-pick up new values
