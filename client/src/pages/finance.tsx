import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PermissionGuard, ReadOnlyBanner, useReadOnlyMode } from "@/components/guards/PermissionGuard";
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
  PauseCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  EyeOff,
  RotateCcw,
  CalendarCheck,
  Flame
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ScoreRing } from "@/components/ScoreRing";
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

interface DecisionLabel {
  emoji: string;
  label: string;
  timing: string;
}

type RecommendationHorizon = 'immediate' | 'strategic' | 'learning';

interface HorizonInfo {
  label: string;
  description: string;
  isActionable: boolean;
}

interface RecommendationBlocks {
  pastImpact: {
    amount: number;
    condition: string;
    period: string;
  };
  currentImplication: {
    isPast: boolean;
    message: string;
    actionableOn: string[];
  };
  concreteAction: {
    primary: string;
    alternatives: string[];
  };
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number;
  scoreBreakdown?: ScoreBreakdown;
  decisionType: DecisionType;
  decisionLabel: string | DecisionLabel;
  decision?: string;
  decisionInfo?: {
    emoji: string;
    label: string;
    timing: string;
  };
  horizon?: RecommendationHorizon;
  horizonInfo?: HorizonInfo;
  blocks?: RecommendationBlocks;
  issue: string;
  action: string;
  impact: string;
  impactValue?: number;
  feasibility: Feasibility;
  feasibilityLabel: string;
  category: 'pricing' | 'time' | 'payment' | 'model' | 'strategic';
  icon: string;
  projectId?: string;
  projectName?: string;
}

interface RecommendationActionData {
  id: string;
  accountId: string;
  projectId: string;
  recommendationKey: string;
  action: 'treated' | 'ignored';
  note: string | null;
  createdBy: string;
  createdAt: string;
}

interface HealthScoreBreakdown {
  total: number;
  isEvaluable?: boolean;
  completenessPercent?: number;
  missingData?: string[];
  components: {
    label: string;
    value: number;
    maxValue: number;
    description: string;
    hasData?: boolean;
  }[];
}

interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  metrics: ProfitabilityMetrics;
  recommendations: Recommendation[];
  healthScore: number;
  healthScoreBreakdown: HealthScoreBreakdown;
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
    internalProjectCount?: number;
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

// Score priority level helpers - 5 levels for better UX clarity
type ScoreLevel = 'critical' | 'important' | 'suggestion';
type PriorityLabel = 'Critique' | 'À traiter' | 'À planifier' | 'Suggestion' | 'Information';

const getScoreLevel = (score: number): ScoreLevel => {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'important';
  return 'suggestion';
};

const getPriorityLabel = (score: number): { emoji: string; label: PriorityLabel; timing: string } => {
  if (score >= 90) return { emoji: '🚨', label: 'Critique', timing: 'Maintenant' };
  if (score >= 70) return { emoji: '⚡', label: 'À traiter', timing: 'Cette semaine' };
  if (score >= 50) return { emoji: '📅', label: 'À planifier', timing: 'Ce mois' };
  if (score >= 30) return { emoji: '💡', label: 'Suggestion', timing: 'Quand possible' };
  return { emoji: 'ℹ️', label: 'Information', timing: 'Pour info' };
};

// Score color gradient: red (0-30), orange (31-60), yellow (61-80), green (81-100)
const getScoreColor = (score: number): { bg: string; text: string; border: string; iconBg: string } => {
  // Palette douce - pas de rouge sauf pour pertes réelles
  if (score <= 30) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', iconBg: 'bg-rose-400' };
  if (score <= 60) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', iconBg: 'bg-amber-400' };
  if (score <= 80) return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', iconBg: 'bg-violet-400' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-400' };
};

