# UI Primitives

Atomic, reusable components with intent-based styling.

## Badge (shadcn with Intent Support)

The shadcn Badge component has been extended to support semantic intents directly.

Located at `client/src/components/ui/badge.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `intent` | Intent | - | Semantic intent (success, warning, danger, info, neutral, primary, accent) |
| `tone` | IntentVariant | "soft" | Visual tone (solid, soft, outline, ghost) - only when intent is provided |
| `size` | BadgeSize | "md" | Size (sm, md, lg) |
| `variant` | string | "default" | Legacy shadcn variant (only when intent is not provided) |

### Usage

```tsx
import { Badge } from "@/components/ui/badge";

// Intent-based (recommended)
<Badge intent="success">Completed</Badge>
<Badge intent="warning" tone="outline">Pending</Badge>
<Badge intent="danger" size="sm">Critical</Badge>

// Legacy shadcn variants (still supported)
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
```

### Intent + Tone Combinations

| Intent | soft (default) | solid | outline | ghost |
|--------|----------------|-------|---------|-------|
| success | Light green bg | Green bg, white text | Green border | Transparent |
| warning | Light yellow bg | Yellow bg, white text | Yellow border | Transparent |
| danger | Light red bg | Red bg, white text | Red border | Transparent |
| info | Light blue bg | Blue bg, white text | Blue border | Transparent |
| neutral | Light gray bg | Gray bg, white text | Gray border | Transparent |
| primary | Light violet bg | Violet bg, white text | Violet border | Transparent |
| accent | Light cyan bg | Cyan bg, white text | Cyan border | Transparent |

## BadgeIntent (Legacy Wrapper)

> **Note:** For new code, prefer using `<Badge intent="...">` directly.

A thin wrapper around Badge for backward compatibility.

Located at `client/src/design-system/primitives/BadgeIntent.tsx`

### Props

Same as Badge with intent, but uses `variant` instead of `tone` for the visual style.

### Usage

```tsx
import { BadgeIntent } from "@/design-system/primitives";

// These are equivalent:
<BadgeIntent intent="success" variant="soft">Done</BadgeIntent>
<Badge intent="success" tone="soft">Done</Badge>
```

## Design Tokens for Badge

Structural tokens are centralized in `shared/design/tokens/components.ts`:

```typescript
import { badgeTokens, getBadgeBaseClasses } from "@shared/design/tokens";

// badgeTokens.base - base structural classes
// badgeTokens.radius - border radius
// badgeTokens.border - border style
// badgeTokens.sizes.sm/md/lg - size-specific classes
```

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
