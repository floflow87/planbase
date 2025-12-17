/**
 * ProjectStageBadge - Design System V1 Product Component
 * 
 * Displays a project stage with proper styling
 * Uses BadgeIntent primitive with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getProjectStageLabel, type ProjectStageKey } from "@shared/config";
import { getProjectStageIntent } from "@shared/design/semantics";
import { BadgeIntent, type Intent, type IntentSize } from "../primitives/BadgeIntent";

export interface ProjectStageBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  stageKey: ProjectStageKey | string | null;
  size?: IntentSize;
  dotOnly?: boolean;
}

/**
 * ProjectStageBadge displays the current stage of a project
 * Uses BadgeIntent primitive for consistent design system integration
 * 
 * @example
 * <ProjectStageBadge stageKey={project.stage} />
 * <ProjectStageBadge stageKey="en_cours" size="sm" />
 */
export const ProjectStageBadge = forwardRef<HTMLDivElement, ProjectStageBadgeProps>(
  ({ stageKey, size = "md", dotOnly = false, className, ...props }, ref) => {
    const label = getProjectStageLabel(stageKey);
    const intent = getProjectStageIntent(stageKey) as Intent;

    if (dotOnly) {
      return (
        <BadgeIntent
          ref={ref}
          intent={intent}
          variant="solid"
          size="sm"
          className={cn("w-2 h-2 p-0 min-w-0", className)}
          title={label}
          data-testid={`dot-project-stage-${stageKey || "none"}`}
          {...props}
        />
      );
    }

    return (
      <BadgeIntent
        ref={ref}
        intent={intent}
        variant="soft"
        size={size}
        className={className}
        data-testid={`badge-project-stage-${stageKey || "none"}`}
        {...props}
      >
        {label}
      </BadgeIntent>
    );
  }
);

ProjectStageBadge.displayName = "ProjectStageBadge";

export default ProjectStageBadge;
