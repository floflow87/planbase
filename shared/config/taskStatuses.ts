/**
 * Task Statuses Configuration
 * Centralized source of truth for task status definitions
 */

export const TASK_STATUSES = [
  { key: "todo", label: "À faire", order: 10, colorClass: "bg-gray-100 border-gray-200", textColorClass: "text-gray-700", darkColorClass: "dark:bg-gray-800/30 dark:text-gray-300" },
  { key: "in_progress", label: "En cours", order: 20, colorClass: "bg-blue-100 border-blue-200", textColorClass: "text-blue-700", darkColorClass: "dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "review", label: "En révision", order: 30, colorClass: "bg-purple-100 border-purple-200", textColorClass: "text-purple-700", darkColorClass: "dark:bg-purple-900/30 dark:text-purple-300" },
  { key: "done", label: "Terminé", order: 40, colorClass: "bg-green-100 border-green-200", textColorClass: "text-green-700", darkColorClass: "dark:bg-green-900/30 dark:text-green-300", isTerminal: true },
] as const;

export type TaskStatusKey = typeof TASK_STATUSES[number]["key"];

export const taskStatusByKey = Object.fromEntries(
  TASK_STATUSES.map(s => [s.key, s])
) as Record<TaskStatusKey, typeof TASK_STATUSES[number]>;

export const taskStatusKeys = TASK_STATUSES.map(s => s.key);

export function getTaskStatusLabel(key: TaskStatusKey | string | null): string {
  if (!key) return "Non défini";
  return taskStatusByKey[key as TaskStatusKey]?.label ?? key;
}

export function getTaskStatusColorClass(key: TaskStatusKey | string | null): string {
  if (!key) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  const status = taskStatusByKey[key as TaskStatusKey];
  if (!status) return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";
  return `${status.colorClass} ${status.textColorClass} ${status.darkColorClass}`;
}

export function getTaskStatusOrder(key: TaskStatusKey | string | null): number {
  if (!key) return 0;
  return taskStatusByKey[key as TaskStatusKey]?.order ?? 0;
}

export function isTerminalStatus(key: TaskStatusKey | string | null): boolean {
  if (!key) return false;
  return taskStatusByKey[key as TaskStatusKey]?.isTerminal === true;
}

export function getStatusFromColumnName(columnName: string): TaskStatusKey {
  const lowerName = columnName.toLowerCase();
  
  if (lowerName.includes("à faire") || lowerName.includes("todo") || lowerName.includes("backlog")) {
    return "todo";
  } else if (lowerName.includes("terminé") || lowerName.includes("done") || lowerName.includes("complété")) {
    return "done";
  } else if (lowerName.includes("en cours") || lowerName.includes("progress") || lowerName.includes("doing")) {
    return "in_progress";
  } else if (lowerName.includes("review") || lowerName.includes("révision") || lowerName.includes("relecture")) {
    return "review";
  }
  return "in_progress";
}
