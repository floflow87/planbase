/**
 * Semantic Mappings - Central Export
 * 
 * Maps business domain keys to design intents
 * Bridge between config registry and design tokens
 */

// Intent System
export {
  intentStyles,
  getIntentClasses,
  getIntentStyle,
} from "./intents";
export type { Intent, IntentVariant, IntentSize } from "./intents";

// Project Stages
export {
  projectStageIntents,
  projectStageColors,
  getProjectStageIntent,
  getProjectStageClasses,
} from "./projectStages";

// Task Priorities
export {
  taskPriorityIntents,
  taskPriorityColors,
  getTaskPriorityIntent,
  getTaskPriorityClasses,
} from "./taskPriorities";

// Task Statuses
export {
  taskStatusIntents,
  taskStatusColors,
  getTaskStatusIntent,
  getTaskStatusClasses,
} from "./taskStatuses";

// Billing Statuses
export {
  billingStatusIntents,
  billingStatusColors,
  getBillingStatusIntent,
  getBillingStatusClasses,
} from "./billingStatuses";
