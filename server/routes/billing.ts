import { Router, Request, Response } from "express";
import Stripe from "stripe";
import getStripe, {
  PRICE_IDS,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  syncSubscriptionToDb,
  getPlanFromPriceId,
  getIntervalFromPriceId,
} from "../services/stripeService";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Helper: get billing info for an account ──────────────────────────────────
async function getAccountBilling(accountId: string) {
  const result = await db.execute(sql`
    SELECT
      id, name, plan, subscription_status, billing_interval,
      stripe_customer_id, stripe_subscription_id, stripe_price_id,
      trial_ends_at, current_period_end, cancel_at_period_end,
      trial_started_explicitly
    FROM accounts WHERE id = ${accountId}
  `);
  return result[0] as any ?? null;
}

// ─── GET /api/billing/status ──────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = (req as any).accountId;
    const account = await getAccountBilling(accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    // Derive subscription status from local trial when no Stripe subscription exists
    let effectiveStatus = account.subscription_status ?? null;
    if (!effectiveStatus && !account.stripe_subscription_id) {
      if (account.trial_ends_at && account.trial_started_explicitly) {
        // Only derive trial status if the trial was explicitly started by the user
        const trialEnd = new Date(account.trial_ends_at);
        effectiveStatus = trialEnd > new Date() ? "trialing" : "expired";
      }
      // else: trial_ends_at IS NULL or not explicitly started → status stays null (hasNoTrial)
    }

    res.json({
      plan: account.plan ?? "freelance",
      subscriptionStatus: effectiveStatus,
      billingInterval: account.billing_interval ?? null,
      stripeCustomerId: account.stripe_customer_id ?? null,
      stripeSubscriptionId: account.stripe_subscription_id ?? null,
      stripePriceId: account.stripe_price_id ?? null,
      trialEndsAt: account.trial_ends_at ?? null,
      currentPeriodEnd: account.current_period_end ?? null,
      cancelAtPeriodEnd: account.cancel_at_period_end ?? false,
    });
  } catch (err) {
    console.error("billing/status error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /api/billing/checkout ──────────────────────────────────────────────
router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = (req as any).accountId;
    const { plan, interval } = req.body as { plan: "freelance" | "agency"; interval: "monthly" | "yearly" };

    if (!plan || !interval) return res.status(400).json({ error: "plan and interval are required" });

    const priceId = PRICE_IDS[plan]?.[interval];
    if (!priceId) return res.status(400).json({ error: "Invalid plan/interval" });

    const account = await getAccountBilling(accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    // Fetch email from app_users
    const userResult = await db.execute(sql`
      SELECT email FROM app_users WHERE account_id = ${accountId} ORDER BY created_at ASC LIMIT 1
    `);
    const email = (userResult[0] as any)?.email ?? `${accountId}@planbase.io`;
    const customerId = await getOrCreateCustomer(accountId, email, account.name);

    const origin = req.headers.origin ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000"}`;
    const session = await createCheckoutSession(
      accountId,
      customerId,
      priceId,
      `${origin}/settings?tab=billing&checkout=success`,
      `${origin}/settings?tab=billing&checkout=cancel`
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("billing/checkout error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /api/billing/portal ────────────────────────────────────────────────
router.post("/portal", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = (req as any).accountId;
    const account = await getAccountBilling(accountId);

    if (!account?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer found. Subscribe first." });
    }

    const origin = req.headers.origin ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000"}`;
    const portalSession = await createPortalSession(
      account.stripe_customer_id,
      `${origin}/settings?tab=billing`
    );

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error("billing/portal error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /api/billing/start-trial ───────────────────────────────────────────
router.post("/start-trial", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = (req as any).accountId;
    const account = await getAccountBilling(accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    // Prevent re-starting trial if explicitly already started or if subscription exists
    if (account.trial_started_explicitly || account.subscription_status) {
      return res.status(400).json({ error: "Trial or subscription already exists" });
    }

    await db.execute(sql`
      UPDATE accounts
      SET trial_ends_at = NOW() + INTERVAL '7 days',
          trial_started_explicitly = true
      WHERE id = ${accountId}
        AND (trial_started_explicitly IS NULL OR trial_started_explicitly = false)
        AND subscription_status IS NULL
    `);

    res.json({ success: true, message: "Trial started for 7 days" });
  } catch (err) {
    console.error("billing/start-trial error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /api/billing/webhook ───────────────────────────────────────────────
// This route must NOT use requireAuth — it's called directly by Stripe
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionToDb(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        if (accountId) {
          await db.execute(sql`
            UPDATE accounts SET
              subscription_status = 'canceled',
              plan = 'freelance',
              updated_at = NOW()
            WHERE id = ${accountId}
          `);
          console.log(`✅ Subscription canceled for account ${accountId}`);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.metadata?.account_id) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
          // Inject account_id if missing from subscription metadata
          if (!sub.metadata?.account_id) {
            await getStripe().subscriptions.update(sub.id, {
              metadata: { account_id: session.metadata.account_id },
            });
            (sub as any).metadata = { account_id: session.metadata.account_id };
          }
          await syncSubscriptionToDb(sub);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        // Mark as past_due — the subscription.updated event will also fire
        console.warn(`⚠️  Payment failed for customer ${customerId}`);
        break;
      }

      default:
        // Ignore other events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
