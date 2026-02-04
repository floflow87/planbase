export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  isPopular: boolean;
  features: string[];
}

export interface Subscription {
  currentPlanId: PlanId;
  status: "active" | "none";
  renewalDate?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Solo starter",
    priceLabel: "Gratuit",
    isPopular: false,
    features: [
      "1 utilisateur",
      "1 projet actif",
      "Roadmap & OKR : lecture seule",
      "Notes & tâches : basique",
      "Support par email"
    ]
  },
  {
    id: "pro",
    name: "Freelance pro",
    priceLabel: "19,99€ / mois",
    isPopular: true,
    features: [
      "1 utilisateur",
      "Projets illimités",
      "Roadmap & OKR complets",
      "Rentabilité & recommandations activées",
      "Notifications email + in-app",
      "Support prioritaire"
    ]
  }
];

export const DEFAULT_SUBSCRIPTION: Subscription = {
  currentPlanId: "free",
  status: "active",
  renewalDate: undefined
};

export const FAQ_ITEMS = [
  {
    question: "Comment fonctionne la facturation ?",
    answer: "L'abonnement Freelance pro est facturé mensuellement. Vous pouvez annuler à tout moment et vous conserverez l'accès jusqu'à la fin de votre période de facturation en cours."
  },
  {
    question: "Puis-je annuler mon abonnement ?",
    answer: "Oui, vous pouvez annuler votre abonnement à tout moment depuis cette page. Votre accès aux fonctionnalités Pro sera maintenu jusqu'à la fin de la période payée."
  },
  {
    question: "Quelle est la différence entre Free et Pro ?",
    answer: "Le plan Free vous permet de découvrir PlanBase avec 1 projet actif et des fonctionnalités limitées. Le plan Pro débloque les projets illimités, les fonctionnalités avancées de roadmap, OKR, et les outils de rentabilité."
  }
];
