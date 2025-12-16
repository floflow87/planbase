/**
 * Centralized Configuration Module
 * 
 * This module serves as the single source of truth for all configurable
 * options used throughout the application (project stages, task statuses,
 * priorities, billing statuses, etc.)
 * 
 * Usage:
 *   import { PROJECT_STAGES, getProjectStageLabel } from "@shared/config";
 *   import { BILLING_STATUSES, billingStatusOptions } from "@shared/config";
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
