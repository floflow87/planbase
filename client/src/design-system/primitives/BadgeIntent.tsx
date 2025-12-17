/**
 * BadgeIntent - Design System V1 Primitive
 * 
 * A thin wrapper around shadcn Badge with intent prop.
 * This component is maintained for backward compatibility.
 * 
 * For new code, prefer using Badge directly with intent prop:
 * <Badge intent="success">Label</Badge>
 */

import { forwardRef } from "react";
import { Badge, type Intent, type IntentVariant, type BadgeSize } from "@/components/ui/badge";

export type { Intent, IntentVariant };
export type IntentSize = BadgeSize;

export interface BadgeIntentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  intent?: Intent;
  variant?: IntentVariant;
  size?: BadgeSize;
  children?: React.ReactNode;
}

/**
 * BadgeIntent renders a badge with semantic intent styling
 * 
 * @deprecated Prefer using <Badge intent="..."> directly
 * 
 * @example
 * <BadgeIntent intent="success">Completed</BadgeIntent>
 * <BadgeIntent intent="warning" variant="outline">Pending</BadgeIntent>
 */
export const BadgeIntent = forwardRef<HTMLDivElement, BadgeIntentProps>(
  ({ intent = "neutral", variant = "soft", size = "md", className, children, ...props }, ref) => {
    return (
      <Badge
        ref={ref}
        intent={intent}
        tone={variant}
        size={size}
        className={className}
        {...props}
      >
        {children}
      </Badge>
    );
  }
);

BadgeIntent.displayName = "BadgeIntent";

export default BadgeIntent;
