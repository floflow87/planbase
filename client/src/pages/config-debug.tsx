import { useConfig, type ConfigSource } from "@/hooks/useConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Cloud, FileCode, CheckCircle2, XCircle, Loader2 } from "lucide-react";

function getSourceBadge(source: ConfigSource) {
  switch (source) {
    case "strapi":
      return <Badge variant="default" className="bg-blue-600 text-white" data-testid="badge-source-strapi"><Cloud className="w-3 h-3 mr-1" />Strapi</Badge>;
    case "db":
      return <Badge variant="default" className="bg-violet-600 text-white" data-testid="badge-source-db"><Database className="w-3 h-3 mr-1" />Base de données</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-source-default"><FileCode className="w-3 h-3 mr-1" />Défaut (hardcodé)</Badge>;
  }
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `Array (${value.length} éléments)`;
  }
  if (typeof value === "object" && value !== null) {
    return `Object (${Object.keys(value).length} clés)`;
  }
  return String(value);
}

export default function ConfigDebug() {
  const { userProfile } = useAuth();
  const { config, sources, meta, isLoading, error, refetch } = useConfig();

  if (userProfile?.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="config-debug-access-denied">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Accès refusé</h2>
            <p className="text-muted-foreground">Cette page est réservée aux administrateurs du compte.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="config-debug-loading">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="config-debug-error">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Erreur</h2>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const configKeys = config ? Object.keys(config) : [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto h-full" data-testid="config-debug-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-config-debug-title">Config Debug</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Résolution : Défaut (hardcodé) → Strapi → Base de données
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-config">
          <RefreshCw className="w-4 h-4 mr-2" />
          Rafraîchir
        </Button>
      </div>

      <Card data-testid="card-config-meta">
        <CardHeader>
          <CardTitle className="text-base">Métadonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Résolu le :</span>
            <span data-testid="text-resolved-at">{meta?.resolvedAt ? new Date(meta.resolvedAt).toLocaleString("fr-FR") : "—"}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Account ID :</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid="text-account-id">{meta?.accountId ?? "—"}</code>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">User ID :</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid="text-user-id">{meta?.userId ?? "—"}</code>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Strapi :</span>
            {meta?.strapiAvailable ? (
              <Badge variant="default" className="bg-green-600 text-white" data-testid="badge-strapi-available">
                <CheckCircle2 className="w-3 h-3 mr-1" />Connecté
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-strapi-unavailable">
                <XCircle className="w-3 h-3 mr-1" />Non disponible (fallback actif)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Configuration effective</h2>
        {configKeys.map((key) => {
          const value = (config as Record<string, unknown>)?.[key];
          const sourceInfo = sources?.[key];

          return (
            <Card key={key} data-testid={`card-config-${key}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-mono" data-testid={`text-config-key-${key}`}>{key}</CardTitle>
                  {sourceInfo && getSourceBadge(sourceInfo.source)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2" data-testid={`text-config-summary-${key}`}>
                  {formatValue(value)}
                </div>
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" data-testid={`button-toggle-detail-${key}`}>
                    Voir le contenu complet
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto" data-testid={`text-config-detail-${key}`}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
