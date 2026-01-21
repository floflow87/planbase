import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Loader2, User, Lock, Monitor, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import mockupImage from "@assets/PlanBase mockup web_1762441884022.png";
import planbaseLogo from "@assets/planbase-logo.png";

async function waitForSession(maxAttempts = 10, delayMs = 300): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRevokedMessage, setShowRevokedMessage] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("revoked") === "true") {
      setShowRevokedMessage(true);
    }
  }, [searchString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear cache BEFORE login to prevent old data flash
      queryClient.clear();
      
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur d'authentification",
          description: error.message || "Email ou mot de passe incorrect",
        });
      } else {
        // Fetch user data to get accountId
        try {
          // Wait for Supabase session to be fully established (with retries)
          const sessionReady = await waitForSession();
          
          if (!sessionReady) {
            throw new Error("Session timeout - please try logging in again");
          }
          
          const response = await apiRequest("/api/me", "GET");
          const userData = await response.json();
          localStorage.setItem("demo_account_id", userData.accountId);
          localStorage.setItem("demo_user_id", userData.id);
          
          toast({
            title: "Connexion réussie",
            description: "Bienvenue sur Planbase !",
            variant: "success",
          });
          setLocation("/");
        } catch (err) {
          console.error("Failed to fetch user data:", err);
          // Don't redirect if we can't get user data - show error instead
          toast({
            variant: "destructive",
            title: "Erreur de chargement",
            description: "Impossible de charger votre profil. Veuillez réessayer.",
          });
          // Log out the user to reset state
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo & App Name - visible only on mobile */}
          <div className="md:hidden flex flex-col items-center -mt-[27px] mb-8">
            <img src={planbaseLogo} alt="PlanBase" className="w-14 h-14 rounded-xl shadow-lg mb-[22px]" />
            <h2 className="text-2xl font-bold italic bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 bg-clip-text text-transparent">
              PlanBase
            </h2>
          </div>
          
          <div className="text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Connexion</h1>
            <p className="text-sm md:text-base text-muted-foreground">Accédez à votre compte</p>
          </div>

          {showRevokedMessage && (
            <Alert variant="destructive" data-testid="alert-access-revoked">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Accès révoqué</AlertTitle>
              <AlertDescription>
                Votre accès à cette organisation a été révoqué par un administrateur.
                Veuillez contacter l'administrateur si vous pensez qu'il s'agit d'une erreur.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Nom d'utilisateur
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre-email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="input-email"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="input-password"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Je n'ai pas encore de compte :{" "}
              <Link href="/signup">
                <button className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium" data-testid="link-signup">
                  S'inscrire
                </button>
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center">
            <h2 className="text-7xl font-bold text-white text-center tracking-tight" style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif', fontStyle: 'italic' }}>
              PlanBase
            </h2>
            <p className="text-sm text-white/80 mt-2 font-light italic">Travaillez autrement</p>
          </div>
          <img 
            src={mockupImage} 
            alt="PlanBase Preview" 
            className="max-w-2xl w-full"
          />
        </div>
      </div>
    </div>
  );
}
