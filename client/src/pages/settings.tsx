import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings as SettingsIcon } from "lucide-react";

interface Account {
  id: string;
  name: string;
}

export default function Settings() {
  const { data: currentUser } = useQuery<{ accountId: string }>({
    queryKey: ["/api/me"],
  });

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", currentUser?.accountId],
    enabled: !!currentUser?.accountId,
  });

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
          <p className="text-muted-foreground mt-2">Configurez votre compte et vos préférences</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-violet-100 dark:bg-violet-900/30">
                <SettingsIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle>Informations du compte</CardTitle>
                <CardDescription>
                  Gérez les paramètres de votre compte
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Nom du compte</p>
                <p className="text-sm text-muted-foreground mt-1">{account?.name || "Chargement..."}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">ID du compte</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{account?.id || "Chargement..."}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Intégrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Google Calendar - Connectez votre calendrier depuis la page Calendrier</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Les credentials Google OAuth sont configurés au niveau de l'application.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
