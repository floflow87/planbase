import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Loader2, User, Lock, Mail, Building2, ArrowLeft } from "lucide-react";
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

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    accountName: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: "Les mots de passe ne correspondent pas",
      });
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: "Le mot de passe doit contenir au moins 6 caractères",
      });
      setLoading(false);
      return;
    }

    if (!formData.accountName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: "Le nom du compte est requis",
      });
      setLoading(false);
      return;
    }

    try {
      // Call backend signup endpoint
      const response = await apiRequest("/api/auth/signup", "POST", {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        accountName: formData.accountName,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'inscription");
      }

      const data = await response.json();

      toast({
        title: "Inscription réussie",
        description: "Connexion en cours...",
        variant: "success",
      });

      // Auto sign-in the user after successful registration
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        toast({
          variant: "destructive",
          title: "Erreur de connexion",
          description: "Compte créé mais impossible de se connecter automatiquement. Veuillez vous connecter manuellement.",
        });
        setLocation("/login");
        return;
      }

      // Wait for Supabase session to be fully established
      const sessionReady = await waitForSession();
      
      if (!sessionReady) {
        toast({
          variant: "destructive",
          title: "Session timeout",
          description: "Veuillez vous connecter",
        });
        setLocation("/login");
        return;
      }

      // Store account and user data
      localStorage.setItem("demo_account_id", data.accountId);
      localStorage.setItem("demo_user_id", data.userId);

      // Invalidate onboarding query to trigger fresh fetch for new user tour
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });

      toast({
        title: "Bienvenue !",
        description: "Votre compte a été créé avec succès",
        variant: "success",
      });

      // Redirect to home
      setLocation("/");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue lors de l'inscription",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Signup Form */}
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
            <Link href="/login">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="link-back-to-login">
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Créer un compte</h1>
            <p className="text-sm md:text-base text-muted-foreground">Commencez votre essai gratuit</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Name */}
            <div className="space-y-2">
              <Label htmlFor="accountName" className="text-sm font-medium text-foreground">
                Nom du compte <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="accountName"
                  name="accountName"
                  type="text"
                  placeholder="Mon entreprise"
                  value={formData.accountName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  data-testid="input-account-name"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                  Prénom
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="Jean"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="input-first-name"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                  Nom
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Dupont"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="input-last-name"
                  className="h-12"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre-email@exemple.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  data-testid="input-email"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  data-testid="input-password"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirmez votre mot de passe"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  data-testid="input-confirm-password"
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium"
              disabled={loading}
              data-testid="button-signup"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Création du compte...
                </>
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Vous avez déjà un compte ?{" "}
              <Link href="/login">
                <button className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium" data-testid="link-login">
                  Se connecter
                </button>
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-8">
          <h2 className="text-7xl font-bold text-white text-center tracking-tight" style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif', fontStyle: 'italic' }}>
            PlanBase
          </h2>
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
