/**
 * UI Primitives - Design System V1
 * 
 * Atomic, reusable components with intent-based styling
 * These are the building blocks for product components
 */

// Utilities
export { cn, cxIf, cxVariant } from "./cx";

// Components
export { BadgeIntent } from "./BadgeIntent";
export type { BadgeIntentProps, Intent, IntentVariant, IntentSize } from "./BadgeIntent";

// Form Primitives (V1.4)
export { 
  Field, 
  FieldGroup, 
  FormLabel, 
  HelperText, 
  ErrorText 
} from "./FormField";
export type { 
  FieldProps, 
  FieldGroupProps, 
  FormLabelProps, 
  HelperTextProps, 
  ErrorTextProps 
} from "./FormField";

export { FormInput, FormTextarea } from "./FormInput";
export type { FormInputProps, FormTextareaProps } from "./FormInput";
