/**
 * BadgeIntent - Design System V1 Primitive
 * 
 * A badge component that accepts semantic intents
 * Consumes intent-to-style mappings from shared/design/semantics
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { 
  getIntentClasses, 
  type Intent, 
  type IntentVariant, 
  type IntentSize 
} from "@shared/design/semantics";

export type { Intent, IntentVariant, IntentSize };

export interface BadgeIntentProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  intent?: Intent;
  variant?: IntentVariant;
  size?: IntentSize;
  children?: React.ReactNode;
}

const sizeClasses: Record<IntentSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
};

/**
 * BadgeIntent renders a badge with semantic intent styling
 * Consumes styling from shared/design/semantics layer
 * 
 * @example
 * <BadgeIntent intent="success">Completed</BadgeIntent>
 * <BadgeIntent intent="warning" variant="outline">Pending</BadgeIntent>
 */
export const BadgeIntent = forwardRef<HTMLSpanElement, BadgeIntentProps>(
  ({ intent = "neutral", variant = "soft", size = "md", className, children, ...props }, ref) => {
    const intentClasses = getIntentClasses(intent, variant);
    const sizeClass = sizeClasses[size];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border font-medium whitespace-nowrap",
          intentClasses,
          sizeClass,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

BadgeIntent.displayName = "BadgeIntent";

export default BadgeIntent;
