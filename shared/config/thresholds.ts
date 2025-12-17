/**
 * Reporting and Business Thresholds Configuration
 * Centralized source of truth for configurable business thresholds
 */

export const THRESHOLDS = {
  billing: {
    overdueWarningDays: 15,
    overdueCriticalDays: 30,
    paymentReminderDays: 7,
  },
  projects: {
    budgetWarningPercent: 80,
    budgetCriticalPercent: 95,
    deadlineWarningDays: 7,
    deadlineCriticalDays: 2,
  },
  tasks: {
    overdueWarningDays: 3,
    overdueCriticalDays: 7,
    maxTasksPerColumn: 20,
  },
  time: {
    dailyTargetHours: 8,
    weeklyTargetHours: 40,
    overtimeThresholdHours: 10,
    minEntryMinutes: 15,
  },
  reports: {
    defaultDateRangeDays: 30,
    maxExportRecords: 5000,
    chartMaxDataPoints: 100,
  },
  dashboard: {
    recentActivitiesCount: 20,
    upcomingTasksDays: 7,
    overdueTasksWarning: 5,
  },
} as const;

export type ThresholdCategory = keyof typeof THRESHOLDS;
export type BillingThresholds = typeof THRESHOLDS.billing;
export type ProjectThresholds = typeof THRESHOLDS.projects;
export type TaskThresholds = typeof THRESHOLDS.tasks;
export type TimeThresholds = typeof THRESHOLDS.time;
export type ReportThresholds = typeof THRESHOLDS.reports;
export type DashboardThresholds = typeof THRESHOLDS.dashboard;

export function getThreshold<C extends ThresholdCategory, K extends keyof typeof THRESHOLDS[C]>(
  category: C,
  key: K
): typeof THRESHOLDS[C][K] {
  return THRESHOLDS[category][key];
}

export function getBillingThreshold<K extends keyof BillingThresholds>(key: K): BillingThresholds[K] {
  return THRESHOLDS.billing[key];
}

export function getProjectThreshold<K extends keyof ProjectThresholds>(key: K): ProjectThresholds[K] {
  return THRESHOLDS.projects[key];
}

export function getTaskThreshold<K extends keyof TaskThresholds>(key: K): TaskThresholds[K] {
  return THRESHOLDS.tasks[key];
}

export function getTimeThreshold<K extends keyof TimeThresholds>(key: K): TimeThresholds[K] {
  return THRESHOLDS.time[key];
}

export function getReportThreshold<K extends keyof ReportThresholds>(key: K): ReportThresholds[K] {
  return THRESHOLDS.reports[key];
}

export function getDashboardThreshold<K extends keyof DashboardThresholds>(key: K): DashboardThresholds[K] {
  return THRESHOLDS.dashboard[key];
}
