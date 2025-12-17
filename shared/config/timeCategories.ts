/**
 * Time Entry Categories Configuration
 * Centralized source of truth for time tracking categories
 */

export const TIME_CATEGORIES = [
  { key: "development", label: "Développement", color: "#7C3AED", colorClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", icon: "Code" },
  { key: "design", label: "Design", color: "#06B6D4", colorClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: "Palette" },
  { key: "meeting", label: "Réunion", color: "#F59E0B", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: "Users" },
  { key: "planning", label: "Planification", color: "#3B82F6", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: "Calendar" },
  { key: "research", label: "Recherche", color: "#8B5CF6", colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: "Search" },
  { key: "testing", label: "Tests", color: "#10B981", colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: "CheckCircle" },
  { key: "documentation", label: "Documentation", color: "#6B7280", colorClass: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300", icon: "FileText" },
  { key: "support", label: "Support", color: "#EF4444", colorClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: "Headphones" },
  { key: "review", label: "Revue de code", color: "#EC4899", colorClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", icon: "GitPullRequest" },
  { key: "other", label: "Autre", color: "#9CA3AF", colorClass: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400", icon: "MoreHorizontal" },
] as const;

export type TimeCategoryKey = typeof TIME_CATEGORIES[number]["key"];

export const timeCategoryByKey = Object.fromEntries(
  TIME_CATEGORIES.map(c => [c.key, c])
) as Record<TimeCategoryKey, typeof TIME_CATEGORIES[number]>;

export const timeCategoryKeys = TIME_CATEGORIES.map(c => c.key);

export const timeCategoryOptions = TIME_CATEGORIES.map(c => ({
  value: c.key,
  label: c.label,
  color: c.color,
  icon: c.icon,
}));

export function getTimeCategoryLabel(key: TimeCategoryKey | string | null): string {
  if (!key) return "Autre";
  return timeCategoryByKey[key as TimeCategoryKey]?.label ?? key;
}

export function getTimeCategoryColorClass(key: TimeCategoryKey | string | null): string {
  if (!key) return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400";
  return timeCategoryByKey[key as TimeCategoryKey]?.colorClass ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400";
}

export function getTimeCategoryColor(key: TimeCategoryKey | string | null): string {
  if (!key) return "#9CA3AF";
  return timeCategoryByKey[key as TimeCategoryKey]?.color ?? "#9CA3AF";
}

export function getTimeCategoryIcon(key: TimeCategoryKey | string | null): string {
  if (!key) return "MoreHorizontal";
  return timeCategoryByKey[key as TimeCategoryKey]?.icon ?? "MoreHorizontal";
}
