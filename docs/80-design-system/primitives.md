# UI Primitives

Atomic, reusable components with intent-based styling.

## Design System V1.3 Updates

- **Surfaces**: All dropdowns/selects use white backgrounds
- **Button**: Extended with `intent` and `tone` props
- **Alert**: Extended with `intent` and `tone` props
- **Toast**: Added `warning` and `info` variants

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

## Button (shadcn with Intent Support)

The shadcn Button component has been extended to support semantic intents directly.

Located at `client/src/components/ui/button.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `intent` | Intent | - | Semantic intent (success, warning, danger, info, neutral, primary, accent) |
| `tone` | IntentVariant | "solid" | Visual tone (solid, soft, outline, ghost) - only when intent is provided |
| `size` | string | "default" | Size (default, sm, lg, icon) |
| `variant` | string | "default" | Legacy shadcn variant (only when intent is not provided) |

### Usage

```tsx
import { Button } from "@/components/ui/button";

// Intent-based (recommended for semantic actions)
<Button intent="success">Save</Button>
<Button intent="danger" tone="outline">Delete</Button>
<Button intent="warning" tone="soft">Warning Action</Button>

// Legacy shadcn variants (still supported)
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
```

## Alert (shadcn with Intent Support)

The shadcn Alert component has been extended to support semantic intents directly.

Located at `client/src/components/ui/alert.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `intent` | Intent | - | Semantic intent (success, warning, danger, info, neutral, primary, accent) |
| `tone` | IntentVariant | "soft" | Visual tone (solid, soft, outline, ghost) - only when intent is provided |
| `variant` | string | "default" | Legacy shadcn variant (only when intent is not provided) |

### Usage

```tsx
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Intent-based (recommended)
<Alert intent="success">
  <AlertTitle>Success!</AlertTitle>
  <AlertDescription>Your changes have been saved.</AlertDescription>
</Alert>

<Alert intent="warning" tone="outline">
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>This action cannot be undone.</AlertDescription>
</Alert>

// Legacy shadcn variants (still supported)
<Alert variant="default">Default Alert</Alert>
<Alert variant="destructive">Destructive Alert</Alert>
```

## Surface Tokens (V1.3)

Centralized surface tokens for consistent backgrounds.

Located at `shared/design/tokens/surfaces.ts`

### Available Surfaces

| Surface | Description | Light Mode | Dark Mode |
|---------|-------------|------------|-----------|
| `base` | Main page background | bg-background | bg-background |
| `elevated` | Cards, modals | bg-card | bg-card |
| `input` | Form inputs, select triggers | bg-white | bg-gray-900 |
| `popover` | Dropdowns, menus | bg-white | bg-gray-900 |
| `muted` | Subtle backgrounds | bg-muted | bg-muted |

### Usage

```tsx
import { surfaceTokens, getSurfaceClasses } from "@shared/design/tokens";

// Get surface classes
const inputBg = surfaceTokens.input; // "bg-white dark:bg-gray-900"
const popoverBg = getSurfaceClasses("popover"); // "bg-white dark:bg-gray-900"
```

### Components with White Backgrounds

All dropdown/select components use white backgrounds (V1.3):

- `Select` (trigger + content)
- `DropdownMenu` (content + sub-content)
- `Popover` (content)
- `Command` (wrapper + input)

## Creating New Primitives

1. Create file in `client/src/design-system/primitives/`
2. Accept `intent`, `variant`, `size` props where appropriate
3. Use `forwardRef` for ref forwarding
4. Include `data-testid` attributes
5. Export from `client/src/design-system/primitives/index.ts`
6. Document in this file
