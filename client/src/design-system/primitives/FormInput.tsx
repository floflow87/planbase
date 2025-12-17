/**
 * Form Input Components
 * 
 * Standardized input primitives that extend shadcn components
 * with design system tokens and consistent styling.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { 
  sizeTokens, 
  getInputClasses, 
  getTextareaClasses,
  type FormState 
} from "@shared/design/tokens/forms";

/**
 * FormInput - Styled input with error/success states
 */
export interface FormInputProps extends React.ComponentProps<"input"> {
  state?: FormState;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, type, state, disabled, ...props }, ref) => {
    const effectiveState = disabled ? "disabled" : state;
    const stateClass = effectiveState === "error" ? "error" : 
                       effectiveState === "success" ? "success" : undefined;
    
    return (
      <input
        type={type}
        className={cn(
          getInputClasses(stateClass),
          sizeTokens.inputHeight,
          className
        )}
        ref={ref}
        disabled={disabled}
        aria-invalid={state === "error" ? "true" : undefined}
        data-testid="input-form"
        {...props}
      />
    );
  }
);
FormInput.displayName = "FormInput";

/**
 * FormTextarea - Styled textarea with error/success states
 */
export interface FormTextareaProps extends React.ComponentProps<"textarea"> {
  state?: FormState;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, state, disabled, ...props }, ref) => {
    const effectiveState = disabled ? "disabled" : state;
    const stateClass = effectiveState === "error" ? "error" : 
                       effectiveState === "success" ? "success" : undefined;
    
    return (
      <textarea
        className={cn(
          getTextareaClasses(stateClass),
          className
        )}
        ref={ref}
        disabled={disabled}
        aria-invalid={state === "error" ? "true" : undefined}
        data-testid="textarea-form"
        {...props}
      />
    );
  }
);
FormTextarea.displayName = "FormTextarea";
