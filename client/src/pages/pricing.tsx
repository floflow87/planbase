import { useState } from "react";
import { Check, Crown, Zap, ArrowRight, Rocket, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useBilling, type Plan } from "@/hooks/useBilling";
import { useLocation } from "wouter";

const FREELANCE_FEATURES = [
  "CRM & pipeline client",
  "Gestion de projets",
  "Tâches & Kanban",
  "Notes & documents",
  "Boîte mail Gmail intégrée",
  "Google Calendar",
  "Timeline client",
  "Fichiers & stockage",
];

const AGENCY_EXTRAS = [
  "Multi-utilisateurs & rôles",
  "Templates email",
  "Trésorerie & cash flow",
  "Rentabilité & finance",
];

export default function Pricing() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const { billing, startCheckout, isCheckingOut, hasNoTrial, isTrialing, isTrialExpired, trialDaysLeft, startTrial, isStartingTrial } = useBilling();
  const [, setLocation] = useLocation();

  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [consent, setConsent] = useState(false);

  const freelancePrice = interval === "monthly" ? 19 : 12;
  const agencyPrice = interval === "monthly" ? 39 : 29;
  const saving = interval === "yearly";

  const currentPlan = billing?.plan === "starter" ? "freelance" : (billing?.plan ?? null);
  const isActive = billing?.subscriptionStatus === "active";

  function handleStartTrial() {
    startTrial(undefined, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  }

  function handleSelectPlan(plan: "freelance" | "agency") {
    setConsent(false);
    setCheckoutPlan(plan);
  }

  function handleConfirmCheckout() {
    if (!consent || !checkoutPlan) return;
    startCheckout({ plan: checkoutPlan, interval });
    setCheckoutPlan(null);
  }

  const pendingPlanLabel = checkoutPlan === "agency" ? "Agence" : "Freelance";
  const pendingPrice = checkoutPlan === "agency"
    ? (interval === "monthly" ? 39 : 29)
    : (interval === "monthly" ? 19 : 12);

  return (
    <div className="h-full overflow-y-auto bg-background" data-testid="page-pricing">
      <div className="flex flex-col items-center py-12 px-4">

        {/* ─── Trial start hero (for new accounts with no trial) ─── */}
        {hasNoTrial && (
          <div className="w-full max-w-2xl mb-10">
            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-900/10" data-testid="card-start-trial">
              <CardContent className="pt-8 pb-8 text-center space-y-5">
                <div className="flex justify-center">
                  <div className="rounded-full bg-violet-100 dark:bg-violet-900/40 p-4">
                    <Rocket className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Démarrez votre essai gratuit</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Accédez à <strong>tous les modules</strong> de PlanBase pendant 7 jours, sans carte bancaire.
                    Choisissez ensuite le plan qui vous convient.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Tous les modules inclus</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Aucune carte requise</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> 7 jours complets</span>
                </div>
                <Button
                  size="lg"
                  className="bg-violet-600 hover:bg-violet-700 text-white px-10"
                  onClick={handleStartTrial}
                  disabled={isStartingTrial}
                  data-testid="button-start-trial"
                >
                  {isStartingTrial ? "Activation en cours..." : "Démarrer mon essai gratuit 7 jours — Gratuit"}
                  {!isStartingTrial && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Vous pourrez souscrire à un plan payant ci-dessous à tout moment.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Trial active banner ─── */}
        {isTrialing && trialDaysLeft !== null && (
          <div className="w-full max-w-2xl mb-8">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md px-5 py-4 flex items-center gap-3" data-testid="banner-trial-active-pricing">
              <Clock className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                  Essai gratuit en cours — <strong>{trialDaysLeft} jour{trialDaysLeft !== 1 ? "s" : ""}</strong> restant{trialDaysLeft !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  Souscrivez ci-dessous pour continuer après la fin de l'essai.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Trial expired banner ─── */}
        {isTrialExpired && (
          <div className="w-full max-w-2xl mb-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-5 py-4 flex items-center gap-3" data-testid="banner-trial-expired-pricing">
              <Lock className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Votre période d'essai est terminée
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Choisissez un plan ci-dessous pour retrouver l'accès à toutes vos données.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8 space-y-2 max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight">
            {hasNoTrial ? "Ou souscrivez directement" : "Choisissez votre plan"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hasNoTrial
              ? "Commencez avec un plan payant et profitez de 7 jours d'essai inclus."
              : "Tous les plans incluent un accès complet à la plateforme."}
          </p>
        </div>

        {/* Toggle mensuel / annuel */}
        <div className="flex items-center gap-3 mb-8 bg-muted rounded-lg p-1" data-testid="billing-interval-toggle">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${interval === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            onClick={() => setInterval("monthly")}
            data-testid="button-interval-monthly"
          >
            Mensuel
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${interval === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            onClick={() => setInterval("yearly")}
            data-testid="button-interval-yearly"
          >
            Annuel
            <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-active-elevate">
              -37%
            </Badge>
          </button>
        </div>

        {/* Plan cards */}
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
          {/* Freelance */}
          <Card className="flex-1" data-testid="plan-card-freelance">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-500" />
                  <span className="font-semibold text-base">Freelance</span>
                </div>
                {currentPlan === "freelance" && isActive && (
                  <Badge variant="secondary" className="text-[10px]">Plan actuel</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Pour les indépendants</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-bold">{freelancePrice}€</span>
                <span className="text-muted-foreground text-sm">/mois</span>
              </div>
              {saving && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Facturé {freelancePrice * 12}€/an · économisez {(19 - freelancePrice) * 12}€
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {FREELANCE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSelectPlan("freelance")}
                disabled={isCheckingOut || (currentPlan === "freelance" && isActive)}
                data-testid="button-select-freelance"
              >
                {currentPlan === "freelance" && isActive
                  ? "Plan actuel"
                  : isTrialing
                  ? "Souscrire — Freelance"
                  : "Commencer"}
              </Button>
            </CardContent>
          </Card>

          {/* Agency */}
          <Card className="flex-1 border-violet-200 dark:border-violet-800 relative" data-testid="plan-card-agency">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-violet-600 text-white text-[10px] px-3 shadow-sm">Populaire</Badge>
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-violet-500" />
                  <span className="font-semibold text-base">Agence</span>
                </div>
                {currentPlan === "agency" && isActive && (
                  <Badge variant="secondary" className="text-[10px]">Plan actuel</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Pour les équipes & pilotage avancé</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-bold">{agencyPrice}€</span>
                <span className="text-muted-foreground text-sm">/mois</span>
              </div>
              {saving && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Facturé {agencyPrice * 12}€/an · économisez {(39 - agencyPrice) * 12}€
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {FREELANCE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
                <li className="border-t border-border/50 pt-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">En plus</span>
                </li>
                {AGENCY_EXTRAS.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm font-medium">
                    <Crown className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={() => handleSelectPlan("agency")}
                disabled={isCheckingOut || (currentPlan === "agency" && isActive)}
                data-testid="button-select-agency"
              >
                {currentPlan === "agency" && isActive ? (
                  "Plan actuel"
                ) : (
                  <>
                    {isTrialing ? "Souscrire — Agence" : "Commencer"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-muted-foreground text-center max-w-sm">
          Annulation à tout moment depuis vos paramètres. Aucun engagement sur la durée.
        </p>

        {/* Back link — only show if not in "no trial" forced state */}
        {!hasNoTrial && (
          <button
            className="mt-4 text-xs text-muted-foreground underline"
            onClick={() => setLocation("/settings?tab=subscription")}
            data-testid="link-back-billing"
          >
            Retour à la gestion d'abonnement
          </button>
        )}
      </div>

      {/* ─── Consent Dialog ─── */}
      <Dialog open={!!checkoutPlan} onOpenChange={(open) => !open && setCheckoutPlan(null)}>
        <DialogContent data-testid="dialog-checkout-consent">
          <DialogHeader>
            <DialogTitle>Confirmer votre abonnement</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de souscrire au plan <strong>{pendingPlanLabel}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-md p-4 space-y-1">
              <p className="text-sm font-medium">Récapitulatif</p>
              <p className="text-sm text-muted-foreground">Plan : <strong>{pendingPlanLabel}</strong></p>
              <p className="text-sm text-muted-foreground">
                Facturation : <strong>{interval === "monthly" ? "mensuelle" : "annuelle"}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Montant : <strong>{pendingPrice}€/{interval === "monthly" ? "mois" : "mois (annuel)"}</strong>
              </p>
            </div>

            <div className="flex items-start gap-3" data-testid="consent-checkbox-area">
              <Checkbox
                id="consent-recurring"
                checked={consent}
                onCheckedChange={(v) => setConsent(!!v)}
                data-testid="checkbox-consent-recurring"
              />
              <Label htmlFor="consent-recurring" className="text-sm leading-relaxed cursor-pointer">
                J'accepte d'être prélevé{interval === "monthly" ? " chaque mois" : " chaque année"} du montant indiqué ci-dessus.
                Je peux annuler à tout moment depuis mes paramètres d'abonnement.
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCheckoutPlan(null)} data-testid="button-cancel-consent">
              Annuler
            </Button>
            <Button
              onClick={handleConfirmCheckout}
              disabled={!consent || isCheckingOut}
              data-testid="button-confirm-checkout"
            >
              {isCheckingOut ? "Redirection..." : "Souscrire et payer"}
              {!isCheckingOut && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
