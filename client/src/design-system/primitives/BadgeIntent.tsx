/**
 * BadgeIntent - Design System V1 Primitive
 * 
 * A badge component that accepts semantic intents
 * Wraps the base shadcn Badge with intent-based styling
 */

import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "./cx";
import type { Intent, IntentVariant, IntentSize } from "@shared/design/semantics";
import { getIntentClasses } from "@shared/design/semantics";

export interface BadgeIntentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The semantic intent for styling */
  intent?: Intent;
  /** The visual variant */
  variant?: IntentVariant;
  /** The size of the badge */
  size?: IntentSize;
  /** Badge content */
  children: React.ReactNode;
}

const sizeClasses: Record<IntentSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
};

/**
 * BadgeIntent renders a badge with semantic intent styling
 * 
 * @example
 * <BadgeIntent intent="success">Completed</BadgeIntent>
 * <BadgeIntent intent="warning" variant="outline">Pending</BadgeIntent>
 */
export const BadgeIntent = forwardRef<HTMLDivElement, BadgeIntentProps>(
  ({ intent = "neutral", variant = "soft", size = "md", className, children, ...props }, ref) => {
    const intentClasses = getIntentClasses(intent, variant);
    const sizeClass = sizeClasses[size];

    return (
      <Badge
        ref={ref}
        variant="outline"
        className={cn(
          "border font-medium",
          intentClasses,
          sizeClass,
          className
        )}
        {...props}
      >
        {children}
      </Badge>
    );
  }
);

BadgeIntent.displayName = "BadgeIntent";

export default BadgeIntent;
