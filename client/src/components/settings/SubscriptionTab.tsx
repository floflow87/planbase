import { CreditCard, Crown, Calendar, Zap, AlertTriangle, CheckCircle, Clock, XCircle, ArrowRight, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useBilling } from "@/hooks/useBilling";
import { useLocation } from "wouter";

// ─── Status display helpers ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">Aucun plan</Badge>;
  const map: Record<string, { label: string; icon: any; variant: "secondary" | "destructive" | "default" | "outline" }> = {
    active:             { label: "Actif", icon: CheckCircle, variant: "default" },
    trialing:           { label: "Essai gratuit", icon: Clock, variant: "secondary" },
    past_due:           { label: "Paiement en retard", icon: AlertTriangle, variant: "destructive" },
    canceled:           { label: "Annulé", icon: XCircle, variant: "destructive" },
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
  const { billing, isLoading, isActive, isTrialing, trialDaysLeft, startCheckout, isCheckingOut, openPortal, isOpeningPortal } = useBilling();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const plan = billing?.plan ?? null;
  const status = billing?.subscriptionStatus ?? null;
  const noSubscription = !status || status === "canceled";

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

      {/* Trial banner */}
      {isTrialing && trialDaysLeft !== null && (
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10" data-testid="card-trial-banner">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              <span className="text-sm text-violet-700 dark:text-violet-300">
                <strong>{trialDaysLeft} jour{trialDaysLeft !== 1 ? "s" : ""}</strong> restant{trialDaysLeft !== 1 ? "s" : ""} dans votre essai gratuit.
              </span>
            </div>
            <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-trial-choose-plan">
              Choisir un plan <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expired / no subscription */}
      {noSubscription && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10" data-testid="card-no-subscription">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-orange-700 dark:text-orange-300">
                Aucun abonnement actif. Choisissez un plan pour continuer.
              </span>
            </div>
            <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-no-sub-choose-plan">
              Voir les plans <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
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
