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
  EyeOff
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

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  issue: string;
  action: string;
  impact: string;
  impactValue?: number;
  category: 'pricing' | 'time' | 'payment' | 'model';
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
    default:
      return <Lightbulb className="w-5 h-5 text-yellow-500" />;
  }
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
  return (
    <Card className={`border ${getPriorityColor(recommendation.priority)}`} data-testid={`card-recommendation-${recommendation.id}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="shrink-0 pt-1">
            {getRecommendationIcon(recommendation.icon)}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-gray-900 text-sm">{recommendation.issue}</h4>
              {getPriorityBadge(recommendation.priority)}
            </div>
            <p className="text-sm text-gray-600">{recommendation.action}</p>
            <div className="flex items-center gap-2 pt-1">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">{recommendation.impact}</span>
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
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const highPriorityCount = allRecommendations.filter(r => r.priority === 'high').length;

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

          {highPriorityCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-medium text-red-700">
                        {highPriorityCount} action{highPriorityCount > 1 ? 's' : ''} urgente{highPriorityCount > 1 ? 's' : ''} à traiter
                      </p>
                      <p className="text-sm text-red-600">
                        Des recommandations prioritaires nécessitent votre attention
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => setActiveTab('recommendations')}
                    data-testid="button-view-recommendations"
                  >
                    Voir les recommandations
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Recommandations d'optimisation
              </CardTitle>
              <CardDescription>
                Actions concrètes pour améliorer la rentabilité de vos projets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allRecommendations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">Excellent travail !</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Tous vos projets sont bien optimisés. Continuez ainsi.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allRecommendations.map((rec) => {
                    const recKey = `${rec.projectId}-${rec.id}`;
                    const isHidden = hiddenRecommendations.has(recKey);
                    return (
                      <div key={recKey}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">
                              Projet : 
                            </span>
                            <Link href={`/projects/${rec.projectId}`} className="text-xs text-violet-600 hover:underline">
                              {rec.projectName}
                            </Link>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleRecommendation(recKey)}
                            data-testid={`button-toggle-recommendation-${rec.id}`}
                          >
                            {isHidden ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-500" />}
                          </Button>
                        </div>
                        {!isHidden && <RecommendationCard recommendation={rec} />}
                        {isHidden && (
                          <Card className="border border-dashed border-gray-200 bg-gray-50">
                            <CardContent className="p-3 text-center">
                              <span className="text-sm text-gray-400">Recommandation masquée</span>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
