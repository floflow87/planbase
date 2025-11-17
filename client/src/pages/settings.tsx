import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Save, Key } from "lucide-react";

interface Account {
  id: string;
  name: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
}

export default function Settings() {
  const { toast } = useToast();
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");

  // Fetch current account settings
  const { data: currentUser } = useQuery<{ accountId: string }>({
    queryKey: ["/api/me"],
  });

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", currentUser?.accountId],
    enabled: !!currentUser?.accountId,
  });

  // Load existing credentials when account data is fetched
  useEffect(() => {
    if (account) {
      setGoogleClientId(account.googleClientId || "");
      setGoogleClientSecret(account.googleClientSecret || "");
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: async (data: { googleClientId: string; googleClientSecret: string }) => {
      return apiRequest(`/api/accounts/${currentUser?.accountId}/google-oauth`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", currentUser?.accountId] });
      toast({
        title: "✅ Configuration enregistrée",
        description: "Les credentials Google OAuth ont été mis à jour avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les credentials.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      googleClientId: googleClientId.trim(),
      googleClientSecret: googleClientSecret.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground mt-2">Configurez les intégrations et services externes</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-violet-100 dark:bg-violet-900/30">
                <Key className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle>Google Calendar OAuth</CardTitle>
                <CardDescription>
                  Configurez les credentials OAuth pour permettre aux utilisateurs de connecter leur Google Calendar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="googleClientId" className="text-sm font-medium">
                    Client ID
                  </Label>
                  <Input
                    id="googleClientId"
                    type="text"
                    placeholder="123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    data-testid="input-google-client-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleClientSecret" className="text-sm font-medium">
                    Client Secret
                  </Label>
                  <Input
                    id="googleClientSecret"
                    type="password"
                    placeholder="GOCSPX-abcdefghijklmnopqrstuvwxyz"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    data-testid="input-google-client-secret"
                  />
                </div>
              </div>

              <div className="p-4 rounded-md bg-muted space-y-2">
                <p className="text-sm font-medium text-foreground">Comment obtenir ces credentials ?</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Allez sur <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Google Cloud Console</a></li>
                  <li>Créez un nouveau projet ou sélectionnez-en un existant</li>
                  <li>Activez l'API "Google Calendar API"</li>
                  <li>Créez des credentials OAuth 2.0 (Type: Application Web)</li>
                  <li>Ajoutez l'URL de callback : <code className="bg-background px-1 py-0.5 rounded text-xs">{window.location.origin}/api/google/auth/callback</code></li>
                  <li>Copiez le Client ID et le Client Secret ci-dessus</li>
                </ol>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || !googleClientId.trim() || !googleClientSecret.trim()}
                  data-testid="button-save-google-oauth"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {account?.googleClientId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statut de la configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Google Calendar OAuth configuré</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Les utilisateurs peuvent maintenant connecter leur Google Calendar depuis la page Calendrier.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
