import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";

interface DecisionEvent {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  meta: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

interface DecisionComment {
  id: string;
  content: string;
  comment_type: string;
  created_at: string;
  author_email?: string;
}

interface DecisionsData {
  events: DecisionEvent[];
  comments: DecisionComment[];
}

const actionConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  'decision.created': { label: 'Décision', icon: MessageSquare, color: 'bg-violet-100 text-violet-700' },
  'approval.decided': { label: 'Validation', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  'approval.requested': { label: 'Demande', icon: Clock, color: 'bg-amber-100 text-amber-700' },
};

export default function ProjectDecisions() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery<DecisionsData>({
    queryKey: [`/api/projects/${projectId}/decisions`],
  });

  const allItems = [
    ...(data?.events?.map(e => ({ ...e, type: 'event', date: e.created_at })) || []),
    ...(data?.comments?.map(c => ({ ...c, type: 'comment', date: c.created_at })) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Erreur: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Timeline des décisions</h1>
            <p className="text-sm text-muted-foreground">Historique des validations et décisions du projet</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucune décision enregistrée pour ce projet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {allItems.map((item, index) => {
                if (item.type === 'event') {
                  const event = item as DecisionEvent & { type: string; date: string };
                  const config = actionConfig[event.action_type] || { label: event.action_type, icon: AlertTriangle, color: 'bg-gray-100 text-gray-700' };
                  const Icon = config.icon;
                  
                  return (
                    <div key={event.id} className="relative pl-16" data-testid={`timeline-event-${index}`}>
                      <div className={`absolute left-4 w-5 h-5 rounded-full flex items-center justify-center ${config.color}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={config.color}>
                                {config.label}
                              </Badge>
                              {event.actor_name && (
                                <span className="text-sm text-muted-foreground">par {event.actor_name}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </CardHeader>
                        {event.meta && Object.keys(event.meta).length > 0 && (
                          <CardContent className="py-2 px-4 pt-0">
                            <p className="text-sm text-muted-foreground">
                              {event.resource_type}: {event.resource_id?.slice(0, 8)}...
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  );
                } else {
                  const comment = item as DecisionComment & { type: string; date: string };
                  return (
                    <div key={comment.id} className="relative pl-16" data-testid={`timeline-comment-${index}`}>
                      <div className="absolute left-4 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <MessageSquare className="w-3 h-3 text-white" />
                      </div>
                      
                      <Card className="border-violet-200">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-violet-100 text-violet-700">Décision</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4 pt-0">
                          <p className="text-sm">{comment.content}</p>
                          {comment.author_email && (
                            <p className="text-xs text-muted-foreground mt-2">{comment.author_email}</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
