import { useState } from "react";
import { Check, Crown, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useBilling } from "@/hooks/useBilling";
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
  const { billing, startCheckout, isCheckingOut } = useBilling();
  const [, setLocation] = useLocation();

  const freelancePrice = interval === "monthly" ? 19 : 12;
  const agencyPrice = interval === "monthly" ? 39 : 29;
  const saving = interval === "yearly";

  const currentPlan = billing?.plan === "starter" ? "freelance" : (billing?.plan ?? null);

  function handleSelect(plan: "freelance" | "agency") {
    startCheckout({ plan, interval });
  }

  return (
    <div className="h-full overflow-y-auto bg-background" data-testid="page-pricing"><div className="flex flex-col items-center py-16 px-4">
      {/* Header */}
      <div className="text-center mb-10 space-y-3 max-w-xl">
        <Badge variant="secondary" className="text-[10px] px-2">Tarification simple</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Choisissez votre plan</h1>
        <p className="text-muted-foreground text-sm">
          Essai gratuit de 7 jours sur tous les plans. Aucune carte bancaire requise pour démarrer.
        </p>
      </div>

      {/* Toggle mensuel / annuel */}
      <div className="flex items-center gap-3 mb-10 bg-muted rounded-lg p-1" data-testid="billing-interval-toggle">
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
              {currentPlan === "freelance" && billing?.subscriptionStatus === "active" && (
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
              onClick={() => handleSelect("freelance")}
              disabled={isCheckingOut || (currentPlan === "freelance" && billing?.subscriptionStatus === "active")}
              data-testid="button-select-freelance"
            >
              {currentPlan === "freelance" && billing?.subscriptionStatus === "active"
                ? "Plan actuel"
                : "Commencer l'essai gratuit"}
            </Button>
          </CardContent>
        </Card>

        {/* Agency */}
        <Card className="flex-1 border-violet-200 dark:border-violet-800 relative" data-testid="plan-card-agency">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-violet-600 text-white text-[10px] px-3 shadow-sm">Recommandé</Badge>
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-violet-500" />
                <span className="font-semibold text-base">Agence</span>
              </div>
              {currentPlan === "agency" && billing?.subscriptionStatus === "active" && (
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
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  En plus
                </span>
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
              onClick={() => handleSelect("agency")}
              disabled={isCheckingOut || (currentPlan === "agency" && billing?.subscriptionStatus === "active")}
              data-testid="button-select-agency"
            >
              {currentPlan === "agency" && billing?.subscriptionStatus === "active" ? (
                "Plan actuel"
              ) : (
                <>
                  Commencer l'essai gratuit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer note */}
      <p className="mt-8 text-xs text-muted-foreground text-center max-w-sm">
        7 jours d'essai gratuit sans carte bancaire. Annulation à tout moment.
      </p>

      {/* Back link */}
      <button
        className="mt-4 text-xs text-muted-foreground underline"
        onClick={() => setLocation("/settings?tab=billing")}
        data-testid="link-back-billing"
      >
        Retour à la gestion d'abonnement
      </button>
    </div></div>
  );
}
