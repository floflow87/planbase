/**
 * Toast Utilities - Design System V1
 * 
 * Unified toast API ensuring consistent styling across the app
 * All success toasts are GREEN, errors are RED, info is BLUE
 */

import { toast as baseToast } from "@/hooks/use-toast";

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

/**
 * Show a success toast (GREEN)
 * Use for successful operations, confirmations, completed actions
 * 
 * @example
 * toastSuccess({ title: "Saved!", description: "Your changes have been saved." });
 * toastSuccess({ title: "Project created" });
 */
export function toastSuccess(options: ToastOptions) {
  return baseToast({
    variant: "success",
    title: options.title,
    description: options.description,
    duration: options.duration,
  });
}

/**
 * Show an error toast (RED/Destructive)
 * Use for errors, failures, validation issues
 * 
 * @example
 * toastError({ title: "Error", description: "Something went wrong." });
 * toastError({ title: "Failed to save" });
 */
export function toastError(options: ToastOptions) {
  return baseToast({
    variant: "destructive",
    title: options.title,
    description: options.description,
    duration: options.duration,
  });
}

/**
 * Show an info toast (BLUE)
 * Use for informational messages, updates, neutral notifications
 * 
 * @example
 * toastInfo({ title: "Info", description: "Your session will expire in 5 minutes." });
 */
export function toastInfo(options: ToastOptions) {
  return baseToast({
    variant: "info",
    title: options.title,
    description: options.description,
    duration: options.duration,
  });
}

/**
 * Show a warning toast (YELLOW)
 * Use for warnings, cautions, important notices
 * 
 * @example
 * toastWarning({ title: "Warning", description: "This action cannot be undone." });
 */
export function toastWarning(options: ToastOptions) {
  return baseToast({
    variant: "warning",
    title: options.title,
    description: options.description,
    duration: options.duration,
  });
}

// Re-export base toast for advanced usage
export { baseToast as toast };
