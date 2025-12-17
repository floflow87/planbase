/**
 * Form Design Tokens
 * 
 * Centralized tokens for form inputs, validation, and interactions.
 * Used by Input, Textarea, Select, and Field components.
 */

/**
 * Focus ring tokens - consistent focus states across all form controls
 */
export const focusTokens = {
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ringOffset: "ring-offset-background",
  ringError: "focus-visible:ring-destructive",
  ringSuccess: "focus-visible:ring-green-500",
} as const;

/**
 * Border tokens - consistent borders for form controls
 */
export const borderTokens = {
  default: "border border-input",
  error: "border-destructive",
  success: "border-green-500",
  disabled: "border-muted",
  hover: "hover:border-ring/50",
} as const;

/**
 * Spacing tokens - consistent padding/margin for form elements
 */
export const spacingTokens = {
  inputPadding: "px-3 py-2",
  inputPaddingY: "py-2",
  inputPaddingX: "px-3",
  fieldGap: "space-y-2",
  labelGap: "mb-1.5",
  helperGap: "mt-1.5",
  formGap: "space-y-4",
  formSectionGap: "space-y-6",
} as const;

/**
 * Size tokens - height and text sizes for form controls
 */
export const sizeTokens = {
  inputHeight: "h-9",
  textareaMinHeight: "min-h-[80px]",
  labelText: "text-sm font-medium",
  inputText: "text-base md:text-sm",
  helperText: "text-sm",
  errorText: "text-sm",
} as const;

/**
 * State tokens - visual states for form controls
 */
export const stateTokens = {
  disabled: "disabled:cursor-not-allowed disabled:opacity-50",
  placeholder: "placeholder:text-muted-foreground",
  error: "border-destructive text-destructive",
  success: "border-green-500",
} as const;

/**
 * Complete input base classes (structural)
 */
export const inputBaseClasses = [
  "flex w-full rounded-md bg-white dark:bg-gray-900",
  borderTokens.default,
  spacingTokens.inputPadding,
  sizeTokens.inputText,
  focusTokens.ring,
  focusTokens.ringOffset,
  stateTokens.disabled,
  stateTokens.placeholder,
].join(" ");

/**
 * Complete textarea base classes (structural)
 */
export const textareaBaseClasses = [
  "flex w-full rounded-md bg-white dark:bg-gray-900",
  borderTokens.default,
  spacingTokens.inputPadding,
  sizeTokens.inputText,
  sizeTokens.textareaMinHeight,
  focusTokens.ring,
  focusTokens.ringOffset,
  stateTokens.disabled,
  stateTokens.placeholder,
].join(" ");

/**
 * Get input classes with optional error/success state
 */
export function getInputClasses(state?: "error" | "success"): string {
  const base = inputBaseClasses;
  
  if (state === "error") {
    return `${base} ${borderTokens.error} ${focusTokens.ringError}`;
  }
  if (state === "success") {
    return `${base} ${borderTokens.success} ${focusTokens.ringSuccess}`;
  }
  
  return base;
}

/**
 * Get textarea classes with optional error/success state
 */
export function getTextareaClasses(state?: "error" | "success"): string {
  const base = textareaBaseClasses;
  
  if (state === "error") {
    return `${base} ${borderTokens.error} ${focusTokens.ringError}`;
  }
  if (state === "success") {
    return `${base} ${borderTokens.success} ${focusTokens.ringSuccess}`;
  }
  
  return base;
}

export type FormState = "default" | "error" | "success" | "disabled";
