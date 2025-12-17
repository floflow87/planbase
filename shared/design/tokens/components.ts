/**
 * Component-level Design Tokens
 * 
 * Centralized structural tokens for components.
 * These define the base classes for component structure (radius, spacing, typography).
 */

/**
 * Badge structural tokens
 * Defines the base appearance independent of color/intent
 */
export const badgeTokens = {
  base: "inline-flex items-center whitespace-nowrap font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  
  radius: "rounded-md",
  
  border: "border",
  
  sizes: {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2.5 py-0.5",
    lg: "text-sm px-3 py-1",
  },
} as const;

/**
 * Get complete badge base classes (structural only, no colors)
 */
export function getBadgeBaseClasses(size: keyof typeof badgeTokens.sizes = "md"): string {
  return `${badgeTokens.base} ${badgeTokens.radius} ${badgeTokens.border} ${badgeTokens.sizes[size]}`;
}

export type BadgeSize = keyof typeof badgeTokens.sizes;
