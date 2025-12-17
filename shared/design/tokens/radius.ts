/**
 * Border Radius Tokens - Design System V1
 * 
 * Consistent corner rounding scale
 * Use sm/md for most UI elements per guidelines
 */

export const radius = {
  none: "0",
  sm: "0.25rem",    // 4px - subtle rounding
  md: "0.375rem",   // 6px - default for most UI (buttons, badges, inputs)
  lg: "0.5rem",     // 8px - cards, modals
  xl: "0.75rem",    // 12px - larger cards
  "2xl": "1rem",    // 16px - prominent cards
  "3xl": "1.5rem",  // 24px - large containers
  full: "9999px",   // pill/circle shape
} as const;

// Semantic radius aliases
export const semanticRadius = {
  button: radius.md,
  badge: radius.md,
  input: radius.md,
  card: radius.lg,
  modal: radius.lg,
  avatar: radius.full,
  pill: radius.full,
} as const;

export type RadiusKey = keyof typeof radius;
export type SemanticRadiusKey = keyof typeof semanticRadius;
