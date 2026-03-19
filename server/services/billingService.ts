/**
 * Feature gating — centralises ALL plan/feature access logic.
 * Keep this file as the single source of truth for what each plan can do.
 */

export type Plan = "freelance" | "agency" | "starter" | null | undefined;
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | null | undefined;

// ─── Feature registry ────────────────────────────────────────────────────────
export type Feature =
  | "treasury"
  | "finance"        // rentabilité
  | "email_templates"
  | "multi_users";

// Map of features → minimum plan required
const FEATURE_PLANS: Record<Feature, Plan[]> = {
  treasury:        ["agency"],
  finance:         ["agency"],
  email_templates: ["agency"],
  multi_users:     ["agency"],
};

// ─── Check if account has access ────────────────────────────────────────────
export function hasFeature(plan: Plan, status: SubscriptionStatus, feature: Feature): boolean {
  if (!isSubscriptionActive(status)) return false;
  const allowed = FEATURE_PLANS[feature];
  return allowed.includes(normalise(plan));
}

export function canAccessModule(plan: Plan, status: SubscriptionStatus, module: Feature): boolean {
  return hasFeature(plan, status, module);
}

// ─── Is the subscription currently usable? ───────────────────────────────────
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

// ─── Is the trial still running? ────────────────────────────────────────────
export function isTrialing(status: SubscriptionStatus): boolean {
  return status === "trialing";
}

// ─── Normalise plan value ────────────────────────────────────────────────────
function normalise(plan: Plan): Plan {
  if (!plan || plan === "starter") return "freelance";
  return plan;
}

// ─── Plan display metadata ───────────────────────────────────────────────────
export const PLAN_META = {
  freelance: {
    name: "Freelance",
    priceMonthly: 19,
    priceYearly: 12,
    description: "Pour les indépendants",
    features: [
      "CRM & pipeline client",
      "Projets & tâches",
      "Notes & documents",
      "Boîte mail Gmail intégrée",
      "Google Calendar",
      "Timeline client",
      "Fichiers & gestion documentaire",
    ],
    premium: [] as string[],
  },
  agency: {
    name: "Agence",
    priceMonthly: 39,
    priceYearly: 29,
    description: "Pour les équipes & pilotage avancé",
    features: [
      "Tout le plan Freelance",
      "Multi-utilisateurs",
      "Templates email",
      "Trésorerie",
      "Rentabilité & finance",
    ],
    premium: ["multi_users", "email_templates", "treasury", "finance"] as Feature[],
  },
} as const;