const generatePriorityAction = (rec: Recommendation): string => {
  // Generate a short, imperative phrase with clear unit and horizon
  if (rec.impactValue) {
    const amount = Math.abs(rec.impactValue);
    const isLoss = rec.impactValue < 0;
    
    if (rec.category === 'pricing') {
      return isLoss 
        ? `Ajuster le prix pour limiter ${formatCurrency(amount)} de perte sur ce projet`
        : `Ajuster le prix pour récupérer ${formatCurrency(amount)} sur ce projet`;
    }
    if (rec.category === 'time') {
      return isLoss 
        ? `Réduire le temps passé pour éviter ${formatCurrency(amount)} de surcoût par jour`
        : `Optimiser le temps pour économiser ${formatCurrency(amount)} par jour`;
    }
    if (rec.category === 'payment') {
      return isLoss 
        ? `Relancer le client pour encaisser ${formatCurrency(amount)} en attente`
        : `Encaisser ${formatCurrency(amount)} restant sur ce projet`;
    }
    if (rec.category === 'model') {
      return isLoss 
        ? `Revoir le modèle économique : ${formatCurrency(amount)} de perte par projet`
        : `Optimiser le modèle : ${formatCurrency(amount)} de gain par projet`;
    }
    if (rec.category === 'strategic') {
      return isLoss 
        ? `Réévaluer ce projet : ${formatCurrency(amount)} à risque`
        : `Capitaliser sur ce projet : ${formatCurrency(amount)} de valeur future`;
    }
  }
  // Fallback based on decision type with imperative phrases
  const decisionPhrases: Record<DecisionType, string> = {
    optimize: 'Optimiser la rentabilité de ce projet',
    accelerate: 'Accélérer les encaissements',
    slowdown: 'Réduire le temps passé sur ce projet',
    stop: 'Stopper ou renégocier ce projet',
    protect: 'Sécuriser les marges acquises',
  };
  return decisionPhrases[rec.decisionType] || rec.action;
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
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.violet}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <p className="text-base font-bold text-foreground">{value}</p>
              {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : 
               trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
              <span className="text-xs font-medium">{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectProfitabilityCard({ analysis }: { analysis: ProfitabilityAnalysis }) {
  const { metrics, recommendations, projectName, projectId, healthScore, healthScoreBreakdown } = analysis;
  
  return (
    <Card className="transition-colors hover:border-violet-200 flex flex-col" data-testid={`card-project-${projectId}`}>
      {/* ZONE HAUTE: Nom + Badges statut */}
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-foreground truncate mb-1.5">{projectName}</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={`text-[10px] shrink-0 ${getStatusColor(metrics.status)}`}>
                {getStatusIcon(metrics.status)}
                <span className="ml-1">{metrics.statusLabel}</span>
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      {/* ZONE CENTRALE: KPIs essentiels + barre paiement */}
      <CardContent className="space-y-2 flex-1 px-4">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Facturé</span>
            <span className="font-medium text-foreground">{formatCurrency(metrics.totalBilled)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Encaissé</span>
            <span className="font-medium text-emerald-600">{formatCurrency(metrics.totalPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Marge</span>
            <span className={`font-medium ${metrics.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(metrics.margin)} ({formatNumber(metrics.marginPercent)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TJM réel</span>
            <span className="font-medium text-foreground">{metrics.actualTJM ? formatCurrency(metrics.actualTJM) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jours passés</span>
            <span className="font-medium text-foreground">{metrics.actualDaysWorked ? `${formatNumber(metrics.actualDaysWorked, 1)} j` : '-'}</span>
          </div>
        </div>

        {/* Barre de paiement si pertinente */}
        {metrics.paymentProgress < 100 && metrics.totalBilled > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1 cursor-help">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Paiement</span>
                  <span className="font-medium text-foreground">{formatNumber(metrics.paymentProgress, 0)}%</span>
                </div>
                <Progress value={metrics.paymentProgress} className="h-1" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>{formatCurrency(metrics.totalPaid)} encaissé sur {formatCurrency(metrics.totalBilled)} facturé</p>
              <p className="text-muted-foreground">Reste à encaisser : {formatCurrency(metrics.totalBilled - metrics.totalPaid)}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
      
      {/* ZONE BASSE (fixe, alignée): Health Score + Badge recommandations + Bouton */}
      <div className="px-4 pb-3 pt-2 border-t mt-auto space-y-2">
        {/* Health Score visuel + Badge recommandations */}
        <div className="flex items-center justify-between gap-2">
          {/* Health Score avec ScoreRing */}
          <ScoreRing 
            score={healthScore} 
            size={40}
            strokeWidth={4}
            breakdown={healthScoreBreakdown}
            label="Score de santé"
          />
          
          {/* Badge recommandations avec mini-list hover */}
          {recommendations.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-xs gap-1">
                  <Lightbulb className="w-3 h-3" />
                  {recommendations.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-2 border shadow-lg">
                <ul className="space-y-1 text-xs">
                  {recommendations.slice(0, 3).map((rec) => (
                    <li key={rec.id} className="flex items-center gap-2 text-foreground">
                      <span className="text-muted-foreground">•</span>
                      <span className="line-clamp-1">
                        {generatePriorityAction(rec)}
                        {rec.impactValue && rec.impactValue > 0 && (
                          <span className="text-emerald-600 ml-1">(+{formatCurrency(rec.impactValue)})</span>
                        )}
                      </span>
                    </li>
                  ))}
                  {recommendations.length > 3 && (
                    <li className="text-muted-foreground text-[10px]">+{recommendations.length - 3} autres</li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
              <Check className="w-3 h-3 mr-1" />
              OK
            </Badge>
          )}
        </div>
        
        {/* Bouton Voir le projet (toujours au même endroit) */}
        <Link href={`/projects/${projectId}`}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-violet-600 hover:text-violet-700 hover:bg-violet-50" 
            data-testid={`button-view-project-${projectId}`}
          >
            Voir le projet
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  actionStatus?: RecommendationActionData | null;
  onMarkTreated?: (recommendationKey: string) => void;
  onMarkIgnored?: (recommendationKey: string) => void;
  onUndoAction?: (actionId: string) => void;
  isPending?: boolean;
}

function RecommendationCard({ 
  recommendation, 
  actionStatus, 
  onMarkTreated, 
  onMarkIgnored, 
  onUndoAction,
  isPending 
}: RecommendationCardProps) {
  const priorityInfo = getPriorityLabel(recommendation.priorityScore);
  const priorityAction = generatePriorityAction(recommendation);
  const scoreColor = getScoreColor(recommendation.priorityScore);
  
  // Use new decision label if available
  const decisionEmoji = recommendation.decisionInfo?.emoji || priorityInfo.emoji;
  const decisionLabel = recommendation.decisionInfo?.label || priorityInfo.label;
  
  // Category tag mapping
  const getCategoryTag = () => {
    switch (recommendation.category) {
      case 'pricing': return { label: 'Pricing', color: 'bg-violet-100 text-violet-700 border-violet-200' };
      case 'time': return { label: 'Temps', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'payment': return { label: 'Paiement', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'strategic': return { label: 'Stratégique', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      default: return { label: 'Autre', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };
  const categoryTag = getCategoryTag();
  
  // Use recommendation ID as stable key
  const recommendationKey = recommendation.id;
  
  return (
    <Card className={`border-l-4 ${scoreColor.border} bg-gradient-to-r from-background to-muted/20 ${actionStatus ? 'opacity-60' : ''}`} data-testid={`card-recommendation-${recommendation.id}`}>
      <CardContent className="p-4 space-y-3">
        {/* HEADER: Badge priorité + Score + Tag type */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${scoreColor.bg} ${scoreColor.text} border-0`}>
            {decisionEmoji} {decisionLabel}
          </Badge>
          <Badge variant="outline" className={`text-xs ${categoryTag.color}`}>
            {categoryTag.label}
          </Badge>
          <div className="ml-2">
            <ScoreRing 
              score={recommendation.priorityScore} 
              size={32}
              strokeWidth={3}
              breakdown={recommendation.scoreBreakdown?.components}
              label="Score de priorité"
            />
          </div>
          {recommendation.projectName && (
            <Link 
              href={`/projects/${recommendation.projectId}`}
              className="ml-auto text-xs text-violet-600 hover:underline"
            >
              {recommendation.projectName}
            </Link>
          )}
        </div>
        
        {/* Status badge if already treated/ignored */}
        {actionStatus && (
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium ${
            actionStatus.action === 'treated'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            {actionStatus.action === 'treated' ? (
              <><Check className="w-3 h-3" /> Traité</>
            ) : (
              <><EyeOff className="w-3 h-3" /> Ignoré</>
            )}
            {onUndoAction && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 ml-1.5 text-[10px] gap-1"
                onClick={() => onUndoAction(actionStatus.id)}
                data-testid={`button-undo-action-${recommendation.id}`}
              >
                <RotateCcw className="w-3 h-3" />
                Annuler
              </Button>
            )}
          </div>
        )}
        
        {/* CORPS: 3 blocs fixes */}
        <div className="space-y-2">
          {recommendation.blocks ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {/* Bloc 1: Constat passé */}
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-muted-foreground text-[10px] font-medium mb-1 flex items-center gap-1">
                  <span className="text-amber-500">1.</span> Constat passé
                </p>
                <p className="text-emerald-600 font-medium text-xs">
                  {recommendation.impactValue && recommendation.impactValue > 0 
                    ? `+${formatCurrency(recommendation.impactValue)} potentiel`
                    : formatCurrency(recommendation.blocks.pastImpact.amount)
                  }
                </p>
                <p className="text-muted-foreground text-[10px] mt-0.5">{recommendation.blocks.pastImpact.condition}</p>
              </div>
              
              {/* Bloc 2: Implication actuelle */}
              <div className={`p-2.5 rounded-lg border ${
                recommendation.blocks.currentImplication.isPast 
                  ? 'bg-muted border-border' 
                  : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
              }`}>
                <p className="text-muted-foreground text-[10px] font-medium mb-1 flex items-center gap-1">
                  <span className="text-amber-500">2.</span> Implication actuelle
                </p>
                <p className={`font-medium text-xs ${recommendation.blocks.currentImplication.isPast ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {recommendation.blocks.currentImplication.message}
                </p>
              </div>
              
              {/* Bloc 3: Action concrète */}
              <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
                <p className="text-violet-600 text-[10px] font-medium mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Action concrète
                </p>
                <p className="font-semibold text-xs text-violet-800 dark:text-violet-300">
                  {recommendation.blocks.concreteAction.primary}
                </p>
                {recommendation.blocks.concreteAction.alternatives.length > 0 && (
                  <p className="text-violet-500 text-[10px] mt-0.5">
                    Alternatives : {recommendation.blocks.concreteAction.alternatives.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Fallback: Simple action display */
            <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
              <p className="font-semibold text-xs text-violet-800 dark:text-violet-300">{priorityAction}</p>
              {recommendation.issue && (
                <p className="text-muted-foreground text-xs mt-0.5">{recommendation.issue}</p>
              )}
            </div>
          )}
        </div>
        
        {/* FOOTER: Impact chiffré + Boutons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border flex-wrap">
          {/* Impact financier - Wording adapté selon l'horizon */}
          {recommendation.impactValue ? (
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
              recommendation.impactValue > 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400'
            }`}>
              {recommendation.impactValue > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {recommendation.horizon === 'immediate' 
                  ? `Impact potentiel : ${recommendation.impactValue > 0 ? '+' : ''}${formatCurrency(recommendation.impactValue)} sur ce projet`
                  : `Impact potentiel estimé : ${recommendation.impactValue > 0 ? '+' : ''}${formatCurrency(recommendation.impactValue)} sur projets futurs similaires`
                }
              </span>
            </div>
          ) : (
            <div />
          )}
          
          {/* Boutons Traité / Ignorer - Only for immediate horizon (actionable) */}
          {!actionStatus && onMarkTreated && onMarkIgnored && recommendation.horizon === 'immediate' && (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => onMarkTreated(recommendationKey)}
                disabled={isPending}
                data-testid={`button-mark-treated-${recommendation.id}`}
              >
                <Check className="w-4 h-4" />
                Traité
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => onMarkIgnored(recommendationKey)}
                disabled={isPending}
                data-testid={`button-mark-ignored-${recommendation.id}`}
              >
                <X className="w-4 h-4" />
                Ignorer
              </Button>
            </div>
          )}
          
          {/* CTA for strategic/learning horizon */}
          {recommendation.horizon === 'strategic' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-violet-600 border-violet-300 bg-violet-50">
                <Lightbulb className="w-3 h-3 mr-1" />
                Insight pour projets futurs
              </Badge>
            </div>
          )}
          {recommendation.horizon === 'learning' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">
                <Info className="w-3 h-3 mr-1" />
                Apprentissage
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Top Priority Card - Shows the #1 priority action with unified color from score
function TopPriorityCard({ recommendation, projectName, onMarkTreated, onMarkIgnored }: { 
  recommendation: Recommendation; 
  projectName: string;
  onMarkTreated?: () => void;
  onMarkIgnored?: () => void;
}) {
  const priorityInfo = getPriorityLabel(recommendation.priorityScore);
  const priorityAction = generatePriorityAction(recommendation);
  const scoreColor = getScoreColor(recommendation.priorityScore);
  
  // Use new decision label if available
  const decisionEmoji = recommendation.decisionInfo?.emoji || priorityInfo.emoji;
  const decisionLabel = recommendation.decisionInfo?.label || priorityInfo.label;
  const decisionTiming = recommendation.decisionInfo?.timing || priorityInfo.timing;
  
  // Délai recommandé basé sur le score
  const getRecommendedDelay = () => {
    if (recommendation.priorityScore <= 30) return 'à traiter immédiatement';
    if (recommendation.priorityScore <= 50) return 'à traiter sous 3 jours';
    if (recommendation.priorityScore <= 70) return 'à traiter sous 7 jours';
    return 'à planifier ce mois';
  };
  
  return (
    <Card className={`border-l-4 ${scoreColor.border} bg-gradient-to-r from-background to-muted/20`} data-testid="card-top-priority">
      <CardContent className="p-4 space-y-3">
        {/* HEADER: Badge priorité + Score visuel */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${scoreColor.bg} ${scoreColor.text} border-0`}>
              {decisionEmoji} {decisionLabel}
            </Badge>
            <ScoreRing 
            score={recommendation.priorityScore} 
            size={32}
            strokeWidth={3}
            breakdown={recommendation.scoreBreakdown?.components}
            label="Score de priorité"
          />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-end gap-1 cursor-help">
                <Progress 
                  value={100 - recommendation.priorityScore} 
                  className="w-20 h-1.5"
                />
                <span className="text-[10px] text-muted-foreground">Niveau d'urgence</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-xs border shadow-lg">
              <p className="font-medium mb-1">Urgence : {100 - recommendation.priorityScore}%</p>
              <p className="text-muted-foreground">
                Plus la barre est remplie, plus l'action est urgente.
                Score inversé : 100 = urgent, 0 = peut attendre.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        {/* CORPS: Action principale + Impact + Délai */}
        <div className="space-y-2">
          {/* Action principale (1 phrase claire, très visible) */}
          <h3 className="text-sm font-semibold text-foreground">
            {recommendation.blocks?.concreteAction?.primary || priorityAction}
          </h3>
          
          {/* Impact financier clair - Wording adapté selon l'horizon */}
          {recommendation.impactValue !== undefined && recommendation.impactValue !== 0 && (
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
              recommendation.impactValue > 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400'
            }`}>
              {recommendation.impactValue > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {recommendation.horizon === 'immediate' 
                  ? `Impact potentiel : ${recommendation.impactValue > 0 ? '+' : ''}${formatCurrency(recommendation.impactValue)} sur ce projet`
                  : `Impact potentiel estimé : ${recommendation.impactValue > 0 ? '+' : ''}${formatCurrency(recommendation.impactValue)} sur projets futurs similaires`
                }
              </span>
            </div>
          )}
          
          {/* Délai recommandé - Only for immediate horizon */}
          {recommendation.horizon === 'immediate' && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Délai recommandé : <span className="font-medium">{getRecommendedDelay()}</span>
            </p>
          )}
          
          {/* Horizon badge for non-immediate */}
          {recommendation.horizon === 'strategic' && (
            <Badge variant="outline" className="text-violet-600 border-violet-300 bg-violet-50">
              <Lightbulb className="w-3 h-3 mr-1" />
              Insight pour projets futurs
            </Badge>
          )}
          {recommendation.horizon === 'learning' && (
            <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">
              <Info className="w-3 h-3 mr-1" />
              Apprentissage
            </Badge>
          )}
        </div>
        
        {/* FOOTER: Boutons + Lien projet */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border flex-wrap">
          <div className="flex items-center gap-2">
            {/* Boutons Traité/Ignorer - Only for immediate horizon */}
            {recommendation.horizon === 'immediate' && onMarkTreated && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onMarkTreated}
                data-testid="button-overview-mark-treated"
              >
                <Check className="w-3 h-3" />
                Traité
              </Button>
            )}
            {recommendation.horizon === 'immediate' && onMarkIgnored && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={onMarkIgnored}
                data-testid="button-overview-mark-ignored"
              >
                <X className="w-3 h-3" />
                Ignorer
              </Button>
            )}
          </div>
          <Link 
            href={`/projects/${recommendation.projectId}`} 
            className="text-xs text-violet-600 hover:underline flex items-center gap-1"
          >
            {projectName}
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-1">
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
        <p className="text-xs text-muted-foreground">Analyse de la rentabilité en cours…</p>
      </div>
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
    <Card className="p-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full">
          <PieChart className="w-6 h-6 text-violet-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Aucune donnée de rentabilité</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Créez des projets et enregistrez du temps pour voir l'analyse de rentabilité.
          </p>
        </div>
        <Link href="/projects">
          <Button size="sm" className="mt-1" data-testid="button-go-to-projects">
            Voir les projets
          </Button>
        </Link>
      </div>
    </Card>
  );
}

import { PremiumGate } from "@/components/billing/PremiumGate";

function FinanceInner() {
  const { t } = useLanguage();
  const { readOnly, canCreate, canUpdate, canDelete } = useReadOnlyMode("profitability");
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'profitable' | 'at_risk' | 'deficit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'none' | 'desc' | 'asc'>('none');
  const [activeTab, setActiveTab] = useState('today');
  const [hiddenRecommendations, setHiddenRecommendations] = useState<Set<string>>(new Set());
  const [showTreatedIgnored, setShowTreatedIgnored] = useState(false);
  
  // États pour l'onglet Recommandations
  const [recoSearchQuery, setRecoSearchQuery] = useState('');
  const [recoSortBy, setRecoSortBy] = useState<'score' | 'gain'>('score');
  const [recoSortOrder, setRecoSortOrder] = useState<'desc' | 'asc'>('desc');
  const [recoFilterType, setRecoFilterType] = useState<'all' | 'pricing' | 'time' | 'payment' | 'strategic' | 'model'>('all');

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
    refetchOnMount: true,
    staleTime: 0,
  });
  
  // Fetch recommendation actions
  const { data: recommendationActions = [] } = useQuery<RecommendationActionData[]>({
    queryKey: ['/api/recommendation-actions'],
  });
  
  // Create action map for quick lookup
  const actionMap = new Map<string, RecommendationActionData>();
  recommendationActions.forEach(action => {
    const key = `${action.projectId}_${action.recommendationKey}`;
    actionMap.set(key, action);
  });
  
  // Mutations for recommendation actions with optimistic updates
  const createActionMutation = useMutation({
    mutationFn: async (data: { projectId: string; recommendationKey: string; action: 'treated' | 'ignored' }) => {
      return apiRequest('/api/recommendation-actions', 'POST', data);
    },
    onMutate: async (newAction) => {
      await queryClient.cancelQueries({ queryKey: ['/api/recommendation-actions'] });
      const previousActions = queryClient.getQueryData<RecommendationActionData[]>(['/api/recommendation-actions']);
      if (previousActions) {
        const optimisticAction: RecommendationActionData = {
          id: `temp-${Date.now()}`,
          ...newAction,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<RecommendationActionData[]>(
          ['/api/recommendation-actions'],
          [...previousActions, optimisticAction]
        );
      }
      return { previousActions };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['/api/recommendation-actions'], context.previousActions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendation-actions'] });
    },
  });
  
  const deleteActionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/recommendation-actions/${id}`, 'DELETE');
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/recommendation-actions'] });
      const previousActions = queryClient.getQueryData<RecommendationActionData[]>(['/api/recommendation-actions']);
      if (previousActions) {
        queryClient.setQueryData<RecommendationActionData[]>(
          ['/api/recommendation-actions'],
          previousActions.filter(a => a.id !== id)
        );
      }
      return { previousActions };
    },
    onError: (_error, _id, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['/api/recommendation-actions'], context.previousActions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendation-actions'] });
    },
  });
  
  const handleMarkTreated = (projectId: string, recommendationKey: string) => {
    createActionMutation.mutate({ projectId, recommendationKey, action: 'treated' });
  };
  
  const handleMarkIgnored = (projectId: string, recommendationKey: string) => {
    createActionMutation.mutate({ projectId, recommendationKey, action: 'ignored' });
  };
  
  const handleUndoAction = (actionId: string) => {
    deleteActionMutation.mutate(actionId);
  };
  
  // Helper to get action status for a recommendation
  const getActionStatus = (projectId: string, recommendationId: string): RecommendationActionData | null => {
    const key = `${projectId}_${recommendationId}`;
    return actionMap.get(key) || null;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center border-red-200 bg-red-50">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground">Erreur de chargement</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Impossible de charger les données de rentabilité.
          </p>
        </Card>
      </div>
    );
  }

  if (!summary || summary.projects.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <EmptyState />
      </div>
    );
  }

  const { aggregate, projects } = summary;

  const filteredProjects = projects
    .filter(p => {
      // Filter by search query
      if (searchQuery && !p.projectName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Filter by status
      if (selectedFilter === 'all') return true;
      return p.metrics.status === selectedFilter;
    })
    .sort((a, b) => {
      if (sortOrder === 'none') {
        return 0; // Keep original order (by date, most recent first)
      }
      return sortOrder === 'desc' 
        ? b.metrics.marginPercent - a.metrics.marginPercent 
        : a.metrics.marginPercent - b.metrics.marginPercent;
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
    <PermissionGuard module="profitability" fallbackPath="/">
      <div className="p-4 md:p-6 space-y-6 overflow-y-auto overflow-x-hidden h-full bg-[#F8FAFC] dark:bg-background" data-testid="page-finance">
        <ReadOnlyBanner module="profitability" />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="overflow-x-auto w-full md:w-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="today" className="gap-1.5 text-xs md:text-sm" data-testid="tab-today">
                <Flame className="w-4 h-4" />
                <span className="hidden sm:inline">Aujourd'hui</span>
                <span className="sm:hidden">Jour</span>
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-1.5 text-xs md:text-sm" data-testid="tab-overview">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Vue d'ensemble</span>
                <span className="sm:hidden">Global</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5 text-xs md:text-sm" data-testid="tab-projects">
                <PieChart className="w-4 h-4" />
                <span className="hidden sm:inline">Par projet</span>
                <span className="sm:hidden">Projets</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-1.5 text-xs md:text-sm" data-testid="tab-recommendations">
                <Lightbulb className="w-4 h-4" />
                <span className="hidden sm:inline">Recommandations</span>
                <span className="sm:hidden">Recos</span>
                {highPriorityCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {highPriorityCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
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

        {/* Mode Aujourd'hui - Top 3 décisions prioritaires */}
        <TabsContent value="today" className="space-y-6">
          {(() => {
            // Get top 3 priority recommendations (not treated/ignored)
            const urgencyOrder = ['🚨', '⚠️', '⏰', '💡', 'ℹ️'];
            const top3Recommendations = allRecommendations
              .filter(rec => {
                const actionStatus = getActionStatus(rec.projectId || '', rec.id);
                return !actionStatus;
              })
              .sort((a, b) => {
                // Sort by urgency label first
                const aEmoji = a.decisionInfo?.emoji || '💡';
                const bEmoji = b.decisionInfo?.emoji || '💡';
                const aUrgencyIndex = urgencyOrder.indexOf(aEmoji);
                const bUrgencyIndex = urgencyOrder.indexOf(bEmoji);
                if (aUrgencyIndex !== bUrgencyIndex) {
                  return aUrgencyIndex - bUrgencyIndex;
                }
                // Then by priority score
                return b.priorityScore - a.priorityScore;
              })
              .slice(0, 3);

            const getTodayDate = () => {
              const today = new Date();
              return today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            };

            // Calcul des KPIs pour l'onglet Aujourd'hui
            const activeRecommendationsCount = allRecommendations.filter(r => !getActionStatus(r.projectId || '', r.id)).length;
            const totalPotentialGains = allRecommendations
              .filter(r => !getActionStatus(r.projectId || '', r.id) && r.impactValue)
              .reduce((sum, r) => sum + (r.impactValue || 0), 0);
            const amountAtRisk = aggregate.totalBilled - aggregate.totalPaid + 
              projects.filter(p => p.metrics.status === 'deficit').reduce((sum, p) => sum + Math.abs(p.metrics.margin), 0);
            const treatedThisMonth = recommendationActions.filter(a => a.action === 'treated').length;

            return (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-violet-600" />
                      Vos 3 décisions du jour
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {getTodayDate()} - Concentrez-vous sur ces actions prioritaires
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setActiveTab('recommendations')}
                    data-testid="button-view-all-recommendations"
                  >
                    Voir toutes les recommandations
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* KPIs synthèse en haut - expliquent pourquoi ces décisions existent */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-gradient-to-br from-emerald-50 to-white border-emerald-200 dark:from-emerald-950/20 dark:to-background dark:border-emerald-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
                        <Euro className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(totalPotentialGains)}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-500">Gains potentiels activables</p>
                        <p className="text-[10px] text-emerald-500">sur les décisions non traitées</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3 bg-gradient-to-br from-amber-50 to-white border-amber-200 dark:from-amber-950/20 dark:to-background dark:border-amber-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-amber-700 dark:text-amber-400">
                          {formatCurrency(amountAtRisk)}
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500">Montant à risque</p>
                        <p className="text-[10px] text-amber-500">facturé non encaissé + déficits</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3 bg-gradient-to-br from-violet-50 to-white border-violet-200 dark:from-violet-950/20 dark:to-background dark:border-violet-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-full">
                        <Lightbulb className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-violet-700 dark:text-violet-400">
                          {activeRecommendationsCount}
                        </p>
                        <p className="text-[10px] text-violet-600 dark:text-violet-500">Décisions actives</p>
                        <p className="text-[10px] text-violet-500">{treatedThisMonth} traitées ce mois</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {top3Recommendations.length === 0 ? (
                  <Card className="p-6 text-center bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-950/20 dark:to-background dark:border-green-800">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-green-200 dark:bg-green-900/40 rounded-full">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-green-800 dark:text-green-400">Tout est sous contrôle !</h3>
                        <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                          Aucune décision urgente à prendre aujourd'hui. Tous vos projets sont en bonne santé.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {top3Recommendations.map((rec, index) => {
                      const actionStatus = getActionStatus(rec.projectId || '', rec.id);
                      // Palette douce : violet/indigo/slate au lieu de rouge/orange/jaune
                      const cardStyles = [
                        { border: 'border-l-violet-500', bg: 'bg-gradient-to-r from-violet-50/60 to-background dark:from-violet-950/20', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
                        { border: 'border-l-indigo-400', bg: 'bg-gradient-to-r from-indigo-50/50 to-background dark:from-indigo-950/20', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
                        { border: 'border-l-slate-400', bg: 'bg-gradient-to-r from-slate-50/50 to-background dark:from-slate-800/30', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
                      ];
                      const style = cardStyles[index] || cardStyles[2];
                      
                      return (
                        <Card 
                          key={`today-${rec.projectId}-${rec.id}`}
                          className={`overflow-hidden border-l-4 ${style.border} ${style.bg} relative`}
                          data-testid={`card-today-decision-${index + 1}`}
                        >
                          <CardContent className="p-3 md:p-5">
                            <div className="flex flex-col gap-3 md:gap-4">
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm md:text-base font-bold ${style.badge}`}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-xs md:text-sm font-semibold text-foreground mb-0.5 line-clamp-2">
                                    {rec.threeBlockFormat?.concreteAction || rec.actionSuggested || rec.action}
                                  </h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link 
                                      href={`/projects/${rec.projectId}`} 
                                      className="text-[10px] md:text-xs text-violet-600 hover:underline"
                                    >
                                      {rec.projectName}
                                    </Link>
                                    <Badge variant="outline" className="text-[10px]">
                                      {rec.decisionInfo?.emoji} {rec.decisionInfo?.label}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Format 3 blocs - masqué sur mobile */}
                              <div className="hidden md:block space-y-2 text-xs pl-10 md:pl-11">
                                {rec.threeBlockFormat ? (
                                  <>
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-amber-500 mt-0.5">1.</span>
                                      <div>
                                        <span className="font-medium text-foreground">Constat passé : </span>
                                        <span className="text-muted-foreground">
                                          {rec.threeBlockFormat.pastObservation}
                                          {rec.impactValue && rec.impactValue > 0 && (
                                            <span className="text-emerald-600 font-medium ml-1">(+{formatCurrency(rec.impactValue)} potentiel)</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-amber-500 mt-0.5">2.</span>
                                      <div>
                                        <span className="font-medium text-foreground">Ce que ça implique : </span>
                                        <span className="text-muted-foreground">{rec.threeBlockFormat.currentImplication}</span>
                                      </div>
                                    </div>
                                    <div className="bg-violet-50 p-2.5 rounded-lg border border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
                                      <div className="flex items-start gap-1.5">
                                        <Zap className="w-3 h-3 text-violet-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <p className="font-semibold text-violet-800 dark:text-violet-300 text-xs">
                                            Action recommandée : {rec.threeBlockFormat.concreteAction}
                                          </p>
                                          {rec.threeBlockFormat.alternatives && rec.threeBlockFormat.alternatives.length > 0 && (
                                            <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                                              Alternatives : {rec.threeBlockFormat.alternatives.join(', ')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="bg-violet-50 p-2.5 rounded-lg border border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
                                    <div className="flex items-start gap-1.5">
                                      <Zap className="w-3 h-3 text-violet-600 mt-0.5 flex-shrink-0" />
                                      <p className="font-semibold text-xs text-violet-800 dark:text-violet-300">{rec.actionSuggested || rec.action}</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Impact mobile visible */}
                              {rec.impactValue && rec.impactValue > 0 && (
                                <div className="md:hidden text-xs text-emerald-600 font-medium pl-11">
                                  +{formatCurrency(rec.impactValue)} potentiel
                                </div>
                              )}
                              
                              {/* Action buttons - only for immediate horizon (actionable projects) */}
                              {rec.horizon === 'immediate' ? (
                                <div className="flex flex-row gap-2 pl-11 md:pl-0 md:absolute md:top-5 md:right-5">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="gap-1.5 flex-1 md:flex-none text-xs md:text-sm"
                                    onClick={() => handleMarkTreated(rec.projectId || '', rec.id)}
                                    disabled={createActionMutation.isPending}
                                    data-testid={`button-today-mark-treated-${index + 1}`}
                                  >
                                    <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    Traité
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 flex-1 md:flex-none text-xs text-muted-foreground"
                                    onClick={() => handleMarkIgnored(rec.projectId || '', rec.id)}
                                    disabled={createActionMutation.isPending}
                                    data-testid={`button-today-mark-ignored-${index + 1}`}
                                  >
                                    <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    Ignorer
                                  </Button>
                                </div>
                              ) : (
                                <div className="pl-11 md:pl-0 md:absolute md:top-5 md:right-5">
                                  {rec.horizon === 'strategic' ? (
                                    <Badge variant="outline" className="text-violet-600 border-violet-300 bg-violet-50">
                                      <Lightbulb className="w-3 h-3 mr-1" />
                                      Insight pour projets futurs
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">
                                      <Info className="w-3 h-3 mr-1" />
                                      Apprentissage
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200 cursor-help transition-all hover:from-green-100 hover:to-green-200 dark:from-green-950/20 dark:to-background dark:border-green-800 dark:hover:from-green-900/30" data-testid="status-profitable">
                  <div className="p-2 bg-green-200 dark:bg-green-900/40 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-green-700 dark:text-green-400">{aggregate.profitableCount}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Projets rentables</p>
                    <p className="text-[10px] text-green-500">Marge &gt; 15%</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-64 p-3 border shadow-lg">
                <p className="text-xs font-semibold text-green-700 mb-1.5">Projets rentables</p>
                {projects.filter(p => p.metrics.status === 'profitable').length > 0 ? (
                  <ul className="space-y-1">
                    {projects.filter(p => p.metrics.status === 'profitable').map(p => (
                      <li key={p.projectId} className="text-xs text-foreground flex justify-between">
                        <span className="truncate">{p.projectName}</span>
                        <span className="text-green-600 font-medium">{formatNumber(p.metrics.marginPercent)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun projet rentable</p>
                )}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 cursor-help transition-all hover:from-orange-100 hover:to-orange-200 dark:from-orange-950/20 dark:to-background dark:border-orange-800 dark:hover:from-orange-900/30" data-testid="status-at-risk">
                  <div className="p-2 bg-orange-200 dark:bg-orange-900/40 rounded-full">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-orange-700 dark:text-orange-400">{aggregate.atRiskCount}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-500">Projets à risque</p>
                    <p className="text-[10px] text-orange-500">Marge 0-15%</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-64 p-3 border shadow-lg">
                <p className="text-xs font-semibold text-orange-700 mb-1.5">Projets à risque</p>
                {projects.filter(p => p.metrics.status === 'at_risk').length > 0 ? (
                  <ul className="space-y-1">
                    {projects.filter(p => p.metrics.status === 'at_risk').map(p => (
                      <li key={p.projectId} className="text-xs text-foreground flex justify-between">
                        <span className="truncate">{p.projectName}</span>
                        <span className="text-orange-600 font-medium">{formatNumber(p.metrics.marginPercent)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun projet à risque</p>
                )}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-200 cursor-help transition-all hover:from-red-100 hover:to-red-200 dark:from-red-950/20 dark:to-background dark:border-red-800 dark:hover:from-red-900/30" data-testid="status-deficit">
                  <div className="p-2 bg-red-200 dark:bg-red-900/40 rounded-full">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-red-700 dark:text-red-400">{aggregate.deficitCount}</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Projets déficitaires</p>
                    <p className="text-[10px] text-red-500">Marge &lt; 0%</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-64 p-3 border shadow-lg">
                <p className="text-xs font-semibold text-red-700 mb-1.5">Projets déficitaires</p>
                {projects.filter(p => p.metrics.status === 'deficit').length > 0 ? (
                  <ul className="space-y-1">
                    {projects.filter(p => p.metrics.status === 'deficit').map(p => (
                      <li key={p.projectId} className="text-xs text-foreground flex justify-between">
                        <span className="truncate">{p.projectName}</span>
                        <span className="text-red-600 font-medium">{formatNumber(p.metrics.marginPercent)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun projet déficitaire</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Top Priority Section - Always show if recommendations exist */}
          {topPriorityRec && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">Action prioritaire</h3>
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
                onMarkTreated={() => handleMarkTreated(topPriorityRec.projectId || '', topPriorityRec.id)}
                onMarkIgnored={() => handleMarkIgnored(topPriorityRec.projectId || '', topPriorityRec.id)}
              />
            </div>
          )}

          {highPriorityCount > 1 && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <CardContent className="p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                        {highPriorityCount - 1} autre{highPriorityCount > 2 ? 's' : ''} action{highPriorityCount > 2 ? 's' : ''} critique{highPriorityCount > 2 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-500">
                        Requiert une attention immédiate
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-orange-300 text-orange-700 text-xs"
                    onClick={() => setActiveTab('recommendations')}
                    data-testid="button-view-recommendations"
                  >
                    Voir les détails
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-wrap">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t.common.ph.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-project"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedFilter} onValueChange={(v) => setSelectedFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-filter">
                  <SelectValue placeholder={t.common.ph.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="profitable">Rentables</SelectItem>
                  <SelectItem value="at_risk">À risque</SelectItem>
                  <SelectItem value="deficit">Déficitaires</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (sortOrder === 'none') setSortOrder('desc');
                  else if (sortOrder === 'desc') setSortOrder('asc');
                  else setSortOrder('none');
                }}
                className="gap-2 bg-background border border-border"
                data-testid="button-sort-margin"
              >
                {sortOrder === 'none' ? <ArrowUpDown className="w-4 h-4 text-gray-400" /> : 
                 sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                <span className="hidden sm:inline">{sortOrder === 'none' ? 'Tri: Date' : `Marge ${sortOrder === 'desc' ? '↓' : '↑'}`}</span>
              </Button>
              <p className="text-xs text-muted-foreground ml-auto">
                {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-xs text-muted-foreground">Aucun projet correspondant au filtre sélectionné</p>
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
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Excellent travail !</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tous vos projets sont bien optimisés. Continuez ainsi.
              </p>
            </Card>
          ) : (
            <>
              {/* Barre de recherche et tri */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={t.common.ph.search}
                    value={recoSearchQuery}
                    onChange={(e) => setRecoSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-recommendations"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={recoFilterType} onValueChange={(v) => setRecoFilterType(v as typeof recoFilterType)}>
                    <SelectTrigger className="w-[100px] sm:w-[130px] text-xs" data-testid="select-reco-filter-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="pricing">Prix</SelectItem>
                      <SelectItem value="time">Temps</SelectItem>
                      <SelectItem value="payment">Paiement</SelectItem>
                      <SelectItem value="strategic">Stratégie</SelectItem>
                      <SelectItem value="model">Modèle</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={recoSortBy} onValueChange={(v) => setRecoSortBy(v as 'score' | 'gain')}>
                    <SelectTrigger className="w-[90px] sm:w-[140px] text-xs" data-testid="select-reco-sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Score</SelectItem>
                      <SelectItem value="gain">Gain</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecoSortOrder(recoSortOrder === 'desc' ? 'asc' : 'desc')}
                    className="gap-1 bg-background border border-border px-2 sm:px-3"
                    data-testid="button-reco-sort-order"
                  >
                    {recoSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline text-xs">{recoSortOrder === 'desc' ? 'Décrois.' : 'Crois.'}</span>
                  </Button>
                  <Button
                    variant={showTreatedIgnored ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowTreatedIgnored(!showTreatedIgnored)}
                    className="gap-1 bg-background border border-border px-2 sm:px-3"
                    data-testid="button-toggle-treated-ignored"
                  >
                    {showTreatedIgnored ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline text-xs">{showTreatedIgnored ? 'Tout' : 'Masquer'}</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground sm:ml-auto">
                  {(() => {
                    const filtered = allRecommendations
                      .filter(r => !hiddenRecommendations.has(`${r.projectId}-${r.id}`))
                      .filter(r => !recoSearchQuery || r.projectName?.toLowerCase().includes(recoSearchQuery.toLowerCase()))
                      .filter(r => recoFilterType === 'all' || r.category === recoFilterType)
                      .filter(r => {
                        if (!showTreatedIgnored) return true;
                        const actionStatus = getActionStatus(r.projectId || '', r.id);
                        return !actionStatus;
                      });
                    const treatedCount = recommendationActions.length;
                    return `${filtered.length} recommandation${filtered.length > 1 ? 's' : ''}${treatedCount > 0 ? ` (${treatedCount} traitée${treatedCount > 1 ? 's' : ''})` : ''}`;
                  })()}
                </p>
              </div>

              {/* Liste des recommandations triées */}
              <div className="space-y-4">
                {allRecommendations
                  .filter(rec => !hiddenRecommendations.has(`${rec.projectId}-${rec.id}`))
                  .filter(rec => !recoSearchQuery || rec.projectName?.toLowerCase().includes(recoSearchQuery.toLowerCase()))
                  .filter(rec => recoFilterType === 'all' || rec.category === recoFilterType)
                  .filter(rec => {
                    if (!showTreatedIgnored) return true;
                    const actionStatus = getActionStatus(rec.projectId || '', rec.id);
                    return !actionStatus;
                  })
                  .sort((a, b) => {
                    // Sort treated/ignored to the bottom
                    const aStatus = getActionStatus(a.projectId || '', a.id);
                    const bStatus = getActionStatus(b.projectId || '', b.id);
                    if (aStatus && !bStatus) return 1;
                    if (!aStatus && bStatus) return -1;
                    
                    if (recoSortBy === 'score') {
                      return recoSortOrder === 'desc' ? b.priorityScore - a.priorityScore : a.priorityScore - b.priorityScore;
                    } else {
                      const gainA = a.impactValue || 0;
                      const gainB = b.impactValue || 0;
                      return recoSortOrder === 'desc' ? gainB - gainA : gainA - gainB;
                    }
                  })
                  .map((rec) => {
                    const recKey = `${rec.projectId}-${rec.id}`;
                    const actionStatus = getActionStatus(rec.projectId || '', rec.id);
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
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                        <RecommendationCard 
                          recommendation={rec} 
                          actionStatus={actionStatus}
                          onMarkTreated={(key) => handleMarkTreated(rec.projectId || '', key)}
                          onMarkIgnored={(key) => handleMarkIgnored(rec.projectId || '', key)}
                          onUndoAction={handleUndoAction}
                          isPending={createActionMutation.isPending || deleteActionMutation.isPending}
                        />
                      </div>
                    );
                  })}
              </div>

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
    </PermissionGuard>
  );
}

export default function Finance() {
  return (
    <PremiumGate feature="finance">
      <FinanceInner />
    </PremiumGate>
  );
}
