/**
 * Class Name Utility - Design System V1
 * 
 * Utility for combining class names safely
 * Re-exports cn from lib/utils for convenience
 */

import { cn } from "@/lib/utils";

export { cn };

/**
 * Conditional class helper
 * Returns classes only if condition is true
 */
export function cxIf(condition: boolean, classes: string): string {
  return condition ? classes : "";
}

/**
 * Create a variant-based class selector
 */
export function cxVariant<T extends string>(
  value: T,
  variants: Record<T, string>,
  fallback = ""
): string {
  return variants[value] ?? fallback;
}
