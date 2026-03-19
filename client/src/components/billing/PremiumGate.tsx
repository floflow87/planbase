import { Crown, Lock, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useBilling, type PremiumFeature } from "@/hooks/useBilling";

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

export function PremiumGate({ feature, children }: PremiumGateProps) {
  const { hasFeature, billing, isLoading, startCheckout, isCheckingOut } = useBilling();
  const [, setLocation] = useLocation();

  if (isLoading) return <>{children}</>;

  // Active agency plan → show content
  if (hasFeature(feature)) return <>{children}</>;

  const isExpiredTrial = billing?.subscriptionStatus === null || billing?.subscriptionStatus === "canceled";
  const isFreelance = (billing?.plan === "freelance" || billing?.plan === "starter") && billing?.subscriptionStatus !== null;

  return (
    <div className="flex items-start justify-center min-h-[400px] p-8" data-testid={`paywall-${feature}`}>
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-5">
            <Crown className="w-8 h-8 text-violet-600 dark:text-violet-400" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Plan Agence</Badge>
          <h2 className="text-xl font-semibold">
            {FEATURE_LABELS[feature]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {FEATURE_DESCRIPTIONS[feature]}
          </p>
        </div>

        {/* What they need */}
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

        {/* CTAs */}
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

// ─── Trial / expired banner ──────────────────────────────────────────────────
export function TrialBanner() {
  const { billing, trialDaysLeft, isTrialing, needsUpgrade, startCheckout, isCheckingOut } = useBilling();
  const [, setLocation] = useLocation();

  if (!isTrialing && !needsUpgrade) return null;
  if (billing?.subscriptionStatus === "active") return null;

  if (needsUpgrade && billing?.subscriptionStatus !== "trialing") {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3 flex items-center justify-between gap-4 mb-4"
        data-testid="banner-trial-expired"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            Votre période d'essai est terminée — choisissez un plan pour continuer.
          </span>
        </div>
        <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-choose-plan">
          Choisir un plan
        </Button>
      </div>
    );
  }

  if (isTrialing && trialDaysLeft !== null) {
    return (
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md px-4 py-3 flex items-center justify-between gap-4 mb-4"
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

  return null;
}
