import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { 
  getIntentClasses,
  type Intent, 
  type IntentVariant 
} from "@shared/design/semantics"

/**
 * Button base classes - shared structural foundation
 */
const BUTTON_BASE = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2";

const buttonVariants = cva(
  BUTTON_BASE,
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          " border [border-color:var(--button-outline)]  shadow-xs active:shadow-none ",
        secondary: "border bg-secondary text-secondary-foreground border border-secondary-border ",
        ghost: "border border-transparent",
        intent: "border", // For intent-based styling
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Semantic intent for the button (success, warning, danger, info, neutral, primary, accent)
   * When provided, overrides the variant prop styling
   */
  intent?: Intent;
  /**
   * Visual tone/style variant for intent-based buttons
   * Only applies when intent prop is provided
   * @default "solid"
   */
  tone?: IntentVariant;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, intent, tone = "solid", ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    if (intent) {
      const intentClasses = getIntentClasses(intent, tone);
      
      return (
        <Comp
          className={cn(
            buttonVariants({ size, variant: "intent" }),
            intentClasses,
            className
          )}
          ref={ref}
          {...props}
        />
      )
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants, BUTTON_BASE }
