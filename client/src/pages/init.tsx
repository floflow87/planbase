import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Init() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");

  const initializeData = async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to initialize data");
      }

      const data = await response.json();
      
      // Store account ID in localStorage for demo purposes
      localStorage.setItem("demo_account_id", data.accountId);
      localStorage.setItem("demo_user_id", data.userId);

      setStatus("success");
      
      // Redirect to dashboard after 1 second
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "An error occurred");
    }
  };

  useEffect(() => {
    // Auto-redirect if already initialized
    const accountId = localStorage.getItem("demo_account_id");
    if (accountId) {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-heading text-center">
            Bienvenue sur Planbase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            <p>Plateforme SaaS modulaire pour freelancers et startups</p>
          </div>

          {status === "idle" && (
            <Button
              onClick={initializeData}
              className="w-full"
              size="lg"
              data-testid="button-initialize"
            >
              Initialiser la démo
            </Button>
          )}

          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Initialisation en cours...</span>
            </div>
          )}

          {status === "success" && (
            <div className="text-center text-green-600 font-medium">
              ✓ Données initialisées avec succès !
              <br />
              <span className="text-sm text-muted-foreground">Redirection...</span>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="text-center text-red-600 font-medium">
                ✗ Erreur: {error}
              </div>
              <Button
                onClick={initializeData}
                variant="outline"
                className="w-full"
              >
                Réessayer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
