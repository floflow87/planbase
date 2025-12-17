/**
 * BillingStatusBadge - Design System V1 Product Component
 * 
 * Displays a billing status with proper styling
 * Consumes config + semantics for labels and colors
 */

import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBillingStatusLabel, type BillingStatusKey } from "@shared/config";
import { getBillingStatusClasses } from "@shared/design/semantics";
import { FileQuestion, Clock, TrendingUp, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export interface BillingStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The billing status key */
  statusKey: BillingStatusKey | string | null;
  /** Optional size variant */
  size?: "sm" | "md" | "lg";
  /** Show icon alongside label */
  showIcon?: boolean;
  /** Icon-only mode */
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
};

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

function getBillingIcon(key: string | null, size: "sm" | "md" | "lg") {
  const iconClass = iconSizes[size];
  switch (key) {
    case "not_billed":
      return <FileQuestion className={cn(iconClass, "text-gray-500 dark:text-gray-400")} />;
    case "pending":
      return <Clock className={cn(iconClass, "text-yellow-600 dark:text-yellow-400")} />;
    case "partial":
      return <TrendingUp className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
    case "paid":
      return <CheckCircle2 className={cn(iconClass, "text-green-600 dark:text-green-400")} />;
    case "overdue":
      return <AlertCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
    case "cancelled":
      return <XCircle className={cn(iconClass, "text-gray-500 dark:text-gray-400")} />;
    default:
      return <FileQuestion className={cn(iconClass, "text-gray-400")} />;
  }
}

/**
 * BillingStatusBadge displays the billing status of a project
 * 
 * @example
 * <BillingStatusBadge statusKey={project.billingStatus} />
 * <BillingStatusBadge statusKey="paid" showIcon />
 */
export const BillingStatusBadge = forwardRef<HTMLDivElement, BillingStatusBadgeProps>(
  ({ statusKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getBillingStatusLabel(statusKey);
    const colorClasses = getBillingStatusClasses(statusKey);
    const sizeClass = sizeClasses[size];
    const icon = getBillingIcon(statusKey, size);

    if (iconOnly && icon) {
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-center", className)}
          title={label}
          {...props}
        >
          {icon}
        </span>
      );
    }

    return (
      <Badge
        ref={ref}
        variant="outline"
        className={cn(
          "border font-medium inline-flex items-center gap-1",
          colorClasses,
          sizeClass,
          className
        )}
        data-testid={`badge-billing-status-${statusKey || "none"}`}
        {...props}
      >
        {showIcon && icon}
        {label}
      </Badge>
    );
  }
);

BillingStatusBadge.displayName = "BillingStatusBadge";

export default BillingStatusBadge;
