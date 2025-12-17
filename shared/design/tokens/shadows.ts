/**
 * Shadow Tokens - Design System V1
 * 
 * Elevation levels for depth and hierarchy
 * Use sparingly per design guidelines
 */

export const shadows = {
  none: "none",
  
  // Subtle shadows for slight elevation
  xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  
  // Default shadow for cards and containers
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  
  // Medium shadow for elevated elements
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  
  // Large shadow for modals and popovers
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  
  // Extra large for floating elements
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  
  // Maximum elevation
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  
  // Inner shadow (for pressed states)
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
} as const;

// Semantic shadow aliases
export const semanticShadows = {
  card: shadows.sm,
  cardHover: shadows.md,
  modal: shadows.lg,
  dropdown: shadows.md,
  popover: shadows.md,
  toast: shadows.lg,
  button: shadows.xs,
  buttonHover: shadows.sm,
} as const;

export type ShadowKey = keyof typeof shadows;
export type SemanticShadowKey = keyof typeof semanticShadows;
