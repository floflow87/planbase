import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, Target, TrendingUp, AlertTriangle, CheckCircle, Calendar, Loader2 } from "lucide-react";
import { ApprovalBadge } from "@/components/approvals";
import type { Approval } from "@shared/schema";

interface ExecutiveData {
  project: {
    id: string;
    name: string;
    budget: string | null;
    progress: number | null;
    projectedMargin: number | null;
    status: string;
  };
  kpis: {
    totalHours: number;
    budget: string | null;
    progress: number;
    margin: number | null;
  };
  nextMilestone: {
    id: string;
    title: string;
    target_date: string | null;
    status: string;
    milestone_status: string | null;
  } | null;
  pendingApprovals: Approval[];
  recentDecisions: Array<{
    id: string;
    action_type: string;
    created_at: string;
    actor_name: string | null;
    meta: Record<string, unknown>;
  }>;
  blockingIssues: Array<{
    id: string;
    content: string;
    created_at: string;
    author_email: string | null;
  }>;
}

export default function ProjectExecutive() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery<ExecutiveData>({
    queryKey: [`/api/projects/${projectId}/executive`],
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Erreur: {(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { project, kpis, nextMilestone, pendingApprovals, recentDecisions, blockingIssues } = data;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">Vue exécutive</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card data-testid="kpi-hours">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Temps passé</p>
                  <p className="text-2xl font-bold">{kpis.totalHours.toFixed(1)}h</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-budget">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="text-2xl font-bold">
                    {kpis.budget ? `${parseFloat(kpis.budget).toLocaleString('fr-FR')} €` : '-'}
                  </p>
                </div>
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-progress">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Avancement</p>
                  <p className="text-lg font-semibold">{kpis.progress}%</p>
                </div>
                <Progress value={kpis.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-margin">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Marge projetée</p>
                  <p className={`text-2xl font-bold ${kpis.margin && kpis.margin > 0 ? 'text-green-600' : kpis.margin && kpis.margin < 0 ? 'text-red-600' : ''}`}>
                    {kpis.margin !== null ? `${kpis.margin.toFixed(1)}%` : '-'}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-next-milestone">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Prochain milestone
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextMilestone ? (
                <div className="space-y-3">
                  <h3 className="font-medium">{nextMilestone.title}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {nextMilestone.milestone_status || nextMilestone.status}
                    </Badge>
                    {nextMilestone.target_date && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(nextMilestone.target_date).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun milestone à venir</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-pending-approvals">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Validations en attente
                {pendingApprovals.length > 0 && (
                  <Badge variant="secondary">{pendingApprovals.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="space-y-2">
                  {pendingApprovals.slice(0, 5).map((approval) => (
                    <div key={approval.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="text-sm">{approval.resourceType}</span>
                      <ApprovalBadge status={approval.status} size="sm" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune validation en attente</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-decisions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Dernières décisions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentDecisions.length > 0 ? (
                <div className="space-y-3">
                  {recentDecisions.map((decision) => (
                    <div key={decision.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{decision.action_type.replace('.', ': ')}</span>
                        {decision.actor_name && (
                          <span className="text-muted-foreground ml-2">par {decision.actor_name}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(decision.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune décision récente</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-blocking-issues">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Problèmes bloquants
                {blockingIssues.length > 0 && (
                  <Badge variant="destructive">{blockingIssues.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blockingIssues.length > 0 ? (
                <div className="space-y-3">
                  {blockingIssues.slice(0, 5).map((issue) => (
                    <div key={issue.id} className="p-3 rounded-md bg-red-50 border border-red-100">
                      <p className="text-sm">{issue.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {issue.author_email} - {new Date(issue.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun problème bloquant</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
