import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

export type Plan = "freelance" | "agency" | "starter";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "expired"
  | null;
export type BillingInterval = "monthly" | "yearly" | null;

export interface BillingStatus {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  billingInterval: BillingInterval;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export type PremiumFeature = "treasury" | "finance" | "email_templates" | "multi_users";

const AGENCY_FEATURES: PremiumFeature[] = ["treasury", "finance", "email_templates", "multi_users"];

const ADMIN_EMAILS = ["floflow87@planbase.io", "demo@yopmail.com"];

const ADMIN_BILLING: BillingStatus = {
  plan: "agency",
  subscriptionStatus: "active",
  billingInterval: "monthly",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function isTrialExpiredStatus(status: SubscriptionStatus): boolean {
  return status === "expired" || status === "canceled";
}

export function hasFeature(billing: BillingStatus | undefined, feature: PremiumFeature): boolean {
  if (!billing) return false;
  if (!isSubscriptionActive(billing.subscriptionStatus)) return false;
  const plan = billing.plan === "starter" ? "freelance" : billing.plan;
  if (plan === "agency") return true;
  return false;
}

export function useBilling() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  const { data: rawBilling, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    staleTime: 30_000,
  });

  const billing = isAdmin ? ADMIN_BILLING : rawBilling;

  const checkoutMutation = useMutation({
    mutationFn: async ({ plan, interval }: { plan: Plan; interval: "monthly" | "yearly" }) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { plan, interval });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const trialDaysLeft = billing?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  const isActive = isSubscriptionActive(billing?.subscriptionStatus ?? null);
  const isTrialing = billing?.subscriptionStatus === "trialing";
  const isCanceled = billing?.subscriptionStatus === "canceled";
  const isTrialExpired = !isAdmin && isTrialExpiredStatus(billing?.subscriptionStatus ?? null);
  const needsUpgrade = !isActive;

  return {
    billing,
    isLoading,
    isAdmin,
    isActive,
    isTrialing,
    isCanceled,
    isTrialExpired,
    needsUpgrade,
    trialDaysLeft,
    hasFeature: (feature: PremiumFeature) => hasFeature(billing, feature),
    startCheckout: checkoutMutation.mutate,
    isCheckingOut: checkoutMutation.isPending,
    openPortal: portalMutation.mutate,
    isOpeningPortal: portalMutation.isPending,
  };
}
