/**
 * Project Stage Semantics - Design System V1
 * 
 * Maps project stage keys to design intents
 * Consumes config from shared/config/projectStages.ts
 */

import type { ProjectStageKey } from "@shared/config";
import type { Intent } from "./intents";

/**
 * Map project stages to semantic intents
 * This determines how each stage is visually represented
 */
export const projectStageIntents: Record<ProjectStageKey, Intent> = {
  prospection: "warning",   // Early stage, needs attention
  signe: "primary",         // Contracted, important milestone
  en_cours: "info",         // Active work in progress
  livre: "accent",          // Delivered, pending completion
  termine: "success",       // Completed successfully
};

/**
 * Get the intent for a project stage
 */
export function getProjectStageIntent(key: ProjectStageKey | string | null): Intent {
  if (!key) return "neutral";
  return projectStageIntents[key as ProjectStageKey] ?? "neutral";
}

/**
 * Extended color mapping with Tailwind classes for backwards compatibility
 * These match the existing colorClass/textColorClass/darkColorClass pattern
 */
export const projectStageColors: Record<ProjectStageKey, {
  bg: string;
  text: string;
  border: string;
  dark: string;
}> = {
  prospection: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dark: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  },
  signe: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
    dark: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  en_cours: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    dark: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  livre: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    border: "border-teal-200",
    dark: "dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
  },
  termine: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    dark: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
};

/**
 * Get Tailwind classes for a project stage badge
 */
export function getProjectStageClasses(key: ProjectStageKey | string | null): string {
  if (!key) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  const colors = projectStageColors[key as ProjectStageKey];
  if (!colors) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.dark}`;
}
