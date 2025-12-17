import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { 
  getIntentClasses, 
  type Intent, 
  type IntentVariant 
} from "@shared/design/semantics"
import { badgeTokens, type BadgeSize } from "@shared/design/tokens"

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
  `${badgeTokens.base} ${badgeTokens.radius} ${badgeTokens.border} hover-elevate`,
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
        sm: badgeTokens.sizes.sm,
        md: badgeTokens.sizes.md,
        lg: badgeTokens.sizes.lg,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

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
   * Only applies when intent prop is provided
   * @default "soft"
   */
  tone?: IntentVariant;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, intent, tone = "soft", ...props }, ref) => {
    if (intent) {
      const intentClasses = getIntentClasses(intent, tone);
      const sizeClass = badgeTokens.sizes[size || "md"];
      
      return (
        <div 
          ref={ref} 
          className={cn(
            badgeTokens.base,
            badgeTokens.radius,
            badgeTokens.border,
            "hover-elevate",
            sizeClass,
            intentClasses,
            className
          )} 
          {...props} 
        />
      );
    }
    
    return (
      <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants }
export type { Intent, IntentVariant, BadgeSize }
