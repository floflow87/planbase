import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Shared secret for Strapi webhooks ───────────────────────────────────────
// Set STRAPI_ADMIN_SECRET in environment variables
const STRAPI_SECRET = process.env.STRAPI_ADMIN_SECRET ?? "";

function validateSecret(req: Request, res: Response): boolean {
  const secret = req.headers["x-strapi-secret"] ?? req.headers["authorization"]?.replace("Bearer ", "");
  if (!STRAPI_SECRET) {
    // No secret configured — allow for now but log a warning
    console.warn("[strapi-admin] STRAPI_ADMIN_SECRET not set — endpoint unprotected");
    return true;
  }
  if (secret !== STRAPI_SECRET) {
    res.status(401).json({ error: "Invalid Strapi secret" });
    return false;
  }
  return true;
}

// ─── GET /api/strapi/admin-accounts ──────────────────────────────────────────
// List all accounts currently flagged as admin
router.get("/admin-accounts", async (req: Request, res: Response) => {
  if (!validateSecret(req, res)) return;
  try {
    const result = await db.execute(sql`
      SELECT a.id, a.name, a.is_admin_account, a.strapi_user_id,
             u.email as owner_email
      FROM accounts a
      LEFT JOIN app_users u ON u.id = a.owner_user_id
      WHERE a.is_admin_account = true
      ORDER BY a.created_at DESC
    `);
    res.json({ adminAccounts: result });
  } catch (err: any) {
    console.error("[strapi-admin] list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/strapi/admin-sync ─────────────────────────────────────────────
// Set or unset admin status for an account.
// Body: { email: string, isAdmin: boolean, strapiUserId?: string }
//   OR: { accountId: string, isAdmin: boolean, strapiUserId?: string }
router.post("/admin-sync", async (req: Request, res: Response) => {
  if (!validateSecret(req, res)) return;
  try {
    const { email, accountId, isAdmin, strapiUserId } = req.body as {
      email?: string;
      accountId?: string;
      isAdmin: boolean;
      strapiUserId?: string;
    };

    if (typeof isAdmin !== "boolean") {
      return res.status(400).json({ error: "isAdmin (boolean) is required" });
    }
    if (!email && !accountId) {
      return res.status(400).json({ error: "email or accountId is required" });
    }

    let targetAccountId: string | null = null;

    if (accountId) {
      // Direct account ID provided
      targetAccountId = accountId;
    } else if (email) {
      // Resolve account ID from owner email
      const userResult = await db.execute(sql`
        SELECT u.account_id
        FROM app_users u
        WHERE u.email = ${email}
          AND u.role = 'owner'
        LIMIT 1
      `);
      const found = userResult[0] as any;
      if (!found) {
        return res.status(404).json({ error: `No owner account found for email: ${email}` });
      }
      targetAccountId = found.account_id;
    }

    // Update the account
    await db.execute(sql`
      UPDATE accounts
      SET is_admin_account = ${isAdmin},
          strapi_user_id = ${strapiUserId ?? null},
          updated_at = NOW()
      WHERE id = ${targetAccountId}
    `);

    console.log(`[strapi-admin] Account ${targetAccountId} → isAdmin=${isAdmin}${strapiUserId ? ` (strapi: ${strapiUserId})` : ""}`);

    res.json({
      success: true,
      accountId: targetAccountId,
      isAdmin,
      strapiUserId: strapiUserId ?? null,
    });
  } catch (err: any) {
    console.error("[strapi-admin] sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/strapi/admin-sync/bulk ────────────────────────────────────────
// Bulk sync: replace ALL admin accounts at once.
// Body: { adminEmails: string[], strapiUserIds?: Record<string, string> }
router.post("/admin-sync/bulk", async (req: Request, res: Response) => {
  if (!validateSecret(req, res)) return;
  try {
    const { adminEmails, strapiUserIds } = req.body as {
      adminEmails: string[];
      strapiUserIds?: Record<string, string>;
    };

    if (!Array.isArray(adminEmails)) {
      return res.status(400).json({ error: "adminEmails (string[]) is required" });
    }

    // Step 1: Clear all current admin flags
    await db.execute(sql`UPDATE accounts SET is_admin_account = false WHERE is_admin_account = true`);

    // Step 2: Set admin for each email
    let updated = 0;
    for (const email of adminEmails) {
      const userResult = await db.execute(sql`
        SELECT u.account_id
        FROM app_users u
        WHERE u.email = ${email} AND u.role = 'owner'
        LIMIT 1
      `);
      const found = userResult[0] as any;
      if (!found) {
        console.warn(`[strapi-admin] bulk: no owner account for email ${email}`);
        continue;
      }
      const strapiId = strapiUserIds?.[email] ?? null;
      await db.execute(sql`
        UPDATE accounts
        SET is_admin_account = true,
            strapi_user_id = ${strapiId},
            updated_at = NOW()
        WHERE id = ${found.account_id}
      `);
      updated++;
    }

    res.json({ success: true, requested: adminEmails.length, updated });
  } catch (err: any) {
    console.error("[strapi-admin] bulk sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
