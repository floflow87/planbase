/**
 * TaskStatusBadge - Design System V1 Product Component
 * 
 * Displays a task status with proper styling
 * Uses BadgeIntent primitive with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getTaskStatusLabel, type TaskStatusKey } from "@shared/config";
import { getTaskStatusIntent } from "@shared/design/semantics";
import { BadgeIntent, type Intent, type IntentSize } from "../primitives/BadgeIntent";
import { Circle, PlayCircle, Eye, CheckCircle, XCircle } from "lucide-react";

export interface TaskStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  statusKey: TaskStatusKey | string | null;
  size?: IntentSize;
  showIcon?: boolean;
  iconOnly?: boolean;
}

const iconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const statusIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: PlayCircle,
  review: Eye,
  done: CheckCircle,
  blocked: XCircle,
};

/**
 * TaskStatusBadge displays the current status of a task
 * Uses BadgeIntent primitive for consistent design system integration
 */
export const TaskStatusBadge = forwardRef<HTMLDivElement, TaskStatusBadgeProps>(
  ({ statusKey, size = "md", showIcon = false, iconOnly = false, className, ...props }, ref) => {
    const label = getTaskStatusLabel(statusKey);
    const intent = getTaskStatusIntent(statusKey) as Intent;
    const iconSize = iconSizes[size];
    
    const IconComponent = statusIcons[statusKey as string] || Circle;

    if (iconOnly) {
      return (
        <BadgeIntent
          ref={ref}
          intent={intent}
          variant="ghost"
          size={size}
          className={cn("p-1", className)}
          title={label}
          data-testid={`icon-task-status-${statusKey || "none"}`}
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
        data-testid={`badge-task-status-${statusKey || "none"}`}
        {...props}
      >
        {showIcon && <IconComponent className={iconSize} />}
        {label}
      </BadgeIntent>
    );
  }
);

TaskStatusBadge.displayName = "TaskStatusBadge";

export default TaskStatusBadge;
