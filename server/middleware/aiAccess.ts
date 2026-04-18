import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { hasFeature } from "../services/billingService";
import type { Plan, SubscriptionStatus } from "../services/billingService";

const ADMIN_EMAILS = ["floflow87@planbase.io", "demo@yopmail.com"];

interface AccountBillingRow {
  plan: string | null;
  subscription_status: string | null;
  owner_email: string | null;
}

async function getAccountBilling(accountId: string): Promise<{
  plan: Plan;
  status: SubscriptionStatus;
  ownerEmail: string | null;
}> {
  try {
    const result = await db.execute(
      sql`SELECT a.plan, a.subscription_status, u.email AS owner_email
          FROM accounts a
          LEFT JOIN app_users u ON u.account_id = a.id AND u.role = 'owner'
          WHERE a.id = ${accountId}
          LIMIT 1`
    );
    const row = result[0] as AccountBillingRow | undefined;
    return {
      plan: (row?.plan as Plan) ?? "freelance",
      status: (row?.subscription_status as SubscriptionStatus) ?? null,
      ownerEmail: row?.owner_email ?? null,
    };
  } catch (err) {
    console.error("[requireAiAccess] Erreur getAccountBilling:", err);
    return { plan: "freelance", status: null, ownerEmail: null };
  }
}

export async function requireAiAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accountId = req.accountId;
  if (!accountId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { plan, status, ownerEmail } = await getAccountBilling(accountId);

  if (ownerEmail && ADMIN_EMAILS.includes(ownerEmail)) {
    next();
    return;
  }

  if (hasFeature(plan, status, "ai_assistant")) {
    next();
    return;
  }

  res.status(403).json({
    error: "PLAN_REQUIRED",
    message: "L'assistant IA est réservé au plan Agence.",
    requiredPlan: "agency",
  });
}
