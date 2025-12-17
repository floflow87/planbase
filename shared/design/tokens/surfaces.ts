/**
 * Surface Design Tokens - Design System V1.3
 * 
 * Centralized tokens for surface backgrounds.
 * These ensure consistent surface colors across all components.
 * 
 * Light mode priority: White backgrounds for inputs and popovers
 * Dark mode: Appropriate dark surfaces that respect the theme
 */

export const surfaceTokens = {
  /**
   * Base surface - main page background
   */
  base: "bg-background",
  
  /**
   * Elevated surface - cards, modals
   */
  elevated: "bg-card dark:bg-card",
  
  /**
   * Input surface - form inputs, select triggers
   * White in light mode for clean appearance
   */
  input: "bg-white dark:bg-gray-900",
  
  /**
   * Popover surface - dropdowns, menus, popovers
   * White in light mode for clean appearance
   */
  popover: "bg-white dark:bg-gray-900",
  
  /**
   * Muted surface - subtle backgrounds
   */
  muted: "bg-muted dark:bg-muted",
} as const;

export type SurfaceKey = keyof typeof surfaceTokens;

/**
 * Get surface classes for a given surface type
 */
export function getSurfaceClasses(surface: SurfaceKey): string {
  return surfaceTokens[surface];
}

/**
 * Input-specific surface tokens
 */
export const inputSurfaceTokens = {
  /**
   * Default input background
   */
  background: surfaceTokens.input,
  
  /**
   * Input border color (uses CSS variable)
   */
  border: "border-input",
  
  /**
   * Input focus ring
   */
  focusRing: "focus:ring-2 focus:ring-ring focus:ring-offset-2",
} as const;

/**
 * Popover-specific surface tokens
 */
export const popoverSurfaceTokens = {
  /**
   * Popover background
   */
  background: surfaceTokens.popover,
  
  /**
   * Popover border
   */
  border: "border border-border dark:border-gray-700",
  
  /**
   * Popover shadow
   */
  shadow: "shadow-md",
  
  /**
   * Combined popover surface classes
   */
  combined: `${surfaceTokens.popover} border border-border dark:border-gray-700 shadow-md`,
} as const;

/**
 * Get complete surface classes for select/dropdown components
 */
export function getSelectSurfaceClasses(element: "trigger" | "content" | "item"): string {
  switch (element) {
    case "trigger":
      return `${surfaceTokens.input} ${inputSurfaceTokens.border}`;
    case "content":
      return popoverSurfaceTokens.combined;
    case "item":
      return surfaceTokens.popover;
    default:
      return surfaceTokens.base;
  }
}
