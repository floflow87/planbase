import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Lightbulb,
  ChevronRight,
  ChevronDown,
  X
} from "lucide-react";
import { useState } from "react";

interface RelatedItem {
  id: string;
  title: string;
}

interface Recommendation {
  id: string;
  type: 'warning' | 'critical' | 'info' | 'suggestion';
  title: string;
  description: string;
  action?: string;
  relatedItemId?: string;
  relatedItemTitle?: string;
  relatedItems?: RelatedItem[];
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: [`/api/projects/${projectId}/roadmap/recommendations`],
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardContent className="py-[10px] px-4">
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

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card className="bg-card/50">
      <CardHeader className="py-[10px] px-4">
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
      <CardContent className="px-4 pb-[10px] pt-0 space-y-2">
        {displayedRecommendations.map((rec) => {
          const config = TYPE_CONFIG[rec.type];
          const Icon = config.icon;
          const isExpanded = expandedIds.has(rec.id);
          
          return (
            <Collapsible 
              key={rec.id}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(rec.id)}
            >
              <div 
                className="rounded-md bg-muted/30"
                data-testid={`recommendation-${rec.id}`}
              >
                <CollapsibleTrigger className="w-full text-left">
                  <div className="flex items-center gap-3 p-2 cursor-pointer">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
                    <span className="text-sm font-medium flex-1 truncate">{rec.title}</span>
                    <Badge variant="outline" className={`${config.badgeClass} shrink-0`}>
                      {config.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDismiss(rec.id); }}
                      data-testid={`button-dismiss-${rec.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-2 pl-[3.25rem] space-y-1.5">
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                    {rec.action && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {rec.action}
                      </p>
                    )}
                    {rec.relatedItems && rec.relatedItems.length > 0 && (
                      <div className="space-y-1 mt-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Éléments concernés</p>
                        {rec.relatedItems.map(item => (
                          <div key={item.id} className="text-xs py-1 px-2 bg-muted/50 rounded truncate">
                            {item.title}
                          </div>
                        ))}
                        {rec.relatedItems.length >= 10 && (
                          <p className="text-[10px] text-muted-foreground italic">... et plus</p>
                        )}
                      </div>
                    )}
                    {rec.relatedItemId && onItemClick && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs px-2"
                        onClick={() => onItemClick(rec.relatedItemId!)}
                        data-testid={`button-view-item-${rec.id}`}
                      >
                        Voir l'élément
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
