import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, User, Lock, Monitor } from "lucide-react";

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
          // Wait a bit to ensure Supabase session is established
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const response = await apiRequest("GET", "/api/me");
          const userData = await response.json();
          localStorage.setItem("demo_account_id", userData.accountId);
          localStorage.setItem("demo_user_id", userData.userId);
          
          toast({
            title: "Connexion réussie",
            description: "Bienvenue sur Planbase !",
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
                  placeholder="floflow87@planbase.com"
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

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-16 h-16 bg-yellow-400 rounded-full opacity-80 animate-pulse" />
        <div className="absolute bottom-32 left-20 w-12 h-12 bg-cyan-400 rounded-full opacity-80 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 text-center text-white max-w-lg">
          <h2 className="text-5xl font-bold mb-4">PlanBase</h2>
          <p className="text-xl text-violet-100 mb-12">
            Découvrez une nouvelle façon de travailler
          </p>
          
          {/* Computer illustration placeholder */}
          <div className="relative">
            <div className="bg-gradient-to-b from-purple-800/50 to-purple-900/50 rounded-2xl p-8 backdrop-blur-sm border border-white/20">
              <Monitor className="w-48 h-48 mx-auto text-white/90 mb-4" />
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
