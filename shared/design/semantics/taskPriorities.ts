/**
 * Task Priority Semantics - Design System V1
 * 
 * Maps task priority keys to design intents
 * Consumes config from shared/config/taskPriorities.ts
 */

import type { TaskPriorityKey } from "@shared/config";
import type { Intent } from "./intents";

/**
 * Map task priorities to semantic intents
 */
export const taskPriorityIntents: Record<TaskPriorityKey, Intent> = {
  critical: "danger",   // Urgent, needs immediate attention
  high: "warning",      // Important, should be prioritized
  medium: "info",       // Normal priority
  low: "neutral",       // Can wait
};

/**
 * Get the intent for a task priority
 */
export function getTaskPriorityIntent(key: TaskPriorityKey | string | null): Intent {
  if (!key) return "neutral";
  return taskPriorityIntents[key as TaskPriorityKey] ?? "neutral";
}

/**
 * Extended color mapping with Tailwind classes
 */
export const taskPriorityColors: Record<TaskPriorityKey, {
  bg: string;
  text: string;
  border: string;
  dark: string;
}> = {
  critical: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
    dark: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  high: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
    dark: "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
  medium: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    dark: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  low: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dark: "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
};

/**
 * Get Tailwind classes for a task priority badge
 */
export function getTaskPriorityClasses(key: TaskPriorityKey | string | null): string {
  if (!key) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  const colors = taskPriorityColors[key as TaskPriorityKey];
  if (!colors) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.dark}`;
}
