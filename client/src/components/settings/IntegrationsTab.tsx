import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, Settings, Unlink, ExternalLink } from "lucide-react";
import { SiCalendly } from "react-icons/si";

import googleCalendarIcon from "@assets/Google_Calendar_icon_(2020).svg_1769421317054.png";
import gmailIcon from "@assets/Gmail_icon_(2020).svg_1769421317054.png";
import googleMeetIcon from "@assets/Google_Meet_Logo_512px_1769421317054.webp";
import googleDriveIcon from "@assets/Google_Drive_logo_1769421317053.png";
import googleSheetsIcon from "@assets/Google_Sheets_logo_(2014-2020).svg_1769421317055.png";
import googleFormsIcon from "@assets/Google_Forms_2020_Logo.svg_1769421317054.png";
import outlookIcon from "@assets/Microsoft_Office_Outlook_(2018–2024).svg_1769421317055.png";
import slackIcon from "@assets/WORK-d00db09e_1769421317055.png";
import docusignIcon from "@assets/docusign.png";
import linkedinIcon from "@assets/linkedin.png";
import paypalIcon from "@assets/paypal.png";
import lemlistIcon from "@assets/lemlist.png";

interface GoogleStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  messageCount?: number;
}

interface SlackStatus {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  connectedAt?: string;
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
    icon: <img src={googleCalendarIcon} alt="Google Calendar" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: true,
    detailPath: "/settings/integrations/google-calendar",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Synchronisez vos emails avec Google Gmail",
    icon: <img src={gmailIcon} alt="Gmail" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: true,
    detailPath: "/settings/integrations/gmail",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Intégrez vos visioconférences avec Google Meet",
    icon: <img src={googleMeetIcon} alt="Google Meet" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/google-meet",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Connectez vos fichiers Google Drive",
    icon: <img src={googleDriveIcon} alt="Google Drive" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/google-drive",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Exportez vos données vers Google Sheets",
    icon: <img src={googleSheetsIcon} alt="Google Sheets" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/google-sheets",
  },
  {
    id: "google-forms",
    name: "Google Forms",
    description: "Créez des formulaires connectés à Planbase",
    icon: <img src={googleFormsIcon} alt="Google Forms" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/google-forms",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Synchronisez vos emails avec Microsoft Outlook",
    icon: <img src={outlookIcon} alt="Outlook" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/outlook",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Envoyez des notifications dans vos channels Slack via les automatisations",
    icon: <img src={slackIcon} alt="Slack" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: true,
    detailPath: "/settings/integrations/slack",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Planifiez vos rendez-vous avec Calendly",
    icon: <SiCalendly className="h-7 w-7 text-blue-500" />,
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    available: false,
    detailPath: "/settings/integrations/calendly",
  },
  {
    id: "docusign",
    name: "DocuSign",
    description: "Signez et gérez vos contrats électroniquement",
    icon: <img src={docusignIcon} alt="DocuSign" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/docusign",
  },
  {
    id: "lemlist",
    name: "Lemlist",
    description: "Automatisez vos campagnes d'emailing personnalisées",
    icon: <img src={lemlistIcon} alt="Lemlist" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/lemlist",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Connectez et enrichissez vos contacts professionnels",
    icon: <img src={linkedinIcon} alt="LinkedIn" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/linkedin",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Gérez vos paiements et transactions en ligne",
    icon: <img src={paypalIcon} alt="PayPal" className="h-7 w-7 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    available: false,
    detailPath: "/settings/integrations/paypal",
  },
];

export function IntegrationsTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: googleStatus, isLoading: isLoadingGoogle } = useQuery<GoogleStatus>({
    queryKey: ["/api/google/status"],
  });

  const { data: gmailStatus, isLoading: isLoadingGmail } = useQuery<GmailStatus>({
    queryKey: ["/api/gmail/status"],
  });

  const { data: slackStatus, isLoading: isLoadingSlack } = useQuery<SlackStatus>({
    queryKey: ["/api/slack/status"],
  });

  // Handle redirect callbacks from Slack OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("slackSuccess") === "1") {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: "Slack connecté avec succès !", variant: "success" });
      navigate("/settings?tab=integrations", { replace: true });
    } else if (params.get("slackError")) {
      toast({ title: "Erreur Slack", description: decodeURIComponent(params.get("slackError") || ""), variant: "destructive" });
      navigate("/settings?tab=integrations", { replace: true });
    }
  }, []);

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/google/disconnect", "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
      toast({ title: "Déconnexion réussie", description: "Votre compte Google Calendar a été déconnecté.", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de déconnecter le compte Google.", variant: "destructive" });
    },
  });

  const connectSlackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/slack/oauth/start", "GET");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.url as string;
    },
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (e: any) => {
      toast({ title: "Erreur Slack OAuth", description: e.message, variant: "destructive" });
    },
  });

  const disconnectSlackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/slack/disconnect", "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels"] });
      toast({ title: "Slack déconnecté", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de déconnecter Slack.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {integrations.map((integration) => {
          const isGoogleCalendar = integration.id === "google-calendar";
          const isGmail = integration.id === "gmail";
          const isSlack = integration.id === "slack";

          const isConnected =
            (isGoogleCalendar && googleStatus?.connected) ||
            (isGmail && gmailStatus?.connected) ||
            (isSlack && slackStatus?.connected);

          const isLoading =
            (isGoogleCalendar && isLoadingGoogle) ||
            (isGmail && isLoadingGmail) ||
            (isSlack && isLoadingSlack);

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
                    <Badge variant="secondary" className="gap-0.5 text-[10px] px-1.5 py-0">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    </Badge>
                  ) : isConnected ? (
                    <Badge className="gap-0.5 text-[10px] px-1.5 py-0 bg-green-500 no-default-hover-elevate no-default-active-elevate">
                      <CheckCircle className="h-2.5 w-2.5" />
                      Connecté
                    </Badge>
                  ) : !integration.available ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
                {isConnected && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {isSlack
                      ? `Connecté à ${slackStatus?.teamName ?? "votre workspace"}.`
                      : isGmail
                      ? "Gmail est connecté."
                      : "Votre compte Google est connecté."}{" "}
                    {!isSlack && (
                      <Link href={integration.detailPath} className="text-primary hover:underline">
                        Voir les détails
                      </Link>
                    )}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {integration.available ? (
                    isSlack ? (
                      <>
                        {!slackStatus?.connected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => connectSlackMutation.mutate()}
                            disabled={connectSlackMutation.isPending}
                            data-testid="button-connect-slack"
                          >
                            {connectSlackMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Settings className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Connecter
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => disconnectSlackMutation.mutate()}
                            disabled={disconnectSlackMutation.isPending}
                            className="text-destructive"
                            data-testid="button-disconnect-slack"
                          >
                            {disconnectSlackMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
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
                            onClick={() => disconnectGoogleMutation.mutate()}
                            disabled={disconnectGoogleMutation.isPending}
                            className="text-destructive"
                            data-testid={`button-disconnect-${integration.id}`}
                          >
                            {disconnectGoogleMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </>
                    )
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
