import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Flag, 
  CheckCircle2, 
  Clock, 
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  endDate?: string;
  status: string;
  progress?: number;
}

interface MilestonesInfo {
  milestones: Milestone[];
  totalCount: number;
  upcomingCount: number;
  completedCount: number;
  nextMilestone: Milestone | null;
}

interface MilestonesZoneProps {
  projectId: string;
  onMilestoneClick?: (milestone: Milestone) => void;
}

const STATUS_ICONS: { [key: string]: typeof CheckCircle2 } = {
  done: CheckCircle2,
  in_progress: Clock,
  planned: Calendar,
  blocked: AlertCircle,
};

const STATUS_COLORS: { [key: string]: string } = {
  done: "text-green-600 dark:text-green-400",
  in_progress: "text-blue-600 dark:text-blue-400",
  planned: "text-muted-foreground",
  blocked: "text-destructive",
};

const STATUS_LABELS: { [key: string]: string } = {
  done: "Atteint",
  in_progress: "En cours",
  planned: "Planifié",
  blocked: "Bloqué",
};

export function MilestonesZone({ projectId, onMilestoneClick }: MilestonesZoneProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: milestonesData, isLoading } = useQuery<MilestonesInfo>({
    queryKey: [`/api/projects/${projectId}/roadmap/milestones`],
  });

  if (isLoading || !milestonesData || milestonesData.totalCount === 0) {
    return null;
  }

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysUntil = (dateStr: string | undefined | null): number | null => {
    if (!dateStr) return null;
    const targetDate = new Date(dateStr);
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const upcomingMilestones = milestonesData.milestones.filter(m => m.status !== "done");
  const completedMilestones = milestonesData.milestones.filter(m => m.status === "done");
  const displayedMilestones = showCompleted ? milestonesData.milestones : upcomingMilestones;

  return (
    <Card className="mb-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="py-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Flag className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Jalons ({milestonesData.upcomingCount} à venir)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {milestonesData.completedCount}/{milestonesData.totalCount} atteints
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-3">
                {displayedMilestones.map((milestone, index) => {
                  const StatusIcon = STATUS_ICONS[milestone.status] || Calendar;
                  const targetDate = milestone.targetDate || milestone.endDate;
                  const daysUntil = getDaysUntil(targetDate);
                  const isOverdue = daysUntil !== null && daysUntil < 0 && milestone.status !== "done";
                  const isNext = milestonesData.nextMilestone?.id === milestone.id;
                  
                  return (
                    <div
                      key={milestone.id}
                      className={`relative flex items-start gap-3 pl-7 pr-2 py-2 rounded-md transition-colors
                        ${onMilestoneClick ? "hover-elevate cursor-pointer" : ""}
                        ${isNext ? "bg-primary/5 border border-primary/20" : ""}
                        ${isOverdue ? "bg-destructive/5" : ""}
                      `}
                      onClick={() => onMilestoneClick?.(milestone)}
                      data-testid={`milestone-item-${milestone.id}`}
                    >
                      <div className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 bg-background
                        ${milestone.status === "done" ? "border-green-500 bg-green-500" : ""}
                        ${milestone.status === "in_progress" ? "border-blue-500" : ""}
                        ${milestone.status === "planned" ? "border-muted-foreground" : ""}
                        ${milestone.status === "blocked" ? "border-destructive" : ""}
                      `} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 shrink-0 ${STATUS_COLORS[milestone.status]}`} />
                          <span className={`text-sm font-medium truncate ${milestone.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {milestone.title}
                          </span>
                          {isNext && (
                            <Badge variant="default" className="text-[10px] py-0 h-4">
                              Prochain
                            </Badge>
                          )}
                        </div>
                        
                        {milestone.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {milestone.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-1">
                          {targetDate && (
                            <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {formatDate(targetDate)}
                              {daysUntil !== null && milestone.status !== "done" && (
                                <span className="ml-1">
                                  ({isOverdue ? `${Math.abs(daysUntil)}j de retard` : `dans ${daysUntil}j`})
                                </span>
                              )}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px] py-0">
                            {STATUS_LABELS[milestone.status] || milestone.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {completedMilestones.length > 0 && !showCompleted && (
                <div className="mt-3 pl-7">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompleted(true);
                    }}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid="button-show-completed-milestones"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Afficher {completedMilestones.length} jalon(s) atteint(s)
                  </Button>
                </div>
              )}
              
              {showCompleted && completedMilestones.length > 0 && (
                <div className="mt-3 pl-7">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompleted(false);
                    }}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid="button-hide-completed-milestones"
                  >
                    Masquer les jalons atteints
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
