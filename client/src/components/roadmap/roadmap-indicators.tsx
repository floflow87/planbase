import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Target, 
  TrendingUp,
  Flag
} from "lucide-react";

interface PhaseInfo {
  projectStartDate: string | null;
  projectEndDate: string | null;
  currentPhase: string;
  phases: {
    [key: string]: {
      start: string;
      end: string | null;
      isCurrent: boolean;
      itemCount: number;
    };
  };
  nextPhaseTransition: {
    date: string;
    phase: string;
    daysUntil: number;
  } | null;
  indicators: {
    totalItems: number;
    lateItemsCount: number;
    itemsWithoutDatesCount: number;
    unassignedPhaseCount: number;
  };
  lateItems: Array<{ id: string; title: string; endDate: string }>;
}

interface MilestonesInfo {
  milestones: Array<{
    id: string;
    title: string;
    targetDate?: string;
    endDate?: string;
    status: string;
    milestoneStatus?: string;
    milestoneType?: string;
    isCritical?: boolean;
  }>;
  totalCount: number;
  upcomingCount: number;
  completedCount: number;
  atRiskCount: number;
  overdueCount: number;
  criticalAtRiskCount: number;
  nextMilestone: {
    id: string;
    title: string;
    targetDate?: string;
    endDate?: string;
    status: string;
    milestoneStatus?: string;
    isCritical?: boolean;
  } | null;
  nextCriticalMilestone: {
    id: string;
    title: string;
    targetDate?: string;
    endDate?: string;
    status: string;
    milestoneStatus?: string;
    isCritical?: boolean;
  } | null;
}

interface RoadmapIndicatorsProps {
  projectId: string;
}

const PHASE_LABELS: { [key: string]: string } = {
  T1: "Court terme",
  T2: "Moyen terme",
  T3: "Long terme",
  LT: "Très long terme",
};

const PHASE_COLORS: { [key: string]: string } = {
  T1: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  T2: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  T3: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  LT: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
};

export function RoadmapIndicators({ projectId }: RoadmapIndicatorsProps) {
  const { data: phasesData, isLoading: isLoadingPhases } = useQuery<PhaseInfo>({
    queryKey: [`/api/projects/${projectId}/roadmap/phases`],
  });

  const { data: milestonesData, isLoading: isLoadingMilestones } = useQuery<MilestonesInfo>({
    queryKey: [`/api/projects/${projectId}/roadmap/milestones`],
  });

  if (isLoadingPhases || isLoadingMilestones) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 animate-pulse">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="h-4 bg-muted rounded w-24 mb-2" />
              <div className="h-6 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!phasesData) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/50 col-span-full">
          <CardContent className="pt-4 pb-3 px-4 text-center text-muted-foreground text-sm">
            Impossible de charger les indicateurs de phase
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  const nextMilestone = milestonesData?.nextMilestone;
  const nextMilestoneDate = nextMilestone?.targetDate || nextMilestone?.endDate;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="bg-card/50">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Phase actuelle
              </div>
              <Badge 
                variant="outline" 
                className={`font-semibold ${PHASE_COLORS[phasesData.currentPhase] || ""}`}
              >
                {PHASE_LABELS[phasesData.currentPhase] || phasesData.currentPhase}
              </Badge>
            </div>
            {phasesData.phases[phasesData.currentPhase] && (
              <div className="text-right ml-2">
                <div className="text-lg font-bold">
                  {phasesData.phases[phasesData.currentPhase].itemCount}
                </div>
                <div className="text-[10px] text-muted-foreground">éléments</div>
              </div>
            )}
          </div>
          {phasesData.nextPhaseTransition && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {phasesData.nextPhaseTransition.phase} dans {phasesData.nextPhaseTransition.daysUntil}j
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`bg-card/50 ${milestonesData?.criticalAtRiskCount && milestonesData.criticalAtRiskCount > 0 ? "border-orange-500/30" : ""}`}>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Flag className={`h-3.5 w-3.5 ${nextMilestone?.isCritical ? "text-orange-500" : ""}`} />
                {nextMilestone?.isCritical ? "Prochain milestone critique" : "Prochain milestone"}
              </div>
              {nextMilestone ? (
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium truncate" title={nextMilestone.title}>
                    {nextMilestone.title}
                  </div>
                  {nextMilestone.isCritical && (
                    <Badge variant="outline" className="shrink-0 bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20 text-[10px] px-1">
                      Critique
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  Aucun milestone planifié
                </div>
              )}
            </div>
            {nextMilestoneDate && (
              <Badge 
                variant="outline" 
                className={`ml-2 shrink-0 ${nextMilestone?.milestoneStatus === 'at_risk' ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" : nextMilestone?.milestoneStatus === 'overdue' ? "bg-destructive/10 text-destructive border-destructive/20" : ""}`}
              >
                {formatDate(nextMilestoneDate)}
              </Badge>
            )}
          </div>
          {milestonesData && milestonesData.totalCount > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                {milestonesData.completedCount}/{milestonesData.totalCount} atteints
              </div>
              {(milestonesData.atRiskCount > 0 || milestonesData.overdueCount > 0) && (
                <div className="text-xs flex items-center gap-2">
                  {milestonesData.atRiskCount > 0 && (
                    <span className="text-orange-600 dark:text-orange-400">{milestonesData.atRiskCount} à risque</span>
                  )}
                  {milestonesData.overdueCount > 0 && (
                    <span className="text-destructive">{milestonesData.overdueCount} en retard</span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`bg-card/50 ${phasesData.indicators.lateItemsCount > 0 ? "border-destructive/30" : ""}`}>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <AlertTriangle className={`h-3.5 w-3.5 ${phasesData.indicators.lateItemsCount > 0 ? "text-destructive" : ""}`} />
                Éléments en retard
              </div>
              <div className={`text-xl font-bold ${phasesData.indicators.lateItemsCount > 0 ? "text-destructive" : ""}`}>
                {phasesData.indicators.lateItemsCount}
              </div>
            </div>
          </div>
          {phasesData.lateItems && phasesData.lateItems.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground truncate" title={phasesData.lateItems[0].title}>
              {phasesData.lateItems[0].title}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Répartition par phase
              </div>
              <div className="flex gap-1 mt-1">
                {Object.entries(phasesData.phases).map(([phase, info]) => (
                  <div key={phase} className="flex-1 text-center">
                    <div className={`text-xs font-medium rounded-sm py-0.5 ${info.isCurrent ? PHASE_COLORS[phase] : "bg-muted/50 text-muted-foreground"}`}>
                      {phase}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {info.itemCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Total: {phasesData.indicators.totalItems} éléments
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
