import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Euro, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  RefreshCw,
  Info,
  ChevronRight,
  BarChart3,
  PieChart,
  Target,
  Lightbulb,
  Eye,
  Zap,
  Shield,
  StopCircle,
  PauseCircle
} from "lucide-react";
import { Link } from "wouter";
import type { Project } from "@shared/schema";

interface ProfitabilityMetrics {
  actualDaysWorked: number;
  theoreticalDays: number;
  timeOverrun: number;
  timeOverrunPercent: number;
  totalBilled: number;
  totalPaid: number;
  remainingToPay: number;
  paymentProgress: number;
  targetTJM: number;
  actualTJM: number;
  tjmGap: number;
  tjmGapPercent: number;
  internalDailyCost: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  targetMarginPercent: number;
  status: 'profitable' | 'at_risk' | 'deficit';
  statusLabel: string;
  statusColor: string;
}

type DecisionType = 'optimize' | 'accelerate' | 'slowdown' | 'stop' | 'protect';
type Feasibility = 'realistic' | 'discuss' | 'unrealistic';

interface ScoreBreakdown {
  total: number;
  components: {
    label: string;
    value: number;
    description: string;
  }[];
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number;
  scoreBreakdown?: ScoreBreakdown;
  decisionType: DecisionType;
  decisionLabel: string;
  issue: string;
  action: string;
  impact: string;
  impactValue?: number;
  feasibility: Feasibility;
  feasibilityLabel: string;
  category: 'pricing' | 'time' | 'payment' | 'model' | 'strategic';
  icon: string;
}

interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  metrics: ProfitabilityMetrics;
  recommendations: Recommendation[];
  generatedAt: string;
}

interface ProfitabilitySummary {
  projects: ProfitabilityAnalysis[];
  aggregate: {
    totalBilled: number;
    totalPaid: number;
    totalMargin: number;
    totalCost: number;
    potentialRevenue: number;
    potentialProjectCount: number;
    averageMarginPercent: number;
    profitableCount: number;
    atRiskCount: number;
    deficitCount: number;
    projectCount: number;
  };
  generatedAt: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(value);
};

const formatNumber = (value: number, decimals = 1) => {
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  }).format(value);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'profitable':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'at_risk':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'deficit':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'profitable':
      return <CheckCircle className="w-4 h-4" />;
    case 'at_risk':
      return <AlertTriangle className="w-4 h-4" />;
    case 'deficit':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return null;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-50 border-red-200 hover:bg-red-100';
    case 'medium':
      return 'bg-orange-50 border-orange-200 hover:bg-orange-100';
    case 'low':
      return 'bg-green-50 border-green-200 hover:bg-green-100';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
    case 'medium':
      return <Badge className="text-xs bg-orange-500 hover:bg-orange-600">Important</Badge>;
    case 'low':
      return <Badge variant="secondary" className="text-xs">Information</Badge>;
    default:
      return null;
  }
};

const getRecommendationIcon = (iconName: string) => {
  switch (iconName) {
    case 'AlertTriangle':
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    case 'TrendingUp':
      return <TrendingUp className="w-5 h-5 text-orange-500" />;
    case 'DollarSign':
      return <DollarSign className="w-5 h-5 text-violet-500" />;
    case 'Clock':
      return <Clock className="w-5 h-5 text-blue-500" />;
    case 'CreditCard':
      return <CreditCard className="w-5 h-5 text-cyan-500" />;
    case 'RefreshCw':
      return <RefreshCw className="w-5 h-5 text-gray-500" />;
    case 'CheckCircle':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'Zap':
      return <Zap className="w-5 h-5 text-yellow-500" />;
    case 'Shield':
      return <Shield className="w-5 h-5 text-violet-500" />;
    case 'StopCircle':
      return <StopCircle className="w-5 h-5 text-red-600" />;
    case 'PauseCircle':
      return <PauseCircle className="w-5 h-5 text-orange-500" />;
    default:
      return <Lightbulb className="w-5 h-5 text-yellow-500" />;
  }
};

