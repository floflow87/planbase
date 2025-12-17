/**
 * Task Status Semantics - Design System V1
 * 
 * Maps task status keys to design intents
 * Consumes config from shared/config/taskStatuses.ts
 */

import type { TaskStatusKey } from "@shared/config";
import type { Intent } from "./intents";

/**
 * Map task statuses to semantic intents
 */
export const taskStatusIntents: Record<TaskStatusKey, Intent> = {
  todo: "neutral",        // Not started
  in_progress: "info",    // Active work
  review: "warning",      // Needs review/attention
  done: "success",        // Completed
  blocked: "danger",      // Blocked, needs intervention
};

/**
 * Get the intent for a task status
 */
export function getTaskStatusIntent(key: TaskStatusKey | string | null): Intent {
  if (!key) return "neutral";
  return taskStatusIntents[key as TaskStatusKey] ?? "neutral";
}

/**
 * Extended color mapping with Tailwind classes
 */
export const taskStatusColors: Record<TaskStatusKey, {
  bg: string;
  text: string;
  border: string;
  dark: string;
}> = {
  todo: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dark: "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  in_progress: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    dark: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  review: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dark: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  },
  done: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    dark: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  blocked: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
    dark: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
};

/**
 * Get Tailwind classes for a task status badge
 */
export function getTaskStatusClasses(key: TaskStatusKey | string | null): string {
  if (!key) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  const colors = taskStatusColors[key as TaskStatusKey];
  if (!colors) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.dark}`;
}
