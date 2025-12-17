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

## Surfaces & Dropdowns (V1.3)

### Do: Use White Backgrounds for Dropdowns

All select/dropdown components should have white backgrounds by default.

```tsx
// DO: Use the default surface (already white in V1.3)
<Select>
  <SelectTrigger>Pick option</SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
  </SelectContent>
</Select>
```

### Don't: Override Dropdown Backgrounds

```tsx
// DON'T: Override with custom backgrounds
<SelectContent className="bg-gray-100">...</SelectContent>

// DON'T: Use bg-popover (deprecated for dropdowns)
<SelectTrigger className="bg-popover">...</SelectTrigger>
```

## Button Intent (V1.3)

### Do: Use Button with Intent for Semantic Actions

```tsx
// DO: Use intent for semantic meaning
<Button intent="success">Save</Button>
<Button intent="danger" tone="outline">Delete</Button>
<Button intent="warning">Proceed with Caution</Button>
```

### Don't: Hardcode Button Colors

```tsx
// DON'T: Hardcode colors
<Button className="bg-green-500 text-white">Save</Button>

// DO: Use intent
<Button intent="success">Save</Button>
```

## Alert Intent (V1.3)

### Do: Use Alert with Intent

```tsx
// DO: Use intent for semantic alerts
<Alert intent="success">Operation completed</Alert>
<Alert intent="warning">Please review before proceeding</Alert>
<Alert intent="danger">This action is irreversible</Alert>
```

### Don't: Hardcode Alert Colors

```tsx
// DON'T: Hardcode colors
<Alert className="bg-green-100 border-green-200">Success!</Alert>

// DO: Use intent
<Alert intent="success">Success!</Alert>
```

## Toast Variants (V1.3)

### Do: Use Toast Helpers

```tsx
// DO: Use typed toast helpers (all colors are automatic)
import { toastSuccess, toastError, toastWarning, toastInfo } from "@/design-system/feedback";

toastSuccess({ title: "Saved!" });           // Green
toastError({ title: "Failed to save" });     // Red
toastWarning({ title: "Please review" });    // Yellow
toastInfo({ title: "Processing..." });       // Blue
```

### Don't: Use Direct variant Calls

```tsx
// DON'T: Use variant directly (less discoverable)
toast({ variant: "success", title: "Saved!" });

// DO: Use helper functions
toastSuccess({ title: "Saved!" });
```

## shadcn Alignment Note (V1.2 → V1.3)

We extended shadcn components (Badge, Button, Alert, Toast) to support our intent system. This approach:

1. **Preserves shadcn patterns** - Legacy variants (default, secondary, destructive, outline) still work
2. **Adds intent support** - New `intent` and `tone` props for semantic styling
3. **Uses centralized tokens** - Structural classes come from `shared/design/tokens/`
4. **Consumes semantics layer** - Intent colors from `shared/design/semantics/intents.ts`
5. **White surfaces (V1.3)** - All dropdowns use white backgrounds in light mode

When to use what:
- `<Badge intent="...">` - For semantic meaning (success/warning/danger/etc.)
- `<Button intent="...">` - For semantic actions (save=success, delete=danger)
- `<Alert intent="...">` - For semantic messages
- `<Badge variant="...">` / `<Button variant="...">` - For non-semantic styling
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
