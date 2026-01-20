import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Clock, ExternalLink, FileText, FolderKanban, LayoutDashboard, Lock, MapPin, Target, AlertTriangle } from "lucide-react";

interface ShareData {
  resourceType: string;
  resourceId: string;
  permissions: { read: boolean; subviews?: string[] };
  expiresAt: string | null;
  data: any;
}

const RESOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  project: <FolderKanban className="h-5 w-5" />,
  roadmap: <MapPin className="h-5 w-5" />,
  backlog: <LayoutDashboard className="h-5 w-5" />,
  note: <FileText className="h-5 w-5" />,
  document: <FileText className="h-5 w-5" />,
  profitability_project: <Target className="h-5 w-5" />,
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  project: "Projet",
  roadmap: "Roadmap",
  backlog: "Backlog",
  note: "Note",
  document: "Document",
  profitability_project: "Rentabilité",
};

function ShareBanner({ expiresAt }: { expiresAt: string | null }) {
  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expiré";
    if (diffDays === 0) return "Expire aujourd'hui";
    if (diffDays === 1) return "Expire demain";
    return `Expire dans ${diffDays} jours`;
  };

  return (
    <div className="bg-violet-600 text-white py-2 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4" />
        <span className="text-sm font-medium">Lien partagé — lecture seule</span>
        {expiresAt && (
          <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0">
            <Clock className="h-3 w-3 mr-1" />
            {formatExpiry(expiresAt)}
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-white hover:bg-white/10"
        onClick={() => window.open("/", "_blank")}
        data-testid="button-open-planbase"
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        Ouvrir PlanBase
      </Button>
    </div>
  );
}

function ProjectView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-violet-600" />
            <CardTitle>{data.name}</CardTitle>
          </div>
          <CardDescription>{data.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <Badge variant="secondary">{data.stage || data.status || "Non défini"}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date de début</p>
              <p className="font-medium">
                {data.startDate ? new Date(data.startDate).toLocaleDateString("fr-FR") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date de fin</p>
              <p className="font-medium">
                {data.endDate ? new Date(data.endDate).toLocaleDateString("fr-FR") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-medium">
                {data.budget ? `${Number(data.budget).toLocaleString("fr-FR")} €` : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoadmapView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-violet-600" />
            <CardTitle>{data.name}</CardTitle>
          </div>
          <CardDescription>{data.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.items && data.items.length > 0 ? (
            <div className="space-y-3">
              {data.items.map((item: any) => (
                <div key={item.id} className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline">{item.status || "Planifié"}</Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun élément dans la roadmap</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BacklogView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-violet-600" />
            <CardTitle>{data.name}</CardTitle>
          </div>
          <CardDescription>{data.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.sprints && data.sprints.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Sprints ({data.sprints.length})</h4>
              {data.sprints.map((sprint: any) => (
                <div key={sprint.id} className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{sprint.name}</span>
                    <Badge variant={sprint.status === "active" ? "default" : "secondary"}>
                      {sprint.status === "active" ? "Actif" : sprint.status}
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    {sprint.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(sprint.startDate).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun sprint dans le backlog</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NoteView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            <CardTitle>{data.title}</CardTitle>
          </div>
          <CardDescription>
            Créé le {new Date(data.createdAt).toLocaleDateString("fr-FR")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {data.content ? (
              <div dangerouslySetInnerHTML={{ __html: data.content }} />
            ) : (
              <p className="text-muted-foreground">Aucun contenu</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            <CardTitle>{data.name || data.title}</CardTitle>
          </div>
          <CardDescription>
            {data.description || `Document créé le ${new Date(data.createdAt).toLocaleDateString("fr-FR")}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.url && (
            <Button variant="outline" asChild data-testid="button-download-doc">
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Télécharger le document
              </a>
            </Button>
          )}
          {data.content && (
            <div className="prose prose-sm max-w-none dark:prose-invert mt-4">
              <div dangerouslySetInnerHTML={{ __html: data.content }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfitabilityView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-600" />
            <CardTitle>Rentabilité — {data.name}</CardTitle>
          </div>
          <CardDescription>Vue d'ensemble de la rentabilité du projet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="text-lg font-semibold">
                {data.budget ? `${Number(data.budget).toLocaleString("fr-FR")} €` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">TJM effectif</p>
              <p className="text-lg font-semibold">
                {data.effectiveTjm ? `${Number(data.effectiveTjm).toLocaleString("fr-FR")} €` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Marge</p>
              <p className="text-lg font-semibold">
                {data.marginPercent ? `${data.marginPercent}%` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Jours vendus</p>
              <p className="text-lg font-semibold">
                {data.soldDays || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SharePublicPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<ShareData>({
    queryKey: ["/api/share", token],
    queryFn: async () => {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Lien invalide");
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as Error).message;
    const isExpired = errorMessage === "expired";
    const isRevoked = errorMessage === "revoked";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {isExpired ? (
              <>
                <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Lien expiré</h2>
                <p className="text-muted-foreground">
                  Ce lien de partage a expiré. Demandez un nouveau lien au propriétaire.
                </p>
              </>
            ) : isRevoked ? (
              <>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Lien révoqué</h2>
                <p className="text-muted-foreground">
                  Ce lien de partage a été désactivé par son propriétaire.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
                <p className="text-muted-foreground">
                  Ce lien de partage n'existe pas ou n'est plus valide.
                </p>
              </>
            )}
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => window.open("/", "_blank")}
              data-testid="button-go-planbase"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Aller sur PlanBase
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const renderContent = () => {
    switch (data.resourceType) {
      case "project":
        return <ProjectView data={data.data} />;
      case "roadmap":
        return <RoadmapView data={data.data} />;
      case "backlog":
        return <BacklogView data={data.data} />;
      case "note":
        return <NoteView data={data.data} />;
      case "document":
        return <DocumentView data={data.data} />;
      case "profitability_project":
        return <ProfitabilityView data={data.data} />;
      default:
        return (
          <Card>
            <CardContent className="pt-6">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(data.data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ShareBanner expiresAt={data.expiresAt} />
      
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-6">
          {RESOURCE_TYPE_ICONS[data.resourceType]}
          <span className="text-sm text-muted-foreground">
            {RESOURCE_TYPE_LABELS[data.resourceType] || data.resourceType}
          </span>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
