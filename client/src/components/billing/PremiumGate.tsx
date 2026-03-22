import { Crown, Lock, ArrowRight, Zap } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useBilling, type PremiumFeature } from "@/hooks/useBilling";

// ─── Feature labels ───────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<PremiumFeature, string> = {
  treasury: "Trésorerie",
  finance: "Rentabilité & Finance",
  email_templates: "Templates Email",
  multi_users: "Multi-utilisateurs",
};

const FEATURE_DESCRIPTIONS: Record<PremiumFeature, string> = {
  treasury: "Suivez vos flux de trésorerie, scénarios et prévisions financières.",
  finance: "Analysez la rentabilité de vos projets et votre TJM.",
  email_templates: "Créez et réutilisez des modèles d'e-mails professionnels.",
  multi_users: "Invitez votre équipe et gérez les accès par rôle.",
};

interface PremiumGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
}

// ─── Premium Feature Gate (Agence-only features) ──────────────────────────────

export function PremiumGate({ feature, children }: PremiumGateProps) {
  const { hasFeature, billingState, startCheckout, isCheckingOut, isLoading } = useBilling();
  const [, setLocation] = useLocation();

  if (isLoading) return <>{children}</>;

  // Active agency plan or admin → show content
  if (hasFeature(feature)) return <>{children}</>;

  // Freelance active subscriber → show paywall (not a trial/access issue)
  const isActiveFreelance = (billingState === "active" || billingState === "past_due") && !hasFeature(feature);

  return (
    <div className="flex items-start justify-center min-h-[400px] p-8" data-testid={`paywall-${feature}`}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-5">
            <Crown className="w-8 h-8 text-violet-600 dark:text-violet-400" />
          </div>
        </div>

        <div className="space-y-2">
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Plan Agence</Badge>
          <h2 className="text-xl font-semibold">{FEATURE_LABELS[feature]}</h2>
          <p className="text-sm text-muted-foreground">{FEATURE_DESCRIPTIONS[feature]}</p>
        </div>

        <Card className="text-left">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Inclus dans le plan Agence
            </p>
            {["Multi-utilisateurs", "Templates email", "Trésorerie", "Rentabilité & finance"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Zap className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => startCheckout({ plan: "agency", interval: "monthly" })}
            disabled={isCheckingOut}
            data-testid="button-upgrade-agency"
          >
            <Crown className="w-4 h-4 mr-2" />
            Passer au plan Agence — 39€/mois
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/pricing")}
            data-testid="button-see-pricing"
          >
            Voir tous les plans
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Trial / Subscription Banner ──────────────────────────────────────────────
// Shown at the top of the main content area (App.tsx)

export function TrialBanner() {
  const { billingState, trialDaysLeft } = useBilling();
  const [, setLocation] = useLocation();

  // Never show banner for: loading, admin, no_trial (redirect handles it), active
  if (billingState === "loading" || billingState === "admin" || billingState === "no_trial" || billingState === "active") {
    return null;
  }

  if (billingState === "expired" || billingState === "canceled") {
    return (
      <div
        className="mx-4 mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3 flex items-center justify-between gap-4 shrink-0"
        data-testid="banner-trial-expired"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">
            {billingState === "canceled"
              ? "Votre abonnement est annulé — souscrivez à nouveau pour continuer."
              : "Votre période d'essai est terminée — choisissez un plan pour continuer."}
          </span>
        </div>
        <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-choose-plan">
          Choisir un plan
        </Button>
      </div>
    );
  }

  if (billingState === "trialing" && trialDaysLeft !== null) {
    return (
      <div
        className="mx-4 mt-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md px-4 py-3 flex items-center justify-between gap-4 shrink-0"
        data-testid="banner-trial-active"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500 shrink-0" />
          <span className="text-sm text-violet-700 dark:text-violet-300">
            <strong>{trialDaysLeft} jour{trialDaysLeft !== 1 ? "s" : ""}</strong> restant{trialDaysLeft !== 1 ? "s" : ""} dans votre essai gratuit.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-trial-upgrade">
          Choisir un plan
        </Button>
      </div>
    );
  }

  if (billingState === "past_due") {
    return (
      <div
        className="mx-4 mt-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md px-4 py-3 flex items-center justify-between gap-4 shrink-0"
        data-testid="banner-past-due"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-700 dark:text-orange-300">
            Paiement en retard — mettez à jour vos informations de paiement.
          </span>
        </div>
        <Button size="sm" onClick={() => setLocation("/settings?tab=subscription")} data-testid="button-update-payment">
          Mettre à jour
        </Button>
      </div>
    );
  }

  return null;
}

// ─── Global Access Gate ───────────────────────────────────────────────────────
// Wraps Router in App.tsx. Handles two cases:
//  1. no_trial → redirect to /pricing (to start trial or subscribe)
//  2. expired / canceled → show block screen (must subscribe to continue)

export function TrialExpiredGate({ children }: { children: React.ReactNode }) {
  const { billingState } = useBilling();
  const [location, setLocation] = useLocation();

  // Pages accessible regardless of billing state
  const freePaths = ["/pricing", "/settings", "/login", "/signup", "/accept-invitation"];
  const isFreePage = freePaths.some(
    (p) => location === p || location.startsWith(p + "/") || location.startsWith(p + "?")
  );

  // Redirect no_trial users to /pricing (via useEffect to avoid render-side-effect)
  useEffect(() => {
    if (billingState === "no_trial" && !isFreePage) {
      setLocation("/pricing");
    }
  }, [billingState, isFreePage, setLocation]);

  // While loading → optimistic, show content
  if (billingState === "loading") return <>{children}</>;

  // No trial started yet → show nothing until redirect fires
  if (billingState === "no_trial" && !isFreePage) return null;

  // Trial/subscription expired → block access with CTA
  if ((billingState === "expired" || billingState === "canceled") && !isFreePage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="trial-expired-gate">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-5">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {billingState === "canceled" ? "Abonnement annulé" : "Période d'essai terminée"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {billingState === "canceled"
                ? "Votre abonnement a été annulé. Souscrivez à nouveau pour accéder à toutes les fonctionnalités."
                : "Votre essai gratuit de 7 jours est arrivé à expiration. Choisissez un plan pour continuer."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => setLocation("/pricing")} data-testid="button-trial-gate-pricing">
              <Crown className="w-4 h-4 mr-2" />
              Voir les plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/settings?tab=subscription")} data-testid="button-trial-gate-settings">
              Gérer mon abonnement
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
