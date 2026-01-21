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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Accès complet à toutes les fonctionnalités et paramètres",
  member: "Accès aux projets et modules assignés",
  guest: "Accès en lecture seule aux éléments partagés",
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

      const data = await response.json();

      toast({
        title: "Inscription réussie",
        description: "Connexion en cours...",
        variant: "success",
      });

      const hasSession = await waitForSession();
      if (hasSession) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setLocation("/");
      } else {
        setLocation("/login");
      }
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-1/2 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 lg:p-12 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          <Link href="/" className="inline-block mb-8">
            <img src={planbaseLogo} alt="PlanBase" className="h-8" />
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Rejoindre {invitationInfo?.accountName}</h1>
            <p className="text-muted-foreground">
              Vous avez été invité à rejoindre cette organisation
            </p>
          </div>

          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Invitation de {invitationInfo?.inviterName}</p>
                  <p className="text-sm text-muted-foreground">{invitationInfo?.accountName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Votre rôle :</span>
                <Badge variant="secondary">{ROLE_LABELS[invitationInfo?.role || "member"]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {ROLE_DESCRIPTIONS[invitationInfo?.role || "member"]}
              </p>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={invitationInfo?.email || ""}
                  disabled
                  className="pl-10 bg-muted"
                  data-testid="input-email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cette adresse email est liée à votre invitation
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="pl-10"
                    data-testid="input-firstname"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Dupont"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  data-testid="input-lastname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="pl-10"
                  data-testid="input-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="pl-10"
                  data-testid="input-confirm-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création du compte...
                </>
              ) : (
                "Créer mon compte et rejoindre"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Vous avez déjà un compte ?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 items-center justify-center p-12">
        <div className="max-w-lg">
          <img
            src={mockupImage}
            alt="PlanBase Interface"
            className="w-full rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}
