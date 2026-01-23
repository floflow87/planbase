import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ExternalLink, CheckCircle, XCircle, Loader2, Unlink } from "lucide-react";
import { SiGoogle } from "react-icons/si";

interface GoogleStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
}

export function IntegrationsTab() {
  const { toast } = useToast();

  const { data: googleStatus, isLoading: isLoadingGoogle } = useQuery<GoogleStatus>({
    queryKey: ["/api/google/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/google/disconnect", "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
      toast({
        title: "Déconnexion réussie",
        description: "Votre compte Google Calendar a été déconnecté.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de déconnecter le compte Google.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card data-testid="card-google-calendar-integration">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <SiGoogle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription className="text-xs">
                Synchronisez vos rendez-vous avec Google Calendar
              </CardDescription>
            </div>
            {isLoadingGoogle ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Chargement...
              </Badge>
            ) : googleStatus?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Connecté
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                Non connecté
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleStatus?.connected ? (
            <>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Compte Google</span>
                  <span className="font-medium">{googleStatus.email || "N/A"}</span>
                </div>
                {googleStatus.calendarId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Calendrier ID</span>
                    <span className="font-mono text-xs truncate max-w-[200px]">
                      {googleStatus.calendarId}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button asChild size="sm" data-testid="button-open-calendar">
                  <Link href="/calendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    Ouvrir le calendrier
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-google"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Déconnecter
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connectez votre compte Google pour synchroniser automatiquement vos rendez-vous
                avec Google Calendar. Vous pourrez voir vos événements directement dans Planbase
                et créer de nouveaux événements qui se synchroniseront avec votre calendrier.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button asChild size="sm" data-testid="button-connect-google">
                  <Link href="/calendar">
                    <SiGoogle className="h-4 w-4 mr-2" />
                    Connecter Google Calendar
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" data-testid="button-calendar-page">
                  <Link href="/calendar">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir la page Calendrier
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autres intégrations</CardTitle>
          <CardDescription className="text-xs">
            Bientôt disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            D'autres intégrations seront disponibles prochainement, notamment :
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
            <li>Slack - Notifications et actions rapides</li>
            <li>Jira - Import/Export de projets</li>
            <li>Notion - Synchronisation de notes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
