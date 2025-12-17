/**
 * TaskStatusBadge - Design System V1 Product Component
 * 
 * Displays a task status with proper styling
 * Consumes config + semantics for labels and colors
 */

import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTaskStatusLabel, type TaskStatusKey } from "@shared/config";
import { getTaskStatusClasses } from "@shared/design/semantics";
import { Circle, PlayCircle, Eye, CheckCircle, XCircle } from "lucide-react";

export interface TaskStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The task status key */
  statusKey: TaskStatusKey | string | null;
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

function getStatusIcon(key: string | null, size: "sm" | "md" | "lg") {
  const iconClass = iconSizes[size];
  switch (key) {
    case "todo":
      return <Circle className={cn(iconClass, "text-gray-500 dark:text-gray-400")} />;
    case "in_progress":
      return <PlayCircle className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
    case "review":
      return <Eye className={cn(iconClass, "text-yellow-600 dark:text-yellow-400")} />;
    case "done":
      return <CheckCircle className={cn(iconClass, "text-green-600 dark:text-green-400")} />;
    case "blocked":
      return <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
    default:
      return <Circle className={cn(iconClass, "text-gray-400")} />;
  }
}

/**
 * TaskStatusBadge displays the current status of a task
 * 
 * @example
 * <TaskStatusBadge statusKey={task.status} />
 * <TaskStatusBadge statusKey="in_progress" showIcon />
 */
export const TaskStatusBadge = forwardRef<HTMLDivElement, TaskStatusBadgeProps>(
  ({ statusKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getTaskStatusLabel(statusKey);
    const colorClasses = getTaskStatusClasses(statusKey);
    const sizeClass = sizeClasses[size];
    const icon = getStatusIcon(statusKey, size);

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
        data-testid={`badge-task-status-${statusKey || "none"}`}
        {...props}
      >
        {showIcon && icon}
        {label}
      </Badge>
    );
  }
);

TaskStatusBadge.displayName = "TaskStatusBadge";

export default TaskStatusBadge;
