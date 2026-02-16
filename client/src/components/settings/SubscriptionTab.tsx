import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, Sparkles, HelpCircle, MoreHorizontal, CreditCard, Calendar, Info, X } from "lucide-react";
import { FAQ_ITEMS } from "@/data/subscriptionMock";
import { useConfigAll } from "@/hooks/useConfigAll";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StrapiFeature {
  key: string;
  label: string;
  order: number;
  included: boolean;
}

interface StrapiPlan {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  price_monthly: number | null;
  stripe_price_id: string | null;
  features: {
    ui?: { highlight?: boolean; cardVariant?: string };
    cta?: { type?: string; label?: string; disabled?: boolean };
    badge?: { text?: string; variant?: string };
    price?: { amount?: number; period?: string; currency?: string; formatted?: string };
    limits?: Record<string, number>;
    modules?: Record<string, boolean>;
    features?: StrapiFeature[];
    is_default?: boolean;
    sort_order?: number;
  };
}

export function SubscriptionTab() {
  const { toast } = useToast();
  const { data: configAll, isLoading: isConfigLoading } = useConfigAll();
  const isDev = import.meta.env.DEV;

  const strapiPlans: StrapiPlan[] = (configAll?.plans ?? [])
    .filter((p: StrapiPlan) => p.is_active)
    .sort((a: StrapiPlan, b: StrapiPlan) => (a.features?.sort_order ?? 0) - (b.features?.sort_order ?? 0));

  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);

  const activePlanCode = currentPlanCode ?? strapiPlans.find(p => p.features?.is_default)?.code ?? strapiPlans[0]?.code ?? null;
  const currentPlan = strapiPlans.find(p => p.code === activePlanCode);

  const handleUpgrade = (planCode: string) => {
    setCurrentPlanCode(planCode);
    const plan = strapiPlans.find(p => p.code === planCode);
    toast({
      title: plan ? `Bienvenue sur ${plan.name} !` : "Plan modifie",
      description: "Votre abonnement a ete mis a jour (simulation).",
      variant: "success",
    });
  };

  const handleDowngrade = () => {
    const defaultPlan = strapiPlans.find(p => p.features?.is_default) ?? strapiPlans[0];
    if (defaultPlan) {
      setCurrentPlanCode(defaultPlan.code);
      toast({
        title: "Plan modifie",
        description: `Vous etes revenu au plan ${defaultPlan.name} (simulation).`,
      });
    }
  };

  const getFormattedPrice = (plan: StrapiPlan): string => {
    if (plan.features?.price?.formatted) return plan.features.price.formatted;
    if (plan.price_monthly != null && plan.price_monthly > 0) return `${plan.price_monthly}€ / mois`;
    return "Gratuit";
  };

  if (isConfigLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-subscription-title">
            <CreditCard className="w-5 h-5" />
            Abonnement
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Chargement des plans...
          </p>
        </div>
      </div>
    );
  }

  if (strapiPlans.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-subscription-title">
            <CreditCard className="w-5 h-5" />
            Abonnement
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Aucun plan disponible pour le moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-subscription-title">
          <CreditCard className="w-5 h-5" />
          Abonnement
        </h3>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-subscription-subtitle">
          Choisissez le plan adapte a votre activite.
        </p>
      </div>

      <Card className="bg-muted/50 border-muted">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2" data-testid="text-info-payment">
            <Info className="w-4 h-4 flex-shrink-0" />
            Le paiement par carte arrive bientot. Pour l'instant, la montee en gamme est simulee.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-current-plan">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Votre plan actuel</CardTitle>
                <CardDescription className="text-xs" data-testid="text-current-plan-name">
                  {currentPlan?.name ?? "Aucun"} - {currentPlan ? getFormattedPrice(currentPlan) : ""}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" data-testid="badge-status-active">
              Actif
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className={`grid grid-cols-1 ${strapiPlans.length >= 2 ? "md:grid-cols-2" : ""} ${strapiPlans.length >= 3 ? "lg:grid-cols-3" : ""} gap-4`}>
        {strapiPlans.map((plan) => {
          const isCurrent = plan.code === activePlanCode;
          const isHighlight = plan.features?.ui?.highlight === true;
          const badgeText = plan.features?.badge?.text;
          const cta = plan.features?.cta;
          const planFeatures: StrapiFeature[] = (plan.features?.features ?? [])
            .sort((a: StrapiFeature, b: StrapiFeature) => (a.order ?? 0) - (b.order ?? 0));
          
          return (
            <Card 
              key={plan.id} 
              className={`relative transition-all ${
                isCurrent 
                  ? "ring-2 ring-primary" 
                  : isHighlight 
                    ? "ring-1 ring-accent" 
                    : ""
              }`}
              data-testid={`card-plan-${plan.code}`}
            >
              {badgeText && !isCurrent && (
                <Badge 
                  className="absolute -top-2.5 left-4"
                  data-testid={`badge-popular-${plan.code}`}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {badgeText}
                </Badge>
              )}
              {isCurrent && (
                <Badge 
                  variant="secondary"
                  className="absolute -top-2.5 right-4"
                  data-testid={`badge-current-${plan.code}`}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Actuel
                </Badge>
              )}
              
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base" data-testid={`text-plan-name-${plan.code}`}>{plan.name}</CardTitle>
                  {isDev && isCurrent && !plan.features?.is_default && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-dev-menu">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleDowngrade} data-testid="button-dev-downgrade">
                          Revenir au plan par defaut (dev)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-2" data-testid={`text-plan-price-${plan.code}`}>
                  <span className="text-2xl font-bold">{getFormattedPrice(plan)}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {planFeatures.length > 0 && (
                  <ul className="space-y-2">
                    {planFeatures.map((feature, index) => (
                      <li key={feature.key} className="flex items-start gap-2 text-sm" data-testid={`text-feature-${plan.code}-${index}`}>
                        {feature.included ? (
                          <Check className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground/60 line-through"}>
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="pt-2">
                  {isCurrent ? (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      disabled
                      data-testid={`button-plan-${plan.code}-current`}
                    >
                      Plan actuel
                    </Button>
                  ) : cta?.type === "upgrade" ? (
                    <Button 
                      className="w-full"
                      onClick={() => handleUpgrade(plan.code)}
                      disabled={cta.disabled === true}
                      data-testid={`button-upgrade-${plan.code}`}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {cta.label ?? `Passer a ${plan.name}`}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleUpgrade(plan.code)}
                      disabled={cta?.disabled === true}
                      data-testid={`button-select-${plan.code}`}
                    >
                      {cta?.label ?? `Choisir ${plan.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-faq">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Questions frequentes
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
