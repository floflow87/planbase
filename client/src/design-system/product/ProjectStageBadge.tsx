/**
 * ProjectStageBadge - Design System V1 Product Component
 * 
 * Displays a project stage with proper styling
 * Consumes config + semantics for labels and colors
 */

import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProjectStageLabel, type ProjectStageKey } from "@shared/config";
import { getProjectStageClasses } from "@shared/design/semantics";

export interface ProjectStageBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The project stage key */
  stageKey: ProjectStageKey | string | null;
  /** Optional size variant */
  size?: "sm" | "md" | "lg";
  /** Show only dot indicator */
  dotOnly?: boolean;
}

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
};

/**
 * ProjectStageBadge displays the current stage of a project
 * 
 * @example
 * <ProjectStageBadge stageKey={project.stage} />
 * <ProjectStageBadge stageKey="en_cours" size="sm" />
 */
export const ProjectStageBadge = forwardRef<HTMLDivElement, ProjectStageBadgeProps>(
  ({ stageKey, size = "md", dotOnly = false, className, ...props }, ref) => {
    const label = getProjectStageLabel(stageKey);
    const colorClasses = getProjectStageClasses(stageKey);
    const sizeClass = sizeClasses[size];

    if (dotOnly) {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            colorClasses.split(" ").find(c => c.startsWith("bg-")),
            className
          )}
          title={label}
          {...props}
        />
      );
    }

    return (
      <Badge
        ref={ref}
        variant="outline"
        className={cn(
          "border font-medium",
          colorClasses,
          sizeClass,
          className
        )}
        data-testid={`badge-project-stage-${stageKey || "none"}`}
        {...props}
      >
        {label}
      </Badge>
    );
  }
);

ProjectStageBadge.displayName = "ProjectStageBadge";

export default ProjectStageBadge;
