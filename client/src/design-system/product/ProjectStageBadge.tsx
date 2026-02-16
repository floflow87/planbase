/**
 * ProjectStageBadge - Design System V1 Product Component
 * 
 * Displays a project stage with proper styling
 * Uses dynamic colors from Strapi with hardcoded fallback
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { type ProjectStageKey } from "@shared/config";
import { useProjectStagesUI } from "@/hooks/useProjectStagesUI";

export interface ProjectStageBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  stageKey: ProjectStageKey | string | null;
  size?: "sm" | "md" | "lg";
  dotOnly?: boolean;
}

export const ProjectStageBadge = forwardRef<HTMLDivElement, ProjectStageBadgeProps>(
  ({ stageKey, size = "md", dotOnly = false, className, ...props }, ref) => {
    const { getLabel, getColor } = useProjectStagesUI();
    const label = getLabel(stageKey);
    const colorClass = getColor(stageKey);

    const sizeClasses = {
      sm: "text-[10px] px-1.5 py-0.5",
      md: "text-xs px-2 py-0.5",
      lg: "text-sm px-2.5 py-1",
    };

    if (dotOnly) {
      return (
        <div
          ref={ref}
          className={cn("w-2.5 h-2.5 rounded-full border", colorClass, className)}
          title={label}
          data-testid={`dot-project-stage-${stageKey || "none"}`}
          {...props}
        />
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border font-medium whitespace-nowrap",
          sizeClasses[size],
          colorClass,
          className
        )}
        data-testid={`badge-project-stage-${stageKey || "none"}`}
        {...props}
      >
        {label}
      </span>
    );
  }
);

ProjectStageBadge.displayName = "ProjectStageBadge";

export default ProjectStageBadge;
