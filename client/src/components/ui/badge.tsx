import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { 
  getIntentClasses,
  getIntentDotClass,
  type Intent, 
  type IntentVariant 
} from "@shared/design/semantics"

/**
 * Badge base classes - shared structural foundation for all badge variants
 * This ensures all badge sizes inherit the same tokens
 */
const BADGE_BASE = "inline-flex items-center font-semibold whitespace-nowrap transition-colors";

/**
 * Badge interactive classes - focus and hover behaviors
 */
const BADGE_INTERACTIVE = "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate";

/**
 * Badge structural classes - border and radius
 */
const BADGE_STRUCTURE = "rounded-md border";

/**
 * Badge variants using class-variance-authority
 * 
 * Supports two styling systems:
 * 1. Legacy shadcn variants (default, secondary, destructive, outline)
 * 2. Intent-based variants (success, warning, danger, info, neutral, primary, accent)
 * 
 * When using intent prop, the variant prop is ignored and intent styling takes precedence.
 */
const badgeVariants = cva(
  BADGE_BASE,
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: "border [border-color:var(--badge-outline)] shadow-xs",
      },
      size: {
        sm: `${BADGE_STRUCTURE} ${BADGE_INTERACTIVE} text-[10px] min-h-5 px-1.5`,
        md: `${BADGE_STRUCTURE} ${BADGE_INTERACTIVE} text-xs min-h-6 px-2.5`,
        lg: `${BADGE_STRUCTURE} ${BADGE_INTERACTIVE} text-sm min-h-7 px-3`,
        dot: "w-2 h-2 rounded-full flex-shrink-0 p-0 border-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

export type BadgeSize = "sm" | "md" | "lg" | "dot";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Semantic intent for the badge (success, warning, danger, info, neutral, primary, accent)
   * When provided, overrides the variant prop styling
   */
  intent?: Intent;
  /**
   * Visual tone/style variant for intent-based badges
   * Only applies when intent prop is provided and size is not "dot"
   * @default "soft"
   */
  tone?: IntentVariant;
  /**
   * Size variant - "dot" renders a small status indicator
   */
  size?: BadgeSize;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size = "md", intent, tone = "soft", children, ...props }, ref) => {
    const isDot = size === "dot";
    
    if (intent) {
      if (isDot) {
        const dotColorClass = getIntentDotClass(intent);
        return (
          <div 
            ref={ref} 
            className={cn(
              badgeVariants({ size: "dot", variant: null }),
              dotColorClass,
              className
            )} 
            aria-hidden="true"
            {...props} 
          />
        );
      }
      
      const intentClasses = getIntentClasses(intent, tone);
      
      return (
        <div 
          ref={ref} 
          className={cn(
            badgeVariants({ size, variant: null }),
            intentClasses,
            className
          )} 
          {...props}
        >
          {children}
        </div>
      );
    }
    
    return (
      <div 
        ref={ref} 
        className={cn(
          badgeVariants({ variant, size: isDot ? "dot" : size }),
          className
        )} 
        {...props}
      >
        {children}
      </div>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants, BADGE_BASE, BADGE_INTERACTIVE, BADGE_STRUCTURE }
export type { Intent, IntentVariant }
