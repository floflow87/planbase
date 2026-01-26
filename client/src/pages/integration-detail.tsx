import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, CheckCircle, Loader2, Unlink, Calendar, RefreshCw, 
  ExternalLink, Settings, Shield, Clock, Zap 
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
    longDescription: "Intégrez Gmail pour centraliser vos communications clients directement dans Planbase. Retrouvez vos emails importants liés à vos projets sans quitter l'application.",
    icon: <img src={gmailIcon} alt="Gmail" className="h-10 w-10 object-contain" />,
    iconBg: "bg-white dark:bg-gray-800",
    features: [
      "Synchronisation des emails clients",
      "Envoi d'emails depuis Planbase",
      "Historique des conversations",
      "Pièces jointes accessibles",
    ],
    available: false,
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

  const { data: googleStatus, isLoading: isLoadingGoogle } = useQuery<GoogleStatus>({
    queryKey: ["/api/google/status"],
    enabled: integrationId === "google-calendar",
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

  const handleConnectGoogle = async () => {
    try {
      const response = await apiRequest("/api/google/auth-url", "GET");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const handleSyncGoogle = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/google/events"] });
    toast({
      title: "Synchronisation",
      description: "Événements Google Calendar actualisés.",
      variant: "success",
    });
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

  const isConnected = integrationId === "google-calendar" && googleStatus?.connected;
  const isLoading = integrationId === "google-calendar" && isLoadingGoogle;

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
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${integration.iconBg} border border-border`}>
              {integration.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-xl">{integration.name}</CardTitle>
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
              <CardDescription className="text-sm">
                {integration.longDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {integration.available ? (
            <>
              {isConnected && googleStatus ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Informations de connexion
                    </h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Compte Google</span>
                        <span className="font-medium">{googleStatus.email}</span>
                      </div>
                      {googleStatus.calendarId && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Calendrier ID</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">
                            {googleStatus.calendarId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button asChild data-testid="button-open-calendar">
                      <Link href="/calendar">
                        <Calendar className="h-4 w-4 mr-2" />
                        Ouvrir le calendrier
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleSyncGoogle}
                      data-testid="button-sync-google"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchroniser
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="text-destructive hover:text-destructive"
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
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Fonctionnalités
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
            {integration.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Sécurité & Confidentialité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
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
