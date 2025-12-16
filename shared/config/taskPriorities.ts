/**
 * Task Priorities Configuration
 * Centralized source of truth for task priority definitions
 */

export const TASK_PRIORITIES = [
  { key: "low", label: "Basse", order: 10, colorClass: "bg-green-100 border-green-200", textColorClass: "text-green-700", darkColorClass: "dark:bg-green-900/30 dark:text-green-300", borderAccent: "border-l-2 border-green-500" },
  { key: "medium", label: "Moyenne", order: 20, colorClass: "bg-yellow-100 border-yellow-200", textColorClass: "text-yellow-700", darkColorClass: "dark:bg-yellow-900/30 dark:text-yellow-300", borderAccent: "border-l-2 border-yellow-500" },
  { key: "high", label: "Haute", order: 30, colorClass: "bg-red-100 border-red-200", textColorClass: "text-red-700", darkColorClass: "dark:bg-red-900/30 dark:text-red-300", borderAccent: "border-l-2 border-red-500" },
] as const;

export type TaskPriorityKey = typeof TASK_PRIORITIES[number]["key"];

export const taskPriorityByKey = Object.fromEntries(
  TASK_PRIORITIES.map(p => [p.key, p])
) as Record<TaskPriorityKey, typeof TASK_PRIORITIES[number]>;

export const taskPriorityKeys = TASK_PRIORITIES.map(p => p.key);

export function getTaskPriorityLabel(key: TaskPriorityKey | string | null): string {
  if (!key) return "Non définie";
  return taskPriorityByKey[key as TaskPriorityKey]?.label ?? key;
}

export function getTaskPriorityColorClass(key: TaskPriorityKey | string | null): string {
  if (!key) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  const priority = taskPriorityByKey[key as TaskPriorityKey];
  if (!priority) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  return `${priority.colorClass} ${priority.textColorClass} ${priority.darkColorClass}`;
}

export function getTaskPriorityColorWithBorder(key: TaskPriorityKey | string | null): string {
  if (!key) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  const priority = taskPriorityByKey[key as TaskPriorityKey];
  if (!priority) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  return `${priority.colorClass} ${priority.textColorClass} ${priority.darkColorClass} ${priority.borderAccent}`;
}

export function getTaskPriorityOrder(key: TaskPriorityKey | string | null): number {
  if (!key) return 0;
  return taskPriorityByKey[key as TaskPriorityKey]?.order ?? 0;
}

export function getTaskPriorityBadgeClass(key: TaskPriorityKey | string | null): string {
  if (!key) return "bg-gray-100 text-gray-700 border-gray-200";
  const priority = taskPriorityByKey[key as TaskPriorityKey];
  if (!priority) return "bg-gray-100 text-gray-700 border-gray-200";
  return `${priority.colorClass} ${priority.textColorClass}`;
}
