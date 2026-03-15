import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, CheckCircle, Loader2, Unlink, Calendar, RefreshCw, 
  ExternalLink, Settings, Shield, Clock, Zap, Mail
} from "lucide-react";
import { SiCalendly } from "react-icons/si";

import googleCalendarIcon from "@assets/Google_Calendar_icon_(2020).svg_1769421317054.png";
import gmailIcon from "@assets/Gmail_icon_(2020).svg_1769421317054.png";
import googleMeetIcon from "@assets/Google_Meet_Logo_512px_1769421317054.webp";
import googleDriveIcon from "@assets/Google_Drive_logo_1769421317053.png";
import googleSheetsIcon from "@assets/Google_Sheets_logo_(2014-2020).svg_1769421317055.png";
import googleFormsIcon from "@assets/Google_Forms_2020_Logo.svg_1769421317054.png";
import outlookIcon from "@assets/Microsoft_Office_Outlook_(2018–2024).svg_1769421317055.png";
import slackIcon from "@assets/WORK-d00db09e_1769421317055.png";

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
  calendarId?: string;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  messageCount?: number;
  canSend?: boolean;
  hasFullRead?: boolean;
  syncPeriodMonths?: number;
}

interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: React.ReactNode;
  iconBg: string;
  features: string[];
  available: boolean;
}

const integrationDetails: Record<string, IntegrationInfo> = {
  "google-calendar": {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronisez vos rendez-vous avec Google Calendar",
    longDescription: "Connectez votre compte Google Calendar pour synchroniser automatiquement vos rendez-vous. Les événements créés dans Planbase apparaîtront dans votre calendrier Google et vice versa.",
    icon: <img src={googleCalendarIcon} alt="Google Calendar" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Synchronisation bidirectionnelle des rendez-vous",
      "Création automatique d'événements Google",
      "Affichage des événements Google dans Planbase",
      "Gestion des conflits d'horaires",
    ],
    available: true,
  },
  "gmail": {
    id: "gmail",
    name: "Gmail",
    description: "Synchronisez vos emails avec Google Gmail",
    longDescription: "Intégrez Gmail pour synchroniser automatiquement vos emails avec vos contacts CRM. Lisez le contenu complet des emails, envoyez des emails directement depuis les fiches clients, et suivez toutes les interactions dans l'historique d'activité.",
    icon: <img src={gmailIcon} alt="Gmail" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Lecture du contenu complet des emails",
      "Envoi d'emails depuis les fiches clients",
      "Liaison automatique avec vos contacts CRM",
      "Historique email dans la timeline client",
      "Détection automatique des pièces jointes",
      "Filtrage automatique des spams et newsletters",
    ],
    available: true,
  },
  "google-meet": {
    id: "google-meet",
    name: "Google Meet",
    description: "Intégrez vos visioconférences avec Google Meet",
    longDescription: "Planifiez et lancez des visioconférences Google Meet directement depuis vos rendez-vous Planbase. Partagez les liens de réunion automatiquement avec vos participants.",
    icon: <img src={googleMeetIcon} alt="Google Meet" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Création automatique de liens Meet",
      "Intégration avec le calendrier",
      "Notifications de réunion",
      "Enregistrement des réunions",
    ],
    available: false,
  },
  "google-drive": {
    id: "google-drive",
    name: "Google Drive",
    description: "Connectez vos fichiers Google Drive",
    longDescription: "Accédez à vos fichiers Google Drive depuis Planbase. Liez des documents à vos projets et partagez-les facilement avec votre équipe.",
    icon: <img src={googleDriveIcon} alt="Google Drive" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Accès aux fichiers Drive",
      "Liaison de documents aux projets",
      "Partage sécurisé",
      "Prévisualisation des fichiers",
    ],
    available: false,
  },
  "google-sheets": {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Exportez vos données vers Google Sheets",
    longDescription: "Exportez vos données Planbase vers Google Sheets pour des analyses avancées. Créez des rapports personnalisés et des tableaux de bord automatisés.",
    icon: <img src={googleSheetsIcon} alt="Google Sheets" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Export automatique des données",
      "Rapports personnalisés",
      "Synchronisation en temps réel",
      "Formules et graphiques",
    ],
    available: false,
  },
  "google-forms": {
    id: "google-forms",
    name: "Google Forms",
    description: "Créez des formulaires connectés à Planbase",
    longDescription: "Créez des formulaires Google Forms et récupérez automatiquement les réponses dans Planbase. Idéal pour les questionnaires clients et les retours d'expérience.",
    icon: <img src={googleFormsIcon} alt="Google Forms" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Création de formulaires",
      "Import automatique des réponses",
      "Notifications de nouvelles réponses",
      "Analyse des résultats",
    ],
    available: false,
  },
  "outlook": {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Synchronisez vos emails avec Microsoft Outlook",
    longDescription: "Intégrez Microsoft Outlook pour synchroniser vos emails et votre calendrier. Parfait pour les équipes utilisant Microsoft 365.",
    icon: <img src={outlookIcon} alt="Outlook" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Synchronisation des emails",
      "Calendrier Outlook",
      "Contacts Microsoft",
      "Tâches Outlook",
    ],
    available: false,
  },
  "slack": {
    id: "slack",
    name: "Slack",
    description: "Recevez des notifications et collaborez via Slack",
    longDescription: "Connectez Slack pour recevoir des notifications en temps réel et interagir avec Planbase directement depuis vos canaux Slack.",
    icon: <img src={slackIcon} alt="Slack" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Notifications en temps réel",
      "Commandes Slack",
      "Partage de projets",
      "Alertes personnalisées",
    ],
    available: false,
  },
  "calendly": {
    id: "calendly",
    name: "Calendly",
    description: "Planifiez vos rendez-vous avec Calendly",
    longDescription: "Synchronisez Calendly avec Planbase pour importer automatiquement vos rendez-vous planifiés via Calendly.",
    icon: <SiCalendly className="h-10 w-10 text-blue-500" />,
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    features: [
      "Import automatique des RDV",
      "Synchronisation bidirectionnelle",
      "Gestion des disponibilités",
      "Notifications de réservation",
    ],
    available: false,
  },
};

