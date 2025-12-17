# UI Primitives

Atomic, reusable components with intent-based styling.

## BadgeIntent

A badge component that accepts semantic intents.

Located at `client/src/design-system/primitives/BadgeIntent.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `intent` | Intent | "neutral" | Semantic intent (success, warning, etc.) |
| `variant` | IntentVariant | "soft" | Visual variant (solid, soft, outline, ghost) |
| `size` | IntentSize | "md" | Size (sm, md, lg) |
| `children` | ReactNode | - | Badge content |
| `className` | string | - | Additional classes |

### Usage

```tsx
import { BadgeIntent } from "@/design-system/primitives";

// Basic usage
<BadgeIntent intent="success">Completed</BadgeIntent>

// With variant
<BadgeIntent intent="warning" variant="outline">Pending</BadgeIntent>

// With size
<BadgeIntent intent="danger" size="sm">Critical</BadgeIntent>

// Combined
<BadgeIntent intent="info" variant="solid" size="lg">
  In Progress
</BadgeIntent>
```

### Intent + Variant Combinations

| Intent | soft (default) | solid | outline | ghost |
|--------|----------------|-------|---------|-------|
| success | Light green bg | Green bg, white text | Green border | Transparent |
| warning | Light yellow bg | Yellow bg, white text | Yellow border | Transparent |
| danger | Light red bg | Red bg, white text | Red border | Transparent |
| info | Light blue bg | Blue bg, white text | Blue border | Transparent |
| neutral | Light gray bg | Gray bg, white text | Gray border | Transparent |

## Utilities

### cn (Class Names)

Re-export of the utility for combining class names.

```typescript
import { cn } from "@/design-system/primitives";

const classes = cn("base-class", condition && "conditional-class", className);
```

### cxIf

Conditional class helper.

```typescript
import { cxIf } from "@/design-system/primitives";

// Returns classes only if condition is true
const classes = cxIf(isActive, "bg-primary text-white");
```

### cxVariant

Variant-based class selector.

```typescript
import { cxVariant } from "@/design-system/primitives";

const sizeClass = cxVariant(size, {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
});
```

## Creating New Primitives

1. Create file in `client/src/design-system/primitives/`
2. Accept `intent`, `variant`, `size` props where appropriate
3. Use `forwardRef` for ref forwarding
4. Include `data-testid` attributes
5. Export from `client/src/design-system/primitives/index.ts`
6. Document in this file
