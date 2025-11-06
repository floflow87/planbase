import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Loader2, User, Lock, Monitor } from "lucide-react";

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
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Connexion</h1>
            <p className="text-gray-600">Accédez à votre compte</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Nom d'utilisateur
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre-email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="input-email"
                  className="pl-10 h-12 border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="input-password"
                  className="pl-10 h-12 border-gray-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
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
            <p className="text-sm text-gray-600">
              Je n'ai pas encore de compte :{" "}
              <button className="text-violet-600 hover:text-violet-700 font-medium">
                S'inscrire
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 items-center justify-center p-12">
        <h2 className="text-7xl font-bold text-white text-center tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          PlanBase
        </h2>
      </div>
    </div>
  );
}
