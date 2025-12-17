/**
 * TaskStatusBadge - Design System V1 Product Component
 * 
 * Displays a task status with proper styling
 * Uses Badge component with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getTaskStatusLabel, type TaskStatusKey } from "@shared/config";
import { getTaskStatusIntent } from "@shared/design/semantics";
import { Badge, type Intent, type BadgeSize, type IntentVariant } from "@/components/ui/badge";
import { Circle, PlayCircle, Eye, CheckCircle, XCircle } from "lucide-react";

export interface TaskStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  statusKey: TaskStatusKey | string | null;
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

const statusIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: PlayCircle,
  review: Eye,
  done: CheckCircle,
  blocked: XCircle,
};

/**
 * TaskStatusBadge displays the current status of a task
 * Uses Badge component with intent for consistent design system integration
 */
export const TaskStatusBadge = forwardRef<HTMLDivElement, TaskStatusBadgeProps>(
  ({ statusKey, size = "md", showIcon = false, iconOnly = false, tone = "soft", className, ...props }, ref) => {
    const label = getTaskStatusLabel(statusKey);
    const intent = getTaskStatusIntent(statusKey) as Intent;
    const iconSize = iconSizes[size];
    
    const IconComponent = statusIcons[statusKey as string] || Circle;

    if (iconOnly) {
      return (
        <Badge
          ref={ref}
          intent={intent}
          tone="ghost"
          size={size}
          className={cn("p-1", className)}
          title={label}
          data-testid={`icon-task-status-${statusKey || "none"}`}
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
        data-testid={`badge-task-status-${statusKey || "none"}`}
        {...props}
      >
        {showIcon && <IconComponent className={iconSize} />}
        {label}
      </Badge>
    );
  }
);

TaskStatusBadge.displayName = "TaskStatusBadge";

export default TaskStatusBadge;
