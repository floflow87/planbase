/**
 * Form Field Components
 * 
 * Standardized form field primitives:
 * - Field: Wrapper combining label + control + helper/error
 * - HelperText: Descriptive text below inputs
 * - ErrorText: Error message display
 * - FormLabel: Styled label with required indicator
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { spacingTokens, sizeTokens } from "@shared/design/tokens/forms";

/**
 * Helper Text - Descriptive text below form controls
 */
export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const HelperText = React.forwardRef<HTMLParagraphElement, HelperTextProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        sizeTokens.helperText,
        "text-muted-foreground",
        spacingTokens.helperGap,
        className
      )}
      data-testid="text-helper"
      {...props}
    >
      {children}
    </p>
  )
);
HelperText.displayName = "HelperText";

/**
 * Error Text - Error message display
 */
export interface ErrorTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const ErrorText = React.forwardRef<HTMLParagraphElement, ErrorTextProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        sizeTokens.errorText,
        "text-destructive font-medium",
        spacingTokens.helperGap,
        className
      )}
      role="alert"
      data-testid="text-error"
      {...props}
    >
      {children}
    </p>
  )
);
ErrorText.displayName = "ErrorText";

/**
 * Form Label - Label with optional required indicator
 */
export interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean;
  children: React.ReactNode;
}

export const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  FormLabelProps
>(({ className, required, children, ...props }, ref) => (
  <Label
    ref={ref}
    className={cn(sizeTokens.labelText, "leading-none", className)}
    {...props}
  >
    {children}
    {required && (
      <span className="text-destructive ml-1" aria-hidden="true">
        *
      </span>
    )}
  </Label>
));
FormLabel.displayName = "FormLabel";

/**
 * Field - Wrapper combining label + control + helper/error
 */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  labelFor?: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, labelFor, required, error, helper, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(spacingTokens.fieldGap, className)}
      data-testid="field-wrapper"
      {...props}
    >
      {label && (
        <FormLabel htmlFor={labelFor} required={required}>
          {label}
        </FormLabel>
      )}
      {children}
      {error && <ErrorText>{error}</ErrorText>}
      {!error && helper && <HelperText>{helper}</HelperText>}
    </div>
  )
);
Field.displayName = "Field";

/**
 * FieldGroup - Group multiple fields horizontally
 */
export interface FieldGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const FieldGroup = React.forwardRef<HTMLDivElement, FieldGroupProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col sm:flex-row gap-4", className)}
      {...props}
    >
      {children}
    </div>
  )
);
FieldGroup.displayName = "FieldGroup";
