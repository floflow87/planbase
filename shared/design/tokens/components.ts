/**
 * Component-level Design Tokens
 * 
 * Centralized structural tokens for components.
 * These define the base classes for component structure (radius, spacing, typography).
 * 
 * Note: Actual size/spacing values are now defined in the component's cva() variants
 * to align with shadcn patterns and ensure consistency with Button sizing.
 */

/**
 * Badge structural tokens
 * Defines the base appearance independent of color/intent
 * 
 * @deprecated Use cva() variants in badge.tsx directly for size classes.
 * These are kept for reference and potential future CSS variable mapping.
 */
export const badgeTokens = {
  base: "inline-flex items-center whitespace-nowrap font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  
  radius: "rounded-md",
  
  border: "border",
  
  sizes: {
    sm: "text-[10px] min-h-5 px-1.5",
    md: "text-xs min-h-6 px-2.5",
    lg: "text-sm min-h-7 px-3",
  },
} as const;

/**
 * Get complete badge base classes (structural only, no colors)
 * @deprecated Prefer using Badge component directly with size prop
 */
export function getBadgeBaseClasses(size: keyof typeof badgeTokens.sizes = "md"): string {
  return `${badgeTokens.base} ${badgeTokens.radius} ${badgeTokens.border} ${badgeTokens.sizes[size]}`;
}

export type BadgeSize = keyof typeof badgeTokens.sizes;
