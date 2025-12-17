/**
 * TaskPriorityBadge - Design System V1 Product Component
 * 
 * Displays a task priority with proper styling
 * Consumes config + semantics for labels and colors
 */

import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTaskPriorityLabel, type TaskPriorityKey } from "@shared/config";
import { getTaskPriorityClasses } from "@shared/design/semantics";
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

export interface TaskPriorityBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The task priority key */
  priorityKey: TaskPriorityKey | string | null;
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

function getPriorityIcon(key: string | null, size: "sm" | "md" | "lg") {
  const iconClass = iconSizes[size];
  switch (key) {
    case "critical":
      return <AlertTriangle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
    case "high":
      return <ArrowUp className={cn(iconClass, "text-orange-600 dark:text-orange-400")} />;
    case "medium":
      return <ArrowRight className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
    case "low":
      return <ArrowDown className={cn(iconClass, "text-gray-500 dark:text-gray-400")} />;
    default:
      return null;
  }
}

/**
 * TaskPriorityBadge displays the priority level of a task
 * 
 * @example
 * <TaskPriorityBadge priorityKey={task.priority} />
 * <TaskPriorityBadge priorityKey="high" showIcon />
 */
export const TaskPriorityBadge = forwardRef<HTMLDivElement, TaskPriorityBadgeProps>(
  ({ priorityKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getTaskPriorityLabel(priorityKey);
    const colorClasses = getTaskPriorityClasses(priorityKey);
    const sizeClass = sizeClasses[size];
    const icon = getPriorityIcon(priorityKey, size);

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
        data-testid={`badge-task-priority-${priorityKey || "none"}`}
        {...props}
      >
        {showIcon && icon}
        {label}
      </Badge>
    );
  }
);

TaskPriorityBadge.displayName = "TaskPriorityBadge";

export default TaskPriorityBadge;
