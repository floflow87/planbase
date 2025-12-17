/**
 * TaskPriorityBadge - Design System V1 Product Component
 * 
 * Displays a task priority with proper styling
 * Uses BadgeIntent primitive with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getTaskPriorityLabel, type TaskPriorityKey } from "@shared/config";
import { getTaskPriorityIntent } from "@shared/design/semantics";
import { BadgeIntent, type Intent, type IntentSize } from "../primitives/BadgeIntent";
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

export interface TaskPriorityBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  priorityKey: TaskPriorityKey | string | null;
  size?: IntentSize;
  showIcon?: boolean;
  iconOnly?: boolean;
}

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const priorityIcons: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  high: ArrowUp,
  medium: ArrowRight,
  low: ArrowDown,
};

/**
 * TaskPriorityBadge displays the priority level of a task
 * Uses BadgeIntent primitive for consistent design system integration
 */
export const TaskPriorityBadge = forwardRef<HTMLSpanElement, TaskPriorityBadgeProps>(
  ({ priorityKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getTaskPriorityLabel(priorityKey);
    const intent = getTaskPriorityIntent(priorityKey) as Intent;
    const iconSize = iconSizes[size];
    
    const IconComponent = priorityIcons[priorityKey as string] || ArrowRight;

    if (iconOnly) {
      return (
        <BadgeIntent
          ref={ref}
          intent={intent}
          variant="ghost"
          size={size}
          className={cn("p-1", className)}
          title={label}
          data-testid={`icon-task-priority-${priorityKey || "none"}`}
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
        data-testid={`badge-task-priority-${priorityKey || "none"}`}
        {...props}
      >
        {showIcon && <IconComponent className={iconSize} />}
        {label}
      </BadgeIntent>
    );
  }
);

TaskPriorityBadge.displayName = "TaskPriorityBadge";

export default TaskPriorityBadge;