export default function IntegrationDetailPage() {
  const [, params] = useRoute("/settings/integrations/:integrationId");
  const integrationId = params?.integrationId || "";
  const { toast } = useToast();

  const integration = integrationDetails[integrationId];

  const isGmail = integrationId === "gmail";
  const isGoogleCalendar = integrationId === "google-calendar";

  const { data: googleStatus, isLoading: isLoadingGoogle } = useQuery<GoogleStatus>({
    queryKey: ["/api/google/status"],
    enabled: isGoogleCalendar,
  });

  const { data: gmailStatus, isLoading: isLoadingGmail } = useQuery<GmailStatus>({
    queryKey: ["/api/gmail/status"],
    enabled: isGmail,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isGmail ? "/api/gmail/disconnect" : "/api/google/disconnect";
      const response = await apiRequest(endpoint, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({
        title: "Déconnexion réussie",
        description: isGmail ? "Gmail a été déconnecté." : "Votre compte Google Calendar a été déconnecté.",
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

  const gmailSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/gmail/sync", "POST");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({
        title: "Synchronisation terminée",
        description: `${data.synced} emails synchronisés, ${data.linked} liaisons créées.`,
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser Gmail.",
        variant: "destructive",
      });
    },
  });

  const syncPeriodMutation = useMutation({
    mutationFn: async (months: number) => {
      const response = await apiRequest("/api/gmail/sync-period", "PATCH", { months });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({ title: "Période de synchronisation mise à jour", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la période.", variant: "destructive" });
    },
  });

  const handleConnectGoogle = async () => {
    try {
      const endpoint = isGmail ? "/api/gmail/auth/start" : "/api/google/auth/start";
      const response = await apiRequest(endpoint, "GET");
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Impossible de se connecter à ${isGmail ? 'Gmail' : 'Google Calendar'}.`,
        variant: "destructive",
      });
    }
  };

  const handleSyncGoogle = () => {
    if (isGmail) {
      gmailSyncMutation.mutate();
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/google/events"] });
      toast({
        title: "Synchronisation",
        description: "Événements Google Calendar actualisés.",
        variant: "success",
      });
    }
  };

  if (!integration) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Intégration non trouvée</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/settings">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour aux paramètres
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConnected = (isGoogleCalendar && googleStatus?.connected) || (isGmail && gmailStatus?.connected);
  const isLoading = (isGoogleCalendar && isLoadingGoogle) || (isGmail && isLoadingGmail);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux paramètres
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${integration.iconBg} border border-border`}>
              {integration.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-base">{integration.name}</CardTitle>
                {isLoading ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </Badge>
                ) : isConnected ? (
                  <Badge className="gap-1 bg-green-500 hover:bg-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Connecté
                  </Badge>
                ) : !integration.available ? (
                  <Badge variant="secondary">Bientôt disponible</Badge>
                ) : (
                  <Badge variant="outline">Non connecté</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {integration.longDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {integration.available ? (
            <>
              {isConnected && (googleStatus || gmailStatus) ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Informations de connexion
                    </h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Compte Google</span>
                        <span className="font-medium">{isGmail ? gmailStatus?.email : googleStatus?.email}</span>
                      </div>
                      {isGoogleCalendar && googleStatus?.calendarId && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Calendrier ID</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">
                            {googleStatus.calendarId}
                          </span>
                        </div>
                      )}
                      {isGmail && gmailStatus?.lastSyncAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Dernière synchronisation</span>
                          <span className="text-xs">{new Date(gmailStatus.lastSyncAt).toLocaleString("fr-FR")}</span>
                        </div>
                      )}
                      {isGmail && gmailStatus?.messageCount !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Emails synchronisés</span>
                          <span className="font-medium">{gmailStatus.messageCount}</span>
                        </div>
                      )}
                      {isGmail && gmailStatus?.connected && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Période de synchronisation</span>
                          <Select
                            value={String(gmailStatus?.syncPeriodMonths ?? 3)}
                            onValueChange={(val) => syncPeriodMutation.mutate(Number(val))}
                            disabled={syncPeriodMutation.isPending}
                          >
                            <SelectTrigger className="h-7 text-xs w-32" data-testid="select-gmail-sync-period">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3" className="text-xs">3 mois</SelectItem>
                              <SelectItem value="6" className="text-xs">6 mois</SelectItem>
                              <SelectItem value="12" className="text-xs">1 an</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {isGmail && gmailStatus?.connected && (!gmailStatus.canSend || !gmailStatus.hasFullRead) && (
                    <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200" data-testid="text-gmail-upgrade-notice">
                      <p className="font-medium mb-1">Mise à jour disponible</p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Reconnectez Gmail pour accéder au contenu complet des emails et à l'envoi d'emails depuis Planbase. Déconnectez puis reconnectez votre compte ci-dessous.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {isGoogleCalendar && (
                      <Button asChild size="sm" data-testid="button-open-calendar">
                        <Link href="/calendar">
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          Ouvrir le calendrier
                        </Link>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleSyncGoogle}
                      disabled={isGmail && gmailSyncMutation.isPending}
                      data-testid="button-sync-gmail"
                    >
                      {isGmail && gmailSyncMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Synchroniser
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="text-destructive hover:text-destructive"
                      data-testid="button-disconnect-google"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Déconnecter
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connectez votre compte {integration.name} pour commencer à utiliser cette intégration.
                  </p>
                  <Button 
                    onClick={handleConnectGoogle}
                    disabled={isLoading}
                    data-testid="button-connect-integration"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connecter {integration.name}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h4 className="font-medium mb-2">Bientôt disponible</h4>
              <p className="text-sm text-muted-foreground">
                Cette intégration sera disponible prochainement. Restez à l'écoute pour les mises à jour !
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Fonctionnalités
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {integration.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Sécurité & Confidentialité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Vos données sont protégées grâce au protocole OAuth 2.0. Planbase n'accède qu'aux 
            informations nécessaires et ne stocke jamais vos identifiants. Vous pouvez révoquer 
            l'accès à tout moment depuis cette page ou depuis les paramètres de votre compte 
            {integration.name.includes("Google") ? " Google" : ""}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
