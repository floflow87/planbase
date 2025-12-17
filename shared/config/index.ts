/**
 * Centralized Configuration Module
 * 
 * This module serves as the single source of truth for all configurable
 * options used throughout the application (project stages, task statuses,
 * priorities, billing statuses, time categories, thresholds, etc.)
 * 
 * Architecture:
 * - These files contain DEFAULT configurations used as fallback
 * - Runtime configs can be overridden via the Config Registry (settings table)
 * - Backend configService merges DB settings with these defaults
 * - Frontend useConfig() hook fetches resolved config from API
 * 
 * Usage:
 *   import { PROJECT_STAGES, getProjectStageLabel } from "@shared/config";
 *   import { BILLING_STATUSES, billingStatusOptions } from "@shared/config";
 *   import { THRESHOLDS, getThreshold } from "@shared/config";
 */

// Project Stages
export {
  PROJECT_STAGES,
  projectStageByKey,
  projectStageKeys,
  getProjectStageLabel,
  getProjectStageColorClass,
  getProjectStageOrder,
  isTerminalStage,
  type ProjectStageKey,
} from "./projectStages";

// Task Priorities
export {
  TASK_PRIORITIES,
  taskPriorityByKey,
  taskPriorityKeys,
  getTaskPriorityLabel,
  getTaskPriorityColorClass,
  getTaskPriorityColorWithBorder,
  getTaskPriorityBadgeClass,
  getTaskPriorityOrder,
  type TaskPriorityKey,
} from "./taskPriorities";

// Task Statuses
export {
  TASK_STATUSES,
  taskStatusByKey,
  taskStatusKeys,
  getTaskStatusLabel,
  getTaskStatusColorClass,
  getTaskStatusOrder,
  isTerminalStatus,
  getStatusFromColumnName,
  type TaskStatusKey,
} from "./taskStatuses";

// Billing Statuses
export {
  BILLING_STATUSES,
  billingStatusByKey,
  billingStatusKeys,
  billingStatusOptions,
  getBillingStatusLabel,
  getBillingStatusColorClass,
  getBillingStatusOrder,
  isTerminalBillingStatus,
  getBillingStatusColor,
  type BillingStatusKey,
} from "./billingStatuses";

// Time Categories
export {
  TIME_CATEGORIES,
  timeCategoryByKey,
  timeCategoryKeys,
  timeCategoryOptions,
  getTimeCategoryLabel,
  getTimeCategoryColorClass,
  getTimeCategoryColor,
  getTimeCategoryIcon,
  type TimeCategoryKey,
} from "./timeCategories";

// Thresholds
export {
  THRESHOLDS,
  getThreshold,
  getBillingThreshold,
  getProjectThreshold,
  getTaskThreshold,
  getTimeThreshold,
  getReportThreshold,
  getDashboardThreshold,
  type ThresholdCategory,
  type BillingThresholds,
  type ProjectThresholds,
  type TaskThresholds,
  type TimeThresholds,
  type ReportThresholds,
  type DashboardThresholds,
} from "./thresholds";

/**
 * Get all default configurations as a single object
 * Used by configService for merging with DB settings
 */
export function getAllDefaultConfigs() {
  return {
    "project.stages": PROJECT_STAGES,
    "task.priorities": TASK_PRIORITIES,
    "task.statuses": TASK_STATUSES,
    "billing.statuses": BILLING_STATUSES,
    "time.categories": TIME_CATEGORIES,
    "thresholds": THRESHOLDS,
  } as const;
}

// Import for re-export
import { PROJECT_STAGES } from "./projectStages";
import { TASK_PRIORITIES } from "./taskPriorities";
import { TASK_STATUSES } from "./taskStatuses";
import { BILLING_STATUSES } from "./billingStatuses";
import { TIME_CATEGORIES } from "./timeCategories";
import { THRESHOLDS } from "./thresholds";

export type ConfigKey = keyof ReturnType<typeof getAllDefaultConfigs>;
