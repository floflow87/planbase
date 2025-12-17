# Design System Do's and Don'ts

Best practices for maintaining consistency across the codebase.

## Do's

### Use Badge with Intent (V1.2+)

```tsx
// DO: Use Badge with intent prop directly
import { Badge } from "@/components/ui/badge";

<Badge intent="success">Completed</Badge>
<Badge intent="warning" tone="outline">Pending</Badge>
<Badge intent="danger" size="sm">Critical</Badge>
```

**Why:** This aligns with shadcn patterns while leveraging our intent system.

### Use Product Components

```tsx
// DO: Use centralized badge components for business entities
<ProjectStageBadge stageKey={project.stage} />
<TaskStatusBadge statusKey={task.status} />
<TaskPriorityBadge priorityKey={task.priority} />
<BillingStatusBadge statusKey={project.billingStatus} />
```

### Use Toast Helpers

```tsx
// DO: Use typed toast helpers
import { toastSuccess, toastError, toastInfo } from "@/design-system/feedback";

toastSuccess({ title: "Saved!" });
toastError({ title: "Failed to save" });
toastInfo({ title: "Processing..." });
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
import { getIntentClasses } from "@shared/design/semantics";

const classes = getIntentClasses("success", "soft");
```

## Don'ts

### Don't Hardcode Colors in Badges

```tsx
// DON'T: Hardcode status colors
<Badge className="bg-green-100 text-green-700">Terminé</Badge>

// DO: Use intent or product component
<Badge intent="success">Terminé</Badge>
// or
<TaskStatusBadge statusKey="done" />
```

### Don't Use className for Toast Success Styling

```tsx
// DON'T: Hardcode toast colors
toast({ 
  title: "Done", 
  className: "bg-green-500 text-white" // ❌ 
});

// DO: Use toastSuccess helper
toastSuccess({ title: "Done" }); // ✅
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
<Badge intent="warning">En attente</Badge>
// or
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

// DO: Use consistent intent
<Badge intent="success">
```

### Don't Skip data-testid

```tsx
// DON'T: Forget test IDs on interactive elements
<button onClick={save}>Save</button>

// DO: Include test IDs
<button onClick={save} data-testid="button-save">Save</button>
```

## shadcn Alignment Note (V1.2)

We extended the shadcn Badge component to support our intent system. This approach:

1. **Preserves shadcn patterns** - Legacy variants (default, secondary, destructive, outline) still work
2. **Adds intent support** - New `intent` and `tone` props for semantic styling
3. **Uses centralized tokens** - Structural classes come from `shared/design/tokens/components.ts`
4. **Consumes semantics layer** - Intent colors from `shared/design/semantics/intents.ts`

When to use what:
- `<Badge intent="...">` - For semantic meaning (success/warning/danger/etc.)
- `<Badge variant="...">` - For non-semantic styling (secondary, outline)
- `<ProjectStageBadge>` etc. - For business entities with automatic label/intent mapping

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
