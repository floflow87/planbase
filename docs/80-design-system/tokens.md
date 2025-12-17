# Design Tokens

Foundational design values that form the basis of the design system.

## Colors

Located at `shared/design/tokens/colors.ts`

### Color Scales

| Scale | Purpose | Hex (500) |
|-------|---------|-----------|
| `primary` | Brand/CTA (Violet) | #7C3AED |
| `accent` | Secondary emphasis (Cyan) | #06B6D4 |
| `success` | Positive states (Green) | #10B981 |
| `warning` | Caution states (Amber) | Amber-500 |
| `danger` | Error/critical (Red) | Red-500 |
| `info` | Informational (Blue) | Blue-500 |
| `neutral` | Default/inactive (Gray) | Gray-500 |

### Usage

```typescript
import { colors, getColor, getColorHsl } from "@shared/design/tokens";

// Access raw HSL values
const primaryHsl = colors.primary[500]; // "263 70% 50%"

// Get as hsl() function
const cssColor = getColorHsl("success", 500); // "hsl(160 84% 39%)"
```

## Spacing

Located at `shared/design/tokens/spacing.ts`

### Scale

Based on 4px base unit, compatible with Tailwind defaults:

| Key | Value | Pixels |
|-----|-------|--------|
| 1 | 0.25rem | 4px |
| 2 | 0.5rem | 8px |
| 3 | 0.75rem | 12px |
| 4 | 1rem | 16px |
| 6 | 1.5rem | 24px |
| 8 | 2rem | 32px |

### Semantic Spacing

```typescript
import { semanticSpacing } from "@shared/design/tokens";

semanticSpacing.component.sm  // 8px - small padding
semanticSpacing.container.md  // 24px - medium container
semanticSpacing.stack.lg      // 24px - large gap
```

## Border Radius

Located at `shared/design/tokens/radius.ts`

| Key | Value | Use Case |
|-----|-------|----------|
| `sm` | 0.25rem | Subtle rounding |
| `md` | 0.375rem | Buttons, badges, inputs |
| `lg` | 0.5rem | Cards, modals |
| `full` | 9999px | Pills, avatars |

## Typography

Located at `shared/design/tokens/typography.ts`

### Font Families

- **Poppins** - Headings
- **Inter** - Body text
- **JetBrains Mono** - Code

### Font Sizes

| Key | Value | Use |
|-----|-------|-----|
| `xs` | 0.75rem | Captions, labels |
| `sm` | 0.875rem | Small text |
| `base` | 1rem | Body text |
| `lg` | 1.125rem | Large body |
| `xl`+ | 1.25rem+ | Headings |

## Shadows

Located at `shared/design/tokens/shadows.ts`

| Key | Use Case |
|-----|----------|
| `xs` | Subtle elevation, buttons |
| `sm` | Cards, containers |
| `md` | Dropdowns, elevated elements |
| `lg` | Modals, popovers |
| `xl` | Floating elements |

## Adding New Tokens

1. Add to the appropriate file in `shared/design/tokens/`
2. Export from `shared/design/tokens/index.ts`
3. Update semantic mappings if needed
4. Document the new token
