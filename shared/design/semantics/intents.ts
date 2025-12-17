/**
 * Intent System - Design System V1
 * 
 * Maps semantic intents to visual styling
 * Intents are the bridge between business meaning and design tokens
 */

export type Intent = 
  | "success"   // Positive states (completed, approved, active)
  | "warning"   // Caution states (pending, at-risk, needs attention)
  | "danger"    // Error/critical states (failed, overdue, blocked)
  | "info"      // Informational (in progress, neutral updates)
  | "neutral"   // Default/inactive states
  | "primary"   // Brand/CTA emphasis
  | "accent";   // Secondary emphasis (cyan)

export type IntentVariant = "solid" | "soft" | "outline" | "ghost";
export type IntentSize = "sm" | "md" | "lg";

/**
 * Tailwind class mappings for each intent
 * These provide consistent styling across light/dark modes
 */
export const intentStyles: Record<Intent, {
  solid: { bg: string; text: string; border: string };
  soft: { bg: string; text: string; border: string };
  outline: { bg: string; text: string; border: string };
  ghost: { bg: string; text: string; border: string };
}> = {
  success: {
    solid: {
      bg: "bg-green-600 dark:bg-green-500",
      text: "text-white dark:text-white",
      border: "border-green-600 dark:border-green-500",
    },
    soft: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
      border: "border-green-200 dark:border-green-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-green-700 dark:text-green-300",
      border: "border-green-300 dark:border-green-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-green-100 dark:hover:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
      border: "border-transparent",
    },
  },
  warning: {
    solid: {
      bg: "bg-yellow-500 dark:bg-yellow-500",
      text: "text-white dark:text-white",
      border: "border-yellow-500 dark:border-yellow-500",
    },
    soft: {
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-300",
      border: "border-yellow-200 dark:border-yellow-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-yellow-700 dark:text-yellow-300",
      border: "border-yellow-300 dark:border-yellow-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-300",
      border: "border-transparent",
    },
  },
  danger: {
    solid: {
      bg: "bg-red-600 dark:bg-red-500",
      text: "text-white dark:text-white",
      border: "border-red-600 dark:border-red-500",
    },
    soft: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-300 dark:border-red-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-red-100 dark:hover:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-transparent",
    },
  },
  info: {
    solid: {
      bg: "bg-blue-600 dark:bg-blue-500",
      text: "text-white dark:text-white",
      border: "border-blue-600 dark:border-blue-500",
    },
    soft: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-300 dark:border-blue-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-blue-100 dark:hover:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-transparent",
    },
  },
  neutral: {
    solid: {
      bg: "bg-gray-600 dark:bg-gray-500",
      text: "text-white dark:text-white",
      border: "border-gray-600 dark:border-gray-500",
    },
    soft: {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-700 dark:text-gray-300",
      border: "border-gray-200 dark:border-gray-700",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-gray-700 dark:text-gray-300",
      border: "border-gray-300 dark:border-gray-600",
    },
    ghost: {
      bg: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
      text: "text-gray-700 dark:text-gray-300",
      border: "border-transparent",
    },
  },
  primary: {
    solid: {
      bg: "bg-violet-600 dark:bg-violet-500",
      text: "text-white dark:text-white",
      border: "border-violet-600 dark:border-violet-500",
    },
    soft: {
      bg: "bg-violet-100 dark:bg-violet-900/30",
      text: "text-violet-700 dark:text-violet-300",
      border: "border-violet-200 dark:border-violet-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-violet-700 dark:text-violet-300",
      border: "border-violet-300 dark:border-violet-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-violet-100 dark:hover:bg-violet-900/30",
      text: "text-violet-700 dark:text-violet-300",
      border: "border-transparent",
    },
  },
  accent: {
    solid: {
      bg: "bg-cyan-600 dark:bg-cyan-500",
      text: "text-white dark:text-white",
      border: "border-cyan-600 dark:border-cyan-500",
    },
    soft: {
      bg: "bg-cyan-100 dark:bg-cyan-900/30",
      text: "text-cyan-700 dark:text-cyan-300",
      border: "border-cyan-200 dark:border-cyan-800",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-cyan-700 dark:text-cyan-300",
      border: "border-cyan-300 dark:border-cyan-700",
    },
    ghost: {
      bg: "bg-transparent hover:bg-cyan-100 dark:hover:bg-cyan-900/30",
      text: "text-cyan-700 dark:text-cyan-300",
      border: "border-transparent",
    },
  },
};

/**
 * Get Tailwind classes for an intent/variant combination
 */
export function getIntentClasses(
  intent: Intent,
  variant: IntentVariant = "soft"
): string {
  const style = intentStyles[intent][variant];
  return `${style.bg} ${style.text} ${style.border}`;
}

/**
 * Get individual style properties for an intent/variant
 */
export function getIntentStyle(
  intent: Intent,
  variant: IntentVariant = "soft"
) {
  return intentStyles[intent][variant];
}
