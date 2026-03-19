import Stripe from "stripe";
import { db } from "../db";
import { sql } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

export default stripe;

// ─── Price IDs from env ─────────────────────────────────────────────────────
export const PRICE_IDS = {
  freelance: {
    monthly: process.env.STRIPE_PRICE_FREELANCE_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_FREELANCE_YEARLY!,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_AGENCY_YEARLY!,
  },
} as const;

export type PlanKey = "freelance" | "agency";
export type BillingInterval = "monthly" | "yearly";

// ─── Derive plan from price ID ───────────────────────────────────────────────
export function getPlanFromPriceId(priceId: string): PlanKey | null {
  if (priceId === PRICE_IDS.freelance.monthly || priceId === PRICE_IDS.freelance.yearly) return "freelance";
  if (priceId === PRICE_IDS.agency.monthly || priceId === PRICE_IDS.agency.yearly) return "agency";
  return null;
}

export function getIntervalFromPriceId(priceId: string): BillingInterval | null {
  if (priceId === PRICE_IDS.freelance.monthly || priceId === PRICE_IDS.agency.monthly) return "monthly";
  if (priceId === PRICE_IDS.freelance.yearly || priceId === PRICE_IDS.agency.yearly) return "yearly";
  return null;
}

// ─── Create or retrieve Stripe customer ─────────────────────────────────────
export async function getOrCreateCustomer(accountId: string, email: string, name: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT stripe_customer_id FROM accounts WHERE id = ${accountId}
  `);
  const row = result[0] as any;

  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { account_id: accountId },
  });

  await db.execute(sql`
    UPDATE accounts SET stripe_customer_id = ${customer.id}, updated_at = NOW() WHERE id = ${accountId}
  `);

  return customer.id;
}

// ─── Create checkout session ─────────────────────────────────────────────────
export async function createCheckoutSession(
  accountId: string,
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    subscription_data: {
      trial_period_days: 7,
      metadata: { account_id: accountId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { account_id: accountId },
    allow_promotion_codes: true,
  });
}

// ─── Create billing portal session ──────────────────────────────────────────
export async function createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ─── Sync subscription to DB ─────────────────────────────────────────────────
export async function syncSubscriptionToDb(subscription: Stripe.Subscription): Promise<void> {
  const accountId = subscription.metadata?.account_id;
  if (!accountId) {
    console.warn("⚠️  Stripe subscription has no account_id metadata:", subscription.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = priceId ? getPlanFromPriceId(priceId) : null;
  const interval = priceId ? getIntervalFromPriceId(priceId) : null;
  const status = subscription.status;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  await db.execute(sql`
    UPDATE accounts SET
      stripe_subscription_id   = ${subscription.id},
      stripe_price_id           = ${priceId},
      billing_interval          = ${interval},
      plan                      = ${plan ?? "freelance"},
      subscription_status       = ${status},
      trial_ends_at             = ${trialEnd}::timestamptz,
      current_period_end        = ${periodEnd}::timestamptz,
      cancel_at_period_end      = ${cancelAtPeriodEnd},
      updated_at                = NOW()
    WHERE id = ${accountId}
  `);
  console.log(`✅ Subscription synced for account ${accountId}: plan=${plan} status=${status}`);
}
