/**
 * Project Stages Configuration
 * Centralized source of truth for project stage definitions
 */

export const PROJECT_STAGES = [
  { key: "prospection", label: "Prospection", order: 10, colorClass: "bg-yellow-100 border-yellow-200", textColorClass: "text-yellow-700", darkColorClass: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" },
  { key: "signe", label: "Signé", order: 20, colorClass: "bg-purple-100 border-purple-200", textColorClass: "text-purple-700", darkColorClass: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  { key: "en_cours", label: "En cours", order: 30, colorClass: "bg-blue-100 border-blue-200", textColorClass: "text-blue-700", darkColorClass: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "livre", label: "Livré", order: 40, colorClass: "bg-cyan-100 border-cyan-200", textColorClass: "text-cyan-700", darkColorClass: "dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800" },
  { key: "termine", label: "Terminé", order: 50, colorClass: "bg-green-100 border-green-200", textColorClass: "text-green-700", darkColorClass: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800", isTerminal: true },
  { key: "abandonne", label: "Abandonné", order: 55, colorClass: "bg-red-100 border-red-200", textColorClass: "text-red-600", darkColorClass: "dark:bg-red-900/30 dark:text-red-400 dark:border-red-800", isTerminal: true },
  { key: "archive", label: "Archivé", order: 60, colorClass: "bg-gray-100 border-gray-200", textColorClass: "text-gray-500", darkColorClass: "dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700", isTerminal: true },
  { key: "annule", label: "Annulé", order: 70, colorClass: "bg-red-50 border-red-200", textColorClass: "text-red-500", darkColorClass: "dark:bg-red-900/20 dark:text-red-400 dark:border-red-800", isTerminal: true },
] as const;

export type ProjectStageKey = typeof PROJECT_STAGES[number]["key"];

export const projectStageByKey = Object.fromEntries(
  PROJECT_STAGES.map(s => [s.key, s])
) as Record<ProjectStageKey, typeof PROJECT_STAGES[number]>;

export const projectStageKeys = PROJECT_STAGES.map(s => s.key);

export function getProjectStageLabel(key: ProjectStageKey | string | null): string {
  if (!key) return "Non défini";
  return projectStageByKey[key as ProjectStageKey]?.label ?? key;
}

export function getProjectStageColorClass(key: ProjectStageKey | string | null): string {
  if (!key) return "bg-gray-100 border-gray-200 text-gray-700";
  const stage = projectStageByKey[key as ProjectStageKey];
  if (!stage) return "bg-gray-100 border-gray-200 text-gray-700";
  return `${stage.colorClass} ${stage.textColorClass} ${stage.darkColorClass}`;
}

export function getProjectStageOrder(key: ProjectStageKey | string | null): number {
  if (!key) return 0;
  return projectStageByKey[key as ProjectStageKey]?.order ?? 0;
}

export function isTerminalStage(key: ProjectStageKey | string | null): boolean {
  if (!key) return false;
  return projectStageByKey[key as ProjectStageKey]?.isTerminal === true;
}
