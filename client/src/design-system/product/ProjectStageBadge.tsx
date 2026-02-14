/**
 * ProjectStageBadge - Design System V1 Product Component
 * 
 * Displays a project stage with proper styling
 * Uses BadgeIntent primitive with semantic intent mapping
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { type ProjectStageKey } from "@shared/config";
import { getProjectStageIntent } from "@shared/design/semantics";
import { useProjectStagesUI } from "@/hooks/useProjectStagesUI";
import { Badge, type Intent, type BadgeSize, type IntentVariant } from "@/components/ui/badge";

export interface ProjectStageBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  stageKey: ProjectStageKey | string | null;
  size?: Exclude<BadgeSize, "dot">;
  dotOnly?: boolean;
  tone?: IntentVariant;
}

/**
 * ProjectStageBadge displays the current stage of a project
 * Uses Badge component with intent for consistent design system integration
 * 
 * @example
 * <ProjectStageBadge stageKey={project.stage} />
 * <ProjectStageBadge stageKey="en_cours" size="sm" />
 * <ProjectStageBadge stageKey="termine" dotOnly />
 */
export const ProjectStageBadge = forwardRef<HTMLDivElement, ProjectStageBadgeProps>(
  ({ stageKey, size = "md", dotOnly = false, tone = "soft", className, ...props }, ref) => {
    const { getLabel } = useProjectStagesUI();
    const label = getLabel(stageKey);
    const intent = getProjectStageIntent(stageKey) as Intent;

    if (dotOnly) {
      return (
        <Badge
          ref={ref}
          intent={intent}
          size="dot"
          className={className}
          title={label}
          data-testid={`dot-project-stage-${stageKey || "none"}`}
          {...props}
        />
      );
    }

    return (
      <Badge
        ref={ref}
        intent={intent}
        tone={tone}
        size={size}
        className={className}
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
