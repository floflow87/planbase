/**
 * Billing Status Semantics - Design System V1
 * 
 * Maps billing status keys to design intents
 * Consumes config from shared/config/billingStatuses.ts
 */

import type { BillingStatusKey } from "@shared/config";
import type { Intent } from "./intents";

/**
 * Map billing statuses to semantic intents
 */
export const billingStatusIntents: Record<BillingStatusKey, Intent> = {
  not_billed: "neutral",      // Not yet invoiced
  pending: "warning",         // Awaiting payment
  partial: "info",            // Partially paid
  paid: "success",            // Fully paid
  overdue: "danger",          // Payment overdue
  cancelled: "neutral",       // Invoice cancelled
};

/**
 * Get the intent for a billing status
 */
export function getBillingStatusIntent(key: BillingStatusKey | string | null): Intent {
  if (!key) return "neutral";
  return billingStatusIntents[key as BillingStatusKey] ?? "neutral";
}

/**
 * Extended color mapping with Tailwind classes
 */
export const billingStatusColors: Record<BillingStatusKey, {
  bg: string;
  text: string;
  border: string;
  dark: string;
}> = {
  not_billed: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dark: "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dark: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  },
  partial: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    dark: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  paid: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    dark: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  overdue: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
    dark: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  cancelled: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-200",
    dark: "dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
};

/**
 * Get Tailwind classes for a billing status badge
 */
export function getBillingStatusClasses(key: BillingStatusKey | string | null): string {
  if (!key) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  const colors = billingStatusColors[key as BillingStatusKey];
  if (!colors) {
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
  return `${colors.bg} ${colors.text} ${colors.border} ${colors.dark}`;
}
