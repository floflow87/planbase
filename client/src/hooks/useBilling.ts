import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  isAdminAccount?: boolean;
}

export type PremiumFeature = "treasury" | "finance" | "email_templates" | "multi_users" | "ai_assistant";

/**
 * BillingState — single source of truth for the UI state machine.
 *
 * "loading"   — billing data not yet fetched
 * "admin"     — admin bypass (floflow87@planbase.io / demo@yopmail.com)
 * "no_trial"  — account exists but trial never explicitly started
 * "trialing"  — trial active (trial_ends_at > NOW, started explicitly)
 * "expired"   — trial ended with no active subscription
 * "canceled"  — Stripe subscription was canceled
 * "past_due"  — payment failed but access maintained temporarily
 * "active"    — paid subscription active
 */
export type BillingState =
  | "loading"
  | "admin"
  | "no_trial"
  | "trialing"
  | "expired"
  | "canceled"
  | "past_due"
  | "active";

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENCY_FEATURES: PremiumFeature[] = ["treasury", "finance", "email_templates", "multi_users", "ai_assistant"];

export const ADMIN_EMAILS = ["floflow87@planbase.io", "demo@yopmail.com"];

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

// ─── Central state resolver ───────────────────────────────────────────────────

/**
 * Resolves the billing state from raw server data.
 * This is the SINGLE authoritative function for deriving billing state.
 * All components must use this via `useBilling().billingState`.
 */
export function resolveBillingState({
  isLoading,
  isAdmin,
  status,
}: {
  isLoading: boolean;
  isAdmin: boolean;
  status: SubscriptionStatus | null | undefined;
}): BillingState {
  if (isLoading) return "loading";
  if (isAdmin) return "admin";

  switch (status) {
    case "active":    return "active";
    case "past_due":  return "past_due";
    case "trialing":  return "trialing";
    case "expired":   return "expired";
    case "canceled":  return "canceled";
    case null:
    default:          return "no_trial";
  }
}

// ─── Derived helpers (from BillingState, not from raw status) ─────────────────

/** Full access: admin, active subscription, ongoing trial, or past-due (grace period) */
export function isAccessGranted(state: BillingState): boolean {
  return state === "active" || state === "trialing" || state === "past_due" || state === "admin";
}

/** Access is blocked and a subscription is required to continue */
export function isAccessBlocked(state: BillingState): boolean {
  return state === "expired" || state === "canceled";
}

/** Trial or subscription is active (not expired/canceled) */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function hasFeature(billing: BillingStatus | undefined, feature: PremiumFeature): boolean {
  if (!billing) return false;
  if (!isSubscriptionActive(billing.subscriptionStatus)) return false;
  const plan = billing.plan === "starter" ? "freelance" : billing.plan;
  return plan === "agency";
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBilling() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email ?? "");
  // Collaborators and client_viewers are invited users — they inherit the account owner's billing
  const isInvitedMember = user?.role === 'collaborator' || user?.role === 'client_viewer';

  const { data: rawBilling, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    staleTime: 30_000,
    // Only fetch when user is authenticated
    enabled: !!user,
  });

  // Admin if: email in ADMIN_EMAILS, or account flagged as admin in DB, or invited member
  const isAdmin = isEmailAdmin || rawBilling?.isAdminAccount === true || isInvitedMember;

  // Admins always see full billing regardless of actual DB data
  const billing = isAdmin ? ADMIN_BILLING : rawBilling;

  // ── Single centralized billing state ──────────────────────────────────────
  const billingState = resolveBillingState({
    isLoading,
    isAdmin,
    status: rawBilling?.subscriptionStatus ?? null,
  });

  // ── Derived booleans (all from billingState — never from raw status) ───────
  const isActive      = isAccessGranted(billingState);
  const isTrialing    = billingState === "trialing";
  const isTrialExpired = isAccessBlocked(billingState);
  const isCanceled    = billingState === "canceled";
  const hasNoTrial    = billingState === "no_trial";
  const needsUpgrade  = !isActive;

  // ── Trial countdown ───────────────────────────────────────────────────────
  const trialDaysLeft = billing?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const checkoutMutation = useMutation({
    mutationFn: async ({ plan, interval }: { plan: Plan; interval: "monthly" | "yearly" }) => {
      const res = await apiRequest("/api/billing/checkout", "POST", { plan, interval });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/billing/portal", "POST", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const startTrialMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/billing/start-trial", "POST", {});
      return res.json();
    },
    onSuccess: async () => {
      // Wait for the billing query to fully refresh before returning
      // (prevents race condition in TrialExpiredGate redirect)
      await qc.refetchQueries({ queryKey: ["/api/billing/status"] });
    },
  });

  return {
    // Raw data
    billing,
    isLoading,
    isAdmin,

    // ── Centralized state (use this in components) ──
    billingState,

    // ── Derived booleans (kept for backwards compat) ──
    isActive,
    isTrialing,
    isTrialExpired,
    isCanceled,
    hasNoTrial,
    needsUpgrade,
    trialDaysLeft,

    // ── Feature check ──
    hasFeature: (feature: PremiumFeature) => hasFeature(billing, feature),

    // ── Actions ──
    startCheckout: checkoutMutation.mutate,
    isCheckingOut: checkoutMutation.isPending,
    openPortal: portalMutation.mutate,
    isOpeningPortal: portalMutation.isPending,
    startTrial: startTrialMutation.mutate,
    isStartingTrial: startTrialMutation.isPending,
  };
}
