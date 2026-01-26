import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, Settings, Unlink, ExternalLink } from "lucide-react";
import { SiGooglecalendar, SiGmail, SiGooglemeet, SiGoogledrive, SiGooglesheets, SiSlack, SiCalendly } from "react-icons/si";
import { MdOutlineEmail, MdDynamicForm } from "react-icons/md";

interface GoogleStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  available: boolean;
  detailPath: string;
}

const integrations: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronisez vos rendez-vous avec Google Calendar",
    icon: <SiGooglecalendar className="h-8 w-8 text-blue-500" />,
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    available: true,
    detailPath: "/settings/integrations/google-calendar",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Synchronisez vos emails avec Google Gmail",
    icon: <SiGmail className="h-8 w-8 text-red-500" />,
    iconBg: "bg-red-50 dark:bg-red-900/20",
    available: false,
    detailPath: "/settings/integrations/gmail",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Intégrez vos visioconférences avec Google Meet",
    icon: <SiGooglemeet className="h-8 w-8 text-green-500" />,
    iconBg: "bg-green-50 dark:bg-green-900/20",
    available: false,
    detailPath: "/settings/integrations/google-meet",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Connectez vos fichiers Google Drive",
    icon: <SiGoogledrive className="h-8 w-8 text-yellow-500" />,
    iconBg: "bg-yellow-50 dark:bg-yellow-900/20",
    available: false,
    detailPath: "/settings/integrations/google-drive",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Exportez vos données vers Google Sheets",
    icon: <SiGooglesheets className="h-8 w-8 text-green-600" />,
    iconBg: "bg-green-50 dark:bg-green-900/20",
    available: false,
    detailPath: "/settings/integrations/google-sheets",
  },
  {
    id: "google-forms",
    name: "Google Forms",
    description: "Créez des formulaires connectés à Planbase",
    icon: <MdDynamicForm className="h-8 w-8 text-purple-500" />,
    iconBg: "bg-purple-50 dark:bg-purple-900/20",
    available: false,
    detailPath: "/settings/integrations/google-forms",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Synchronisez vos emails avec Microsoft Outlook",
    icon: <MdOutlineEmail className="h-8 w-8 text-blue-600" />,
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    available: false,
    detailPath: "/settings/integrations/outlook",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Recevez des notifications et collaborez via Slack",
    icon: <SiSlack className="h-8 w-8 text-[#4A154B]" />,
    iconBg: "bg-purple-50 dark:bg-purple-900/20",
    available: false,
    detailPath: "/settings/integrations/slack",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Planifiez vos rendez-vous avec Calendly",
    icon: <SiCalendly className="h-8 w-8 text-blue-500" />,
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    available: false,
    detailPath: "/settings/integrations/calendly",
  },
];

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
        variant: "success",
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {integrations.map((integration) => {
          const isGoogleCalendar = integration.id === "google-calendar";
          const isConnected = isGoogleCalendar && googleStatus?.connected;
          const isLoading = isGoogleCalendar && isLoadingGoogle;

          return (
            <Card 
              key={integration.id} 
              className="relative overflow-hidden"
              data-testid={`card-integration-${integration.id}`}
            >
              <CardContent className="p-4">
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {isLoading ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </Badge>
                  ) : isConnected ? (
                    <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Connecté
                    </Badge>
                  ) : !integration.available ? (
                    <Badge variant="secondary" className="text-xs">
                      Bientôt disponible
                    </Badge>
                  ) : null}
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${integration.iconBg} border border-border`}>
                  {integration.icon}
                </div>

                {/* Name & Description */}
                <h3 className="font-semibold text-sm mb-1">{integration.name}</h3>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  {integration.description}
                </p>

                {/* Connected info */}
                {isConnected && googleStatus?.email && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Votre compte Google est connecté.{" "}
                    <Link href={integration.detailPath} className="text-primary hover:underline">
                      Voir les détails
                    </Link>
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {integration.available ? (
                    <>
                      <Button 
                        asChild 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-configure-${integration.id}`}
                      >
                        <Link href={integration.detailPath}>
                          <Settings className="h-3.5 w-3.5 mr-1.5" />
                          Configurer
                        </Link>
                      </Button>
                      {isConnected && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectMutation.mutate()}
                          disabled={disconnectMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-disconnect-${integration.id}`}
                        >
                          {disconnectMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlink className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      disabled
                      className="opacity-50"
                      data-testid={`button-coming-soon-${integration.id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Détails
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