const getDecisionBadge = (decisionType: DecisionType, decisionLabel: string) => {
  const colors: Record<DecisionType, string> = {
    optimize: 'bg-green-100 text-green-700 border-green-200',
    accelerate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    slowdown: 'bg-orange-100 text-orange-700 border-orange-200',
    stop: 'bg-red-100 text-red-700 border-red-200',
    protect: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <Badge className={`text-xs border ${colors[decisionType]}`}>
      {decisionLabel}
    </Badge>
  );
};

const getFeasibilityBadge = (feasibility: Feasibility, label: string) => {
  const colors: Record<Feasibility, string> = {
    realistic: 'text-green-600',
    discuss: 'text-orange-600',
    unrealistic: 'text-red-600',
  };
  const icons: Record<Feasibility, JSX.Element> = {
    realistic: <CheckCircle className="w-3 h-3" />,
    discuss: <AlertTriangle className="w-3 h-3" />,
    unrealistic: <StopCircle className="w-3 h-3" />,
  };
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colors[feasibility]}`}>
      {icons[feasibility]}
      {label}
    </span>
  );
};

// Score priority level helpers - 3 levels aligned with grouping
type ScoreLevel = 'critical' | 'important' | 'suggestion';

const getScoreLevel = (score: number): ScoreLevel => {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'important';
  return 'suggestion';
};

const getScoreLevelInfo = (level: ScoreLevel) => {
  const info = {
    critical: { 
      label: 'Critique', 
      color: 'bg-red-500 text-white',
      barColor: 'bg-red-500',
      borderColor: 'border-red-300',
      bgColor: 'bg-red-50'
    },
    important: { 
      label: 'Important', 
      color: 'bg-orange-500 text-white',
      barColor: 'bg-orange-500',
      borderColor: 'border-orange-300',
      bgColor: 'bg-orange-50'
    },
    suggestion: { 
      label: 'Suggestion', 
      color: 'bg-gray-500 text-white',
      barColor: 'bg-gray-400',
      borderColor: 'border-gray-300',
      bgColor: 'bg-gray-50'
    },
  };
  return info[level];
};

// Score badge component with tooltip showing breakdown
function ScoreBadge({ score, breakdown }: { score: number; breakdown?: ScoreBreakdown }) {
  const level = getScoreLevel(score);
  const levelInfo = getScoreLevelInfo(level);
  
  // Get color for component value: negative=red, zero=gray, positive=green
  const getValueColor = (value: number) => {
    if (value < 0) return 'text-red-600';
    if (value === 0) return 'text-gray-400';
    return 'text-green-700';
  };
  
  // Format value with appropriate sign
  const formatValue = (value: number) => {
    if (value > 0) return `+${value}`;
    return value.toString();
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help">
          <Badge className={`text-xs font-bold ${levelInfo.color}`}>
            {score}/100
          </Badge>
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${levelInfo.barColor} transition-all`}
              style={{ width: `${Math.max(score, 5)}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-sm p-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Decomposition du score</p>
          {breakdown && breakdown.components.length > 0 ? (
            <div className="space-y-1.5">
              {breakdown.components.map((comp, idx) => (
                <div key={idx} className="text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-700 font-medium">{comp.label}</span>
                    <span className={`font-semibold ${getValueColor(comp.value)}`}>
                      {formatValue(comp.value)} pts
                    </span>
                  </div>
                  {comp.description && (
                    <p className="text-gray-500 text-[10px] mt-0.5">{comp.description}</p>
                  )}
                </div>
              ))}
              <div className="pt-2 mt-2 border-t flex items-center justify-between text-sm font-bold">
                <span>Score final</span>
                <span className={getValueColor(score)}>{score}/100</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Score base sur l'impact et l'urgence</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  color = 'violet'
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: any; 
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}) {
  const colorClasses = {
    violet: 'bg-violet-100 text-violet-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
    cyan: 'bg-cyan-100 text-cyan-600',
  };

  return (
    <Card data-testid={`card-summary-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.violet}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{title}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
               trend === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
              <span className="text-sm font-medium">{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectProfitabilityCard({ analysis }: { analysis: ProfitabilityAnalysis }) {
  const { metrics, recommendations, projectName, projectId } = analysis;
  
  return (
    <Card className="hover-elevate" data-testid={`card-project-${projectId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link href={`/projects/${projectId}`} className="font-semibold text-gray-900 hover:text-violet-600 truncate">
              {projectName}
            </Link>
            <Badge className={`shrink-0 ${getStatusColor(metrics.status)}`}>
              {getStatusIcon(metrics.status)}
              <span className="ml-1">{metrics.statusLabel}</span>
            </Badge>
          </div>
          <span className={`text-2xl font-bold ${
            metrics.marginPercent >= 15 ? 'text-green-600' : 
            metrics.marginPercent >= 0 ? 'text-orange-600' : 'text-red-600'
          }`}>
            {formatNumber(metrics.marginPercent)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Facturé</span>
              <span className="font-medium">{formatCurrency(metrics.totalBilled)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Encaissé</span>
              <span className="font-medium text-green-600">{formatCurrency(metrics.totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Marge</span>
              <span className={`font-medium ${metrics.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.margin)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">TJM réel</span>
              <span className={`font-medium ${metrics.tjmGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.actualTJM)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Jours passés</span>
              <span className="font-medium">{formatNumber(metrics.actualDaysWorked)} j</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Coût total</span>
              <span className="font-medium text-gray-700">{formatCurrency(metrics.totalCost)}</span>
            </div>
          </div>
        </div>

        {metrics.paymentProgress < 100 && metrics.totalBilled > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Paiement</span>
              <span className="font-medium">{formatNumber(metrics.paymentProgress, 0)}%</span>
            </div>
            <Progress value={metrics.paymentProgress} className="h-2" />
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium text-gray-600">
                {recommendations.length} recommandation{recommendations.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {recommendations.slice(0, 2).map((rec) => (
                <div 
                  key={rec.id} 
                  className={`p-2 rounded-lg border text-xs ${getPriorityColor(rec.priority)}`}
                >
                  <p className="text-gray-700 font-medium">{rec.issue}</p>
                </div>
              ))}
              {recommendations.length > 2 && (
                <p className="text-xs text-gray-400">+{recommendations.length - 2} autres</p>
              )}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="w-full justify-between text-violet-600 hover:text-violet-700 hover:bg-violet-50" data-testid={`button-view-project-${projectId}`}>
              Voir le projet
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const scoreLevel = getScoreLevel(recommendation.priorityScore);
  const levelInfo = getScoreLevelInfo(scoreLevel);
  
  return (
    <Card className={`border-2 ${levelInfo.borderColor} ${levelInfo.bgColor}`} data-testid={`card-recommendation-${recommendation.id}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Decision type + Score badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {getRecommendationIcon(recommendation.icon)}
              {recommendation.decisionType && recommendation.decisionLabel && 
                getDecisionBadge(recommendation.decisionType, recommendation.decisionLabel)
              }
            </div>
            <ScoreBadge score={recommendation.priorityScore} breakdown={recommendation.scoreBreakdown} />
          </div>
          
          {/* Block 1: Pourquoi (Issue) */}
          <div className="bg-white/80 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Pourquoi</p>
            <p className="text-sm text-gray-700 font-medium">{recommendation.issue}</p>
          </div>
          
          {/* Block 2: Action recommandée */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Action recommandee</p>
            <p className="text-sm text-gray-600">{recommendation.action}</p>
          </div>
          
          {/* Block 3: Impact + Feasibility */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">{recommendation.impact}</span>
            </div>
            {recommendation.feasibility && recommendation.feasibilityLabel && 
              getFeasibilityBadge(recommendation.feasibility, recommendation.feasibilityLabel)
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Top Priority Card - Shows the #1 priority action (3 levels: critical, important, suggestion)
function TopPriorityCard({ recommendation, projectName }: { recommendation: Recommendation; projectName: string }) {
  const level = getScoreLevel(recommendation.priorityScore);
  
  // Dynamic styling based on priority level - aligned with grouping sections
  const cardStyles: Record<ScoreLevel, string> = {
    critical: 'border-red-400 bg-gradient-to-r from-red-50 to-orange-50',
    important: 'border-orange-400 bg-gradient-to-r from-orange-50 to-yellow-50',
    suggestion: 'border-gray-300 bg-gradient-to-r from-gray-50 to-slate-50'
  };
  
  const iconStyles: Record<ScoreLevel, string> = {
    critical: 'bg-red-100 text-red-600',
    important: 'bg-orange-100 text-orange-600',
    suggestion: 'bg-gray-100 text-gray-500'
  };
  
  const badgeStyles: Record<ScoreLevel, string> = {
    critical: 'bg-red-600 text-white',
    important: 'bg-orange-500 text-white',
    suggestion: 'bg-gray-500 text-white'
  };
  
  const levelLabels: Record<ScoreLevel, string> = {
    critical: 'Action critique',
    important: 'Action importante',
    suggestion: 'Suggestion'
  };
  
  return (
    <Card className={`border-2 ${cardStyles[level]}`} data-testid="card-top-priority">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg shrink-0 ${iconStyles[level]}`}>
            {level === 'critical' ? <AlertTriangle className="w-6 h-6" /> : 
             level === 'important' ? <Clock className="w-6 h-6" /> :
             <Lightbulb className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs font-bold ${badgeStyles[level]}`}>
                  {levelLabels[level]}
                </Badge>
                {recommendation.decisionType && recommendation.decisionLabel && 
                  getDecisionBadge(recommendation.decisionType, recommendation.decisionLabel)
                }
              </div>
              <ScoreBadge score={recommendation.priorityScore} breakdown={recommendation.scoreBreakdown} />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{projectName}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendation.issue}</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Target className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">{recommendation.impact}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-violet-100 rounded-full">
          <PieChart className="w-8 h-8 text-violet-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Aucune donnée de rentabilité</h3>
          <p className="text-sm text-gray-500 mt-1">
            Créez des projets et enregistrez du temps pour voir l'analyse de rentabilité.
          </p>
        </div>
        <Link href="/projects">
          <Button className="mt-2" data-testid="button-go-to-projects">
            Voir les projets
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function Finance() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'profitable' | 'at_risk' | 'deficit'>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [hiddenRecommendations, setHiddenRecommendations] = useState<Set<string>>(new Set());

  const toggleRecommendation = (recKey: string) => {
    setHiddenRecommendations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recKey)) {
        newSet.delete(recKey);
      } else {
        newSet.add(recKey);
      }
      return newSet;
    });
  };

  const { data: summary, isLoading, error } = useQuery<ProfitabilitySummary>({
    queryKey: ['/api/profitability/summary'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturation & Rentabilité</h1>
            <p className="text-sm text-gray-500 mt-1">Analyse financière et recommandations</p>
          </div>
        </div>
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center border-red-200 bg-red-50">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Erreur de chargement</h3>
          <p className="text-sm text-gray-500 mt-1">
            Impossible de charger les données de rentabilité.
          </p>
        </Card>
      </div>
    );
  }

  if (!summary || summary.projects.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturation & Rentabilité</h1>
            <p className="text-sm text-gray-500 mt-1">Analyse financière et recommandations</p>
          </div>
        </div>
        <EmptyState />
      </div>
    );
  }

  const { aggregate, projects } = summary;

  const filteredProjects = projects.filter(p => {
    if (selectedFilter === 'all') return true;
    return p.metrics.status === selectedFilter;
  });

  const allRecommendations = projects
    .flatMap(p => p.recommendations.map(r => ({ ...r, projectName: p.projectName, projectId: p.projectId })))
    .sort((a, b) => b.priorityScore - a.priorityScore); // Sort by score descending
  
  const topPriorityRec = allRecommendations.length > 0 ? allRecommendations[0] : null;
  const criticalRecommendations = allRecommendations.filter(r => r.priorityScore >= 80);
  const importantRecommendations = allRecommendations.filter(r => r.priorityScore >= 50 && r.priorityScore < 80);
  const otherRecommendations = allRecommendations.filter(r => r.priorityScore < 50);

  const highPriorityCount = criticalRecommendations.length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full" data-testid="page-finance">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation & Rentabilité</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyse financière de {aggregate.projectCount} projet{aggregate.projectCount > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-info">
                <Info className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Les calculs sont basés sur le temps enregistré, les montants facturés et votre coût journalier interne.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2" data-testid="tab-projects">
              <PieChart className="w-4 h-4" />
              Par projet
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2" data-testid="tab-recommendations">
              <Lightbulb className="w-4 h-4" />
              Recommandations
              {highPriorityCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {highPriorityCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          {hiddenRecommendations.size > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenRecommendations.size} recommandation{hiddenRecommendations.size > 1 ? 's' : ''} masquée{hiddenRecommendations.size > 1 ? 's' : ''} 
              <Button
                variant="link"
                className="h-auto p-0 ml-1 text-xs"
                onClick={() => setHiddenRecommendations(new Set())}
                data-testid="button-show-all-recommendations-header"
              >
                Tout afficher
              </Button>
            </p>
          )}
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryCard
              title="CA facturé"
              value={formatCurrency(aggregate.totalBilled)}
              subtitle={`${aggregate.projectCount} projet${aggregate.projectCount > 1 ? 's' : ''} actif${aggregate.projectCount > 1 ? 's' : ''}`}
              icon={Euro}
              color="violet"
            />
            <SummaryCard
              title="CA potentiel"
              value={formatCurrency(aggregate.potentialRevenue || 0)}
              subtitle={`${aggregate.potentialProjectCount || 0} prospect${(aggregate.potentialProjectCount || 0) > 1 ? 's' : ''}`}
              icon={Target}
              color="cyan"
            />
            <SummaryCard
              title="Marge totale"
              value={formatCurrency(aggregate.totalMargin)}
              subtitle={`${formatNumber(aggregate.averageMarginPercent)}% de marge moyenne`}
              icon={TrendingUp}
              trend={aggregate.averageMarginPercent >= 15 ? 'up' : aggregate.averageMarginPercent >= 0 ? 'neutral' : 'down'}
              trendValue={`${formatNumber(aggregate.averageMarginPercent)}%`}
              color={aggregate.averageMarginPercent >= 15 ? 'green' : aggregate.averageMarginPercent >= 0 ? 'orange' : 'red'}
            />
            <SummaryCard
              title="Coûts internes"
              value={formatCurrency(aggregate.totalCost)}
              subtitle="Temps passé valorisé"
              icon={Clock}
              color="cyan"
            />
            <SummaryCard
              title="À encaisser"
              value={formatCurrency(aggregate.totalBilled - aggregate.totalPaid)}
              subtitle="Montant restant"
              icon={CreditCard}
              color="orange"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Répartition des projets</CardTitle>
              <CardDescription>Statut de rentabilité de vos projets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200" data-testid="status-profitable">
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{aggregate.profitableCount}</p>
                    <p className="text-sm text-green-600">Projets rentables</p>
                    <p className="text-xs text-green-500">Marge &gt; 15%</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-orange-50 border border-orange-200" data-testid="status-at-risk">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{aggregate.atRiskCount}</p>
                    <p className="text-sm text-orange-600">Projets à risque</p>
                    <p className="text-xs text-orange-500">Marge 0-15%</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 border border-red-200" data-testid="status-deficit">
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700">{aggregate.deficitCount}</p>
                    <p className="text-sm text-red-600">Projets déficitaires</p>
                    <p className="text-xs text-red-500">Marge &lt; 0%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Priority Section - Always show if recommendations exist */}
          {topPriorityRec && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Action prioritaire</h3>
                <Button 
                  variant="link" 
                  className="text-violet-600 p-0 h-auto"
                  onClick={() => setActiveTab('recommendations')}
                  data-testid="button-view-all-recommendations"
                >
                  Voir toutes les recommandations ({allRecommendations.length})
                </Button>
              </div>
              <TopPriorityCard 
                recommendation={topPriorityRec} 
                projectName={topPriorityRec.projectName} 
              />
            </div>
          )}

          {highPriorityCount > 1 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-orange-700">
                        {highPriorityCount - 1} autre{highPriorityCount > 2 ? 's' : ''} action{highPriorityCount > 2 ? 's' : ''} critique{highPriorityCount > 2 ? 's' : ''}
                      </p>
                      <p className="text-sm text-orange-600">
                        Requiert une attention immédiate
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                    onClick={() => setActiveTab('recommendations')}
                    data-testid="button-view-recommendations"
                  >
                    Voir les details
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="flex items-center justify-between">
            <Select value={selectedFilter} onValueChange={(v) => setSelectedFilter(v as any)}>
              <SelectTrigger className="w-48" data-testid="select-filter">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                <SelectItem value="profitable">Rentables</SelectItem>
                <SelectItem value="at_risk">À risque</SelectItem>
                <SelectItem value="deficit">Déficitaires</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''}
            </p>
          </div>

          {filteredProjects.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Aucun projet correspondant au filtre sélectionné</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectProfitabilityCard key={project.projectId} analysis={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {allRecommendations.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Excellent travail !</p>
              <p className="text-sm text-gray-500 mt-1">
                Tous vos projets sont bien optimises. Continuez ainsi.
              </p>
            </Card>
          ) : (
            <>
              {/* Critical recommendations */}
              {criticalRecommendations.filter(r => !hiddenRecommendations.has(`${r.projectId}-${r.id}`)).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Actions critiques ({criticalRecommendations.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {criticalRecommendations
                      .filter(rec => !hiddenRecommendations.has(`${rec.projectId}-${rec.id}`))
                      .map((rec) => {
                        const recKey = `${rec.projectId}-${rec.id}`;
                        return (
                          <div key={recKey}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Link href={`/projects/${rec.projectId}`} className="text-sm font-medium text-violet-600 hover:underline">
                                {rec.projectName}
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRecommendation(recKey)}
                                data-testid={`button-toggle-recommendation-${rec.id}`}
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </Button>
                            </div>
                            <RecommendationCard recommendation={rec} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Important recommendations */}
              {importantRecommendations.filter(r => !hiddenRecommendations.has(`${r.projectId}-${r.id}`)).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Actions importantes ({importantRecommendations.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {importantRecommendations
                      .filter(rec => !hiddenRecommendations.has(`${rec.projectId}-${rec.id}`))
                      .map((rec) => {
                        const recKey = `${rec.projectId}-${rec.id}`;
                        return (
                          <div key={recKey}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Link href={`/projects/${rec.projectId}`} className="text-sm font-medium text-violet-600 hover:underline">
                                {rec.projectName}
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRecommendation(recKey)}
                                data-testid={`button-toggle-recommendation-${rec.id}`}
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </Button>
                            </div>
                            <RecommendationCard recommendation={rec} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Other recommendations */}
              {otherRecommendations.filter(r => !hiddenRecommendations.has(`${r.projectId}-${r.id}`)).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Suggestions ({otherRecommendations.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {otherRecommendations
                      .filter(rec => !hiddenRecommendations.has(`${rec.projectId}-${rec.id}`))
                      .map((rec) => {
                        const recKey = `${rec.projectId}-${rec.id}`;
                        return (
                          <div key={recKey}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Link href={`/projects/${rec.projectId}`} className="text-sm font-medium text-violet-600 hover:underline">
                                {rec.projectName}
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleRecommendation(recKey)}
                                data-testid={`button-toggle-recommendation-${rec.id}`}
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </Button>
                            </div>
                            <RecommendationCard recommendation={rec} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {hiddenRecommendations.size > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {hiddenRecommendations.size} recommandation{hiddenRecommendations.size > 1 ? 's' : ''} masquee{hiddenRecommendations.size > 1 ? 's' : ''} 
                    <Button
                      variant="link"
                      className="h-auto p-0 ml-1 text-xs"
                      onClick={() => setHiddenRecommendations(new Set())}
                      data-testid="button-show-all-recommendations"
                    >
                      Tout afficher
                    </Button>
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
