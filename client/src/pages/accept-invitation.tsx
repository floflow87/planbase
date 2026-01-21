import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Loader2, User, Lock, Mail, ArrowLeft, Shield, CheckCircle } from "lucide-react";
import mockupImage from "@assets/PlanBase mockup web_1762441884022.png";
import planbaseLogo from "@assets/planbase-logo.png";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvitationInfo {
  email: string;
  role: string;
  accountName: string;
  inviterName: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  member: "Membre",
  guest: "Invité",
};

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

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const token = new URLSearchParams(searchString).get("token");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Lien d'invitation invalide");
      setValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/invitations/validate?token=${token}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Invitation invalide ou expirée");
        }
        const data = await response.json();
        setInvitationInfo(data);
      } catch (err: any) {
        setError(err.message || "Impossible de valider l'invitation");
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationInfo || !token) return;
    
    setLoading(true);

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

    try {
      const response = await apiRequest("/api/invitations/accept", "POST", {
        token,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'inscription");
      }

      toast({
        title: "Inscription réussie",
        description: "Vous pouvez maintenant vous connecter.",
        variant: "success",
      });

      setLocation("/login");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Une erreur s'est produite",
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Invitation invalide</h1>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </div>
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

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="md:hidden flex flex-col items-center -mt-[27px] mb-8">
            <img src={planbaseLogo} alt="PlanBase" className="w-14 h-14 rounded-xl shadow-lg mb-[22px]" />
            <h2 className="text-2xl font-bold italic bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 bg-clip-text text-transparent">
              PlanBase
            </h2>
          </div>

          <div className="text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Rejoindre {invitationInfo?.accountName}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Vous avez été invité à rejoindre cette organisation
            </p>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Invitation de {invitationInfo?.inviterName}</p>
                  <p className="text-xs text-muted-foreground">{invitationInfo?.accountName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Votre rôle :</span>
                <Badge variant="secondary" className="text-xs">{ROLE_LABELS[invitationInfo?.role || "member"]}</Badge>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={invitationInfo?.email || ""}
                  disabled
                  className="pl-10 h-12 bg-muted"
                  data-testid="input-email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cette adresse email est liée à votre invitation
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-foreground">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="pl-10 h-12"
                    data-testid="input-firstname"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Nom</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Dupont"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="h-12"
                  data-testid="input-lastname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Votre mot de passe"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="pl-10 h-12"
                  data-testid="input-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="pl-10 h-12"
                  data-testid="input-confirm-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium"
              disabled={loading}
              data-testid="button-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Création du compte...
                </>
              ) : (
                "Créer mon compte et rejoindre"
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Vous avez déjà un compte ?{" "}
              <Link href="/login">
                <button className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium">
                  Se connecter
                </button>
              </Link>
            </p>
          </div>
        </div>
      </div>

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
