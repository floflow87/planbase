/**
 * TaskPriorityBadge - Design System V1 Product Component
 * 
 * Displays a task priority with proper styling
 * Uses Badge component with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getTaskPriorityLabel, type TaskPriorityKey } from "@shared/config";
import { getTaskPriorityIntent } from "@shared/design/semantics";
import { Badge, type Intent, type BadgeSize, type IntentVariant } from "@/components/ui/badge";
import { AlertTriangle, ArrowUp, Minus, ArrowDown } from "lucide-react";

export interface TaskPriorityBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  priorityKey: TaskPriorityKey | string | null;
  size?: Exclude<BadgeSize, "dot">;
  showIcon?: boolean;
  iconOnly?: boolean;
  tone?: IntentVariant;
}

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const priorityIcons: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
};

/**
 * TaskPriorityBadge displays the priority level of a task
 * Uses Badge component with intent for consistent design system integration
 */
export const TaskPriorityBadge = forwardRef<HTMLDivElement, TaskPriorityBadgeProps>(
  ({ priorityKey, size = "md", showIcon = false, iconOnly = false, tone = "soft", className, ...props }, ref) => {
    const label = getTaskPriorityLabel(priorityKey);
    const intent = getTaskPriorityIntent(priorityKey) as Intent;
    const iconSize = iconSizes[size];
    
    const IconComponent = priorityIcons[priorityKey as string] || Minus;

    if (iconOnly) {
      return (
        <Badge
          ref={ref}
          intent={intent}
          tone="ghost"
          size={size}
          className={cn("p-1", className)}
          title={label}
          data-testid={`icon-task-priority-${priorityKey || "none"}`}
          {...props}
        >
          <IconComponent className={iconSize} />
        </Badge>
      );
    }

    return (
      <Badge
        ref={ref}
        intent={intent}
        tone={tone}
        size={size}
        className={cn(showIcon && "gap-1", className)}
        data-testid={`badge-task-priority-${priorityKey || "none"}`}
        {...props}
      >
        {showIcon && <IconComponent className={iconSize} />}
        {label}
      </Badge>
    );
  }
);

TaskPriorityBadge.displayName = "TaskPriorityBadge";

export default TaskPriorityBadge;
