import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Setup() {
  const [copied, setCopied] = useState(false);
  
  const projectRef = "gfftezyrhsxtaeceuszd";
  const requiredConnectionString = `postgresql://postgres.${projectRef}:[YOUR_DB_PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container max-w-4xl mx-auto p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Configuration Supabase</h1>
          <p className="text-muted-foreground">
            Connexion requise pour activer la base de données
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Problème IPv6 détecté :</strong> Le serveur Supabase n'est accessible qu'en IPv6. 
            Vous devez utiliser le Connection Pooler (IPv4) de Supabase.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Récupérer le mot de passe</CardTitle>
            <CardDescription>
              Allez dans votre Supabase Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Projet détecté:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{projectRef}</code>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Instructions :</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Ouvrez <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Supabase Dashboard</a></li>
                <li>Allez dans <strong>Settings → Database</strong></li>
                <li>Section <strong>Connection Pooling</strong></li>
                <li>Sélectionnez le mode <strong>Transaction</strong></li>
                <li>Copiez le mot de passe qui apparaît (PAS la clé API !)</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 2: Configurer le secret Replit</CardTitle>
            <CardDescription>
              Ajoutez le mot de passe dans les secrets Replit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Nom du secret :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted px-4 py-2 rounded">SUPABASE_DB_PASSWORD</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("SUPABASE_DB_PASSWORD")}
                  data-testid="button-copy-secret-name"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Instructions :</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Cliquez sur l'icône 🔒 (cadenas) dans la barre latérale gauche de Replit</li>
                <li>Cherchez le secret <code className="text-xs">SUPABASE_DB_PASSWORD</code></li>
                <li>Cliquez sur "Edit" ou créez-le s'il n'existe pas</li>
                <li>Collez le mot de passe copié depuis Supabase</li>
                <li>Cliquez sur "Save"</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 3: Redémarrer l'application</CardTitle>
            <CardDescription>
              Le serveur doit redémarrer pour prendre en compte le nouveau secret
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Après avoir configuré le secret, le serveur redémarrera automatiquement.
              Vous pourrez alors lancer le seed pour créer les données de test.
            </p>
            <Button
              onClick={() => fetch('/api/seed', { method: 'POST' }).then(r => r.json()).then(console.log)}
              data-testid="button-run-seed"
            >
              Lancer le Seed
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Format de connexion requis</CardTitle>
            <CardDescription>Pour référence technique</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                {requiredConnectionString}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(requiredConnectionString)}
                data-testid="button-copy-connection-string"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
