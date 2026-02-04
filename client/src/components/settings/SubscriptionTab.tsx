import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, Sparkles, HelpCircle, MoreHorizontal, CreditCard, Calendar, Info } from "lucide-react";
import { PLANS, FAQ_ITEMS, DEFAULT_SUBSCRIPTION, type PlanId, type Subscription } from "@/data/subscriptionMock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SubscriptionTab() {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const isDev = import.meta.env.DEV;

  const handleUpgrade = (planId: PlanId) => {
    setSubscription({
      currentPlanId: planId,
      status: "active",
      renewalDate: planId === "pro" 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined
    });
    
    toast({
      title: planId === "pro" ? "Bienvenue sur Freelance pro !" : "Plan modifié",
      description: planId === "pro" 
        ? "Votre abonnement a été mis à jour (simulation). Profitez de toutes les fonctionnalités !"
        : "Vous êtes revenu au plan gratuit (simulation).",
      variant: "success",
    });
  };

  const handleDowngrade = () => {
    setSubscription({
      currentPlanId: "free",
      status: "active",
      renewalDate: undefined
    });
    
    toast({
      title: "Plan modifié",
      description: "Vous êtes revenu au plan gratuit (simulation).",
    });
  };

  const currentPlan = PLANS.find(p => p.id === subscription.currentPlanId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-subscription-title">
          <CreditCard className="w-5 h-5" />
          Abonnement
        </h3>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-subscription-subtitle">
          Choisissez le plan adapté à votre activité.
        </p>
      </div>

      <Card className="bg-muted/50 border-muted">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2" data-testid="text-info-payment">
            <Info className="w-4 h-4 flex-shrink-0" />
            Le paiement par carte arrive bientôt. Pour l'instant, la montée en gamme est simulée.
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
                  {currentPlan?.name} - {currentPlan?.priceLabel}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" data-testid="badge-status-active">
              Actif
            </Badge>
          </div>
        </CardHeader>
        {subscription.currentPlanId === "pro" && subscription.renewalDate && (
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-renewal-date">
              <Calendar className="w-3.5 h-3.5" />
              Prochaine échéance : {new Date(subscription.renewalDate).toLocaleDateString('fr-FR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = subscription.currentPlanId === plan.id;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative transition-all ${
                isCurrent 
                  ? 'ring-2 ring-primary' 
                  : plan.isPopular 
                    ? 'ring-1 ring-accent' 
                    : ''
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.isPopular && (
                <Badge 
                  className="absolute -top-2.5 left-4"
                  data-testid={`badge-popular-${plan.id}`}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Populaire
                </Badge>
              )}
              {isCurrent && (
                <Badge 
                  variant="secondary"
                  className="absolute -top-2.5 right-4"
                  data-testid={`badge-current-${plan.id}`}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Actuel
                </Badge>
              )}
              
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                  {isDev && isCurrent && subscription.currentPlanId === "pro" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-dev-menu">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleDowngrade} data-testid="button-dev-downgrade">
                          Revenir à Free (dev)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-2" data-testid={`text-plan-price-${plan.id}`}>
                  <span className="text-2xl font-bold">{plan.priceLabel}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm" data-testid={`text-feature-${plan.id}-${index}`}>
                      <Check className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-2">
                  {isCurrent ? (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      disabled
                      data-testid={`button-plan-${plan.id}-current`}
                    >
                      Plan actuel
                    </Button>
                  ) : plan.id === "pro" ? (
                    <Button 
                      className="w-full"
                      onClick={() => handleUpgrade("pro")}
                      data-testid="button-upgrade-pro"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Passer à Freelance pro
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleUpgrade("free")}
                      data-testid="button-downgrade-free"
                    >
                      Revenir à Free
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
