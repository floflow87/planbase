/**
 * BillingStatusBadge - Design System V1 Product Component
 * 
 * Displays a billing status with proper styling
 * Uses BadgeIntent primitive with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getBillingStatusLabel, type BillingStatusKey } from "@shared/config";
import { getBillingStatusIntent } from "@shared/design/semantics";
import { BadgeIntent, type Intent, type IntentSize } from "../primitives/BadgeIntent";
import { FileQuestion, Clock, TrendingUp, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export interface BillingStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  statusKey: BillingStatusKey | string | null;
  size?: IntentSize;
  showIcon?: boolean;
  iconOnly?: boolean;
}

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const billingIcons: Record<string, typeof FileQuestion> = {
  not_billed: FileQuestion,
  pending: Clock,
  partial: TrendingUp,
  paid: CheckCircle2,
  overdue: AlertCircle,
  cancelled: XCircle,
};

/**
 * BillingStatusBadge displays the billing status of a project
 * Uses BadgeIntent primitive for consistent design system integration
 */
export const BillingStatusBadge = forwardRef<HTMLSpanElement, BillingStatusBadgeProps>(
  ({ statusKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getBillingStatusLabel(statusKey);
    const intent = getBillingStatusIntent(statusKey) as Intent;
    const iconSize = iconSizes[size];
    
    const IconComponent = billingIcons[statusKey as string] || FileQuestion;

    if (iconOnly) {
      return (
        <BadgeIntent
          ref={ref}
          intent={intent}
          variant="ghost"
          size={size}
          className={cn("p-1", className)}
          title={label}
          data-testid={`icon-billing-status-${statusKey || "none"}`}
          {...props}
        >
          <IconComponent className={iconSize} />
        </BadgeIntent>
      );
    }

    return (
      <BadgeIntent
        ref={ref}
        intent={intent}
        variant="soft"
        size={size}
        className={cn(showIcon && "gap-1", className)}
        data-testid={`badge-billing-status-${statusKey || "none"}`}
        {...props}
      >
        {showIcon && <IconComponent className={iconSize} />}
        {label}
      </BadgeIntent>
    );
  }
);

BillingStatusBadge.displayName = "BillingStatusBadge";

export default BillingStatusBadge;
