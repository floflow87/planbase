import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Lightbulb,
  ChevronRight,
  X
} from "lucide-react";
import { useState } from "react";

interface Recommendation {
  id: string;
  type: 'warning' | 'critical' | 'info' | 'suggestion';
  title: string;
  description: string;
  action?: string;
  relatedItemId?: string;
  relatedItemTitle?: string;
  priority: number;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    suggestionCount: number;
  };
}

interface RoadmapRecommendationsProps {
  projectId: string;
  onItemClick?: (itemId: string) => void;
}

const TYPE_CONFIG = {
  critical: {
    icon: AlertCircle,
    label: "Critique",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    iconClass: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    label: "Attention",
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    iconClass: "text-orange-500",
  },
  info: {
    icon: Info,
    label: "Info",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    iconClass: "text-blue-500",
  },
  suggestion: {
    icon: Lightbulb,
    label: "Suggestion",
    badgeClass: "bg-muted text-muted-foreground border-muted-foreground/20",
    iconClass: "text-muted-foreground",
  },
};

export function RoadmapRecommendations({ projectId, onItemClick }: RoadmapRecommendationsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: [`/api/projects/${projectId}/roadmap/recommendations`],
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return null;
  }

  const activeRecommendations = data.recommendations.filter(r => !dismissedIds.has(r.id));
  
  if (activeRecommendations.length === 0) {
    return null;
  }

  const displayedRecommendations = showAll 
    ? activeRecommendations 
    : activeRecommendations.slice(0, 3);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  return (
    <Card className="bg-card/50 mb-4">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Recommandations
            {data.summary.criticalCount > 0 && (
              <Badge variant="outline" className={TYPE_CONFIG.critical.badgeClass}>
                {data.summary.criticalCount} critique{data.summary.criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {data.summary.warningCount > 0 && (
              <Badge variant="outline" className={TYPE_CONFIG.warning.badgeClass}>
                {data.summary.warningCount} attention
              </Badge>
            )}
          </CardTitle>
          {activeRecommendations.length > 3 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAll(!showAll)}
              data-testid="button-toggle-recommendations"
            >
              {showAll ? 'Moins' : `Voir tout (${activeRecommendations.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {displayedRecommendations.map((rec) => {
          const config = TYPE_CONFIG[rec.type];
          const Icon = config.icon;
          
          return (
            <div 
              key={rec.id}
              className="flex items-start gap-3 p-2 rounded-md bg-muted/30 group"
              data-testid={`recommendation-${rec.id}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconClass}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{rec.title}</span>
                  <Badge variant="outline" className={config.badgeClass}>
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
                {rec.action && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    {rec.action}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {rec.relatedItemId && onItemClick && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onItemClick(rec.relatedItemId!)}
                    data-testid={`button-view-item-${rec.id}`}
                  >
                    Voir
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDismiss(rec.id)}
                  data-testid={`button-dismiss-${rec.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
