import { useState } from "react";
import { CreditCard, Crown, Calendar, Zap, AlertTriangle, CheckCircle, Clock, XCircle, ArrowRight, HelpCircle, RefreshCw, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useBilling, type Plan } from "@/hooks/useBilling";
import { useLocation } from "wouter";

// ─── Circular Trial Progress ─────────────────────────────────────────────────
const TRIAL_DAYS = 7;

function TrialCircularProgress({ daysLeft, isExpired }: { daysLeft: number; isExpired: boolean }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = isExpired ? 0 : Math.min(1, daysLeft / TRIAL_DAYS);
  const dashOffset = circumference * (1 - progress);

  const color = isExpired
    ? "#ef4444"
    : daysLeft <= 2
    ? "#f97316"
    : daysLeft <= 4
    ? "#eab308"
    : "#10b981";

  return (
    <div className="relative w-28 h-28 shrink-0" data-testid="trial-progress-circle">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isExpired ? (
          <Lock className="w-6 h-6 text-red-500" />
        ) : (
          <>
            <span className="text-2xl font-bold leading-none" style={{ color }} data-testid="text-trial-days-left">{daysLeft}</span>
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {daysLeft <= 1 ? "jour" : "jours"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Status display helpers ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">Aucun plan</Badge>;
  const map: Record<string, { label: string; icon: any; variant: "secondary" | "destructive" | "default" | "outline" }> = {
    active:             { label: "Actif", icon: CheckCircle, variant: "default" },
    trialing:           { label: "Essai gratuit", icon: Clock, variant: "secondary" },
    past_due:           { label: "Paiement en retard", icon: AlertTriangle, variant: "destructive" },
    canceled:           { label: "Annulé", icon: XCircle, variant: "destructive" },
    expired:            { label: "Essai expiré", icon: XCircle, variant: "destructive" },
    incomplete:         { label: "Incomplet", icon: AlertTriangle, variant: "destructive" },
    incomplete_expired: { label: "Expiré", icon: XCircle, variant: "destructive" },
    unpaid:             { label: "Impayé", icon: AlertTriangle, variant: "destructive" },
  };
  const s = map[status] ?? { label: status, icon: HelpCircle, variant: "secondary" as const };
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className="flex items-center gap-1">
      <Icon className="w-3 h-3" />
      {s.label}
    </Badge>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  const display = plan === "agency" ? "Agence" : plan === "freelance" ? "Freelance" : plan === "starter" ? "Starter" : "—";
  const isAgency = plan === "agency";
  return (
    <Badge variant={isAgency ? "default" : "secondary"} className={isAgency ? "bg-violet-600 text-white" : ""}>
      {isAgency && <Crown className="w-3 h-3 mr-1" />}
      {display}
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const FAQ_ITEMS = [
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "Oui, vous pouvez annuler votre abonnement à tout moment depuis le portail de gestion. Votre accès reste actif jusqu'à la fin de la période en cours.",
  },
  {
    question: "L'essai gratuit est-il vraiment gratuit ?",
    answer: "Oui, 7 jours d'essai complet sans carte bancaire requise. Vous pourrez saisir vos informations de paiement à la fin de la période d'essai.",
  },
  {
    question: "Que se passe-t-il si je passe du plan Agence au plan Freelance ?",
    answer: "Vous conservez l'accès aux fonctionnalités Agence jusqu'à la fin de votre période en cours, puis vous passez automatiquement aux fonctionnalités Freelance.",
  },
  {
    question: "Comment changer mon moyen de paiement ?",
    answer: "Accédez au portail de gestion Stripe via le bouton \"Gérer l'abonnement\" pour modifier votre carte ou tout autre paramètre de facturation.",
  },
];

export function SubscriptionTab() {
  const { billing, isLoading, isActive, isAdmin, isTrialing, isTrialExpired, hasNoTrial, billingState, trialDaysLeft, startCheckout, isCheckingOut, openPortal, isOpeningPortal } = useBilling();
  const [, setLocation] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("agency");
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">("monthly");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="space-y-6" data-testid="subscription-tab">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-violet-500" />
            Abonnement
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Statut de votre accès à Planbase.</p>
        </div>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 bg-violet-100 dark:bg-violet-900/30 rounded-md p-2">
                <Crown className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Compte administrateur</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ce compte bénéficie d'un accès complet au plan Agence sans abonnement requis.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="default" className="bg-violet-600 text-white">
                    <Crown className="w-3 h-3 mr-1" /> Agence
                  </Badge>
                  <Badge variant="default" className="bg-green-600 text-white">
                    <CheckCircle className="w-3 h-3 mr-1" /> Accès complet
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = billing?.plan ?? null;
  const status = billing?.subscriptionStatus ?? null;
  // noSubscription: no active paid subscription (trial, no_trial, expired, canceled are all "no subscription")
  const noSubscription = billingState !== "active" && billingState !== "past_due";
  const showTrialCard = isTrialing || isTrialExpired;

  return (
    <div className="space-y-6" data-testid="subscription-tab">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-subscription-title">
          <CreditCard className="w-5 h-5" />
          Abonnement
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez votre plan et vos informations de facturation.
        </p>
      </div>

      {/* No trial yet — start trial CTA */}
      {hasNoTrial && (
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-900/10" data-testid="card-no-trial">
          <CardContent className="pt-5 pb-5">
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-foreground">Démarrez votre essai gratuit</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Accédez à tous les modules de PlanBase pendant 7 jours, sans carte bancaire.
                </p>
              </div>
              <Button onClick={() => setLocation("/pricing")} data-testid="button-start-trial-from-settings">
                <Crown className="w-4 h-4 mr-2" />
                Démarrer l'essai gratuit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial progress card */}
      {showTrialCard && (
        <Card
          className={isTrialExpired
            ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10"
            : "border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-900/10"}
          data-testid="card-trial-progress"
        >
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-6 flex-wrap">
              <TrialCircularProgress
                daysLeft={trialDaysLeft ?? 0}
                isExpired={isTrialExpired}
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="font-semibold text-foreground" data-testid="text-trial-status-label">
                    {isTrialExpired ? "Essai gratuit expiré" : "Essai gratuit en cours"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isTrialExpired
                      ? "Votre période d'essai de 7 jours est terminée. Choisissez un plan pour retrouver l'accès complet."
                      : `Il vous reste ${trialDaysLeft} jour${(trialDaysLeft ?? 0) !== 1 ? "s" : ""} sur les 7 jours d'essai gratuit.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => startCheckout({ plan: "freelance", interval: "monthly" })}
                    disabled={isCheckingOut}
                    data-testid="button-trial-freelance"
                  >
                    Freelance — 19€/mois
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startCheckout({ plan: "agency", interval: "monthly" })}
                    disabled={isCheckingOut}
                    data-testid="button-trial-agency"
                  >
                    <Crown className="w-3.5 h-3.5 mr-1.5" />
                    Agence — 39€/mois
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan overview */}
      <Card data-testid="card-current-plan">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Plan actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <PlanBadge plan={plan} />
            <StatusBadge status={status} />
          </div>
          {billing?.billingInterval && (
            <p className="text-xs text-muted-foreground">
              Facturation {billing.billingInterval === "monthly" ? "mensuelle" : "annuelle"}
            </p>
          )}
          {billing?.currentPeriodEnd && isActive && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {billing.cancelAtPeriodEnd
                ? `Se termine le ${formatDate(billing.currentPeriodEnd)}`
                : `Renouvellement le ${formatDate(billing.currentPeriodEnd)}`}
            </div>
          )}
          {billing?.trialEndsAt && isTrialing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Essai jusqu'au {formatDate(billing.trialEndsAt)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col gap-2" data-testid="billing-actions">
        {noSubscription || !isActive ? (
          <Button
            className="w-full"
            onClick={() => setLocation("/pricing")}
            data-testid="button-choose-plan"
          >
            <Crown className="w-4 h-4 mr-2" />
            Choisir un plan
          </Button>
        ) : (
          <>
            {plan !== "agency" && (
              <Button
                className="w-full"
                onClick={() => startCheckout({ plan: "agency", interval: billing?.billingInterval ?? "monthly" })}
                disabled={isCheckingOut}
                data-testid="button-upgrade-agency"
              >
                <Crown className="w-4 h-4 mr-2" />
                Passer au plan Agence
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {billing?.stripeCustomerId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openPortal()}
                disabled={isOpeningPortal}
                data-testid="button-manage-subscription"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Gérer l'abonnement
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setLocation("/pricing")} data-testid="button-see-all-plans">
          Voir tous les plans
        </Button>
      </div>

      {/* ── Payment info card ── */}
      <Card data-testid="card-payment-info">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Informations de paiement
          </CardTitle>
          <CardDescription className="text-xs">
            {isActive
              ? "Gérez votre moyen de paiement et votre facturation via le portail Stripe."
              : "Choisissez un plan et renseignez vos informations de paiement pour débloquer les modules."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isActive && billing?.stripeCustomerId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Moyen de paiement enregistré — facturation{" "}
                {billing.billingInterval === "yearly" ? "annuelle" : "mensuelle"}.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openPortal()}
                disabled={isOpeningPortal}
                data-testid="button-update-payment"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isOpeningPortal ? "Ouverture…" : "Mettre à jour le moyen de paiement"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Billing interval toggle */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Fréquence de facturation</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedInterval("monthly")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm border transition-colors ${selectedInterval === "monthly" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                    data-testid="btn-interval-monthly"
                  >
                    Mensuel
                  </button>
                  <button
                    onClick={() => setSelectedInterval("yearly")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm border transition-colors relative ${selectedInterval === "yearly" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                    data-testid="btn-interval-yearly"
                  >
                    Annuel
                    <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[9px] px-1 rounded-full">-20%</span>
                  </button>
                </div>
              </div>
              {/* Plan selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Plan</p>
                <div className="flex flex-col gap-2">
                  {([
                    { key: "freelance" as Plan, name: "Freelance", priceMonthly: 19, priceYearly: 15, desc: "CRM, projets, notes, Gmail" },
                    { key: "agency" as Plan, name: "Agence", priceMonthly: 39, priceYearly: 31, desc: "+ Trésorerie, finance, multi-users", premium: true },
                  ] as const).map((p) => {
                    const price = selectedInterval === "yearly" ? p.priceYearly : p.priceMonthly;
                    const isSelected = selectedPlan === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setSelectedPlan(p.key)}
                        className={`w-full text-left p-3 rounded-md border transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"}`}
                        data-testid={`btn-plan-${p.key}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {p.premium && <Crown className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                            <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{p.name}</span>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {price}€<span className="text-xs font-normal text-muted-foreground">/mois</span>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 pl-0">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Subscribe CTA */}
              <Button
                className="w-full"
                onClick={() => startCheckout({ plan: selectedPlan, interval: selectedInterval })}
                disabled={isCheckingOut}
                data-testid="button-subscribe-now"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {isCheckingOut ? "Redirection…" : `S'abonner — ${selectedPlan === "agency" ? (selectedInterval === "yearly" ? "31€" : "39€") : (selectedInterval === "yearly" ? "15€" : "19€")}/mois`}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Paiement sécurisé via Stripe · Annulation possible à tout moment
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans comparison quick view */}
      {!noSubscription && isActive && (
        <Card data-testid="card-plan-features">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fonctionnalités incluses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {["CRM & pipeline", "Projets & tâches", "Notes & documents", "Gmail intégré", "Google Calendar", "Fichiers"].map(f => (
                <li key={f} className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-3 h-3 text-cyan-500" /> {f}
                </li>
              ))}
              {plan === "agency" && (
                <>
                  {["Multi-utilisateurs", "Templates email", "Trésorerie", "Rentabilité & finance"].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <Crown className="w-3 h-3 text-violet-500" /> {f}
                    </li>
                  ))}
                </>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      <Card data-testid="card-faq">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Questions fréquentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-sm text-left" data-testid={`button-faq-${index}`}>
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground" data-testid={`text-faq-answer-${index}`}>
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
