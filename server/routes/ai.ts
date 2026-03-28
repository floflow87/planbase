import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { callAi, extractTextFromProseMirror } from "../services/aiService";
import { hasFeature } from "../services/billingService";
import type { Plan, SubscriptionStatus } from "../services/billingService";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

const ADMIN_EMAILS = ["floflow87@planbase.io", "demo@yopmail.com"];

interface AccountBillingRow {
  plan: string | null;
  subscription_status: string | null;
  owner_email: string | null;
}

interface AccountBillingResult {
  plan: Plan;
  status: SubscriptionStatus;
  ownerEmail: string | null;
}

async function getAccountBilling(accountId: string): Promise<AccountBillingResult> {
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
    console.error("AI getAccountBilling error:", err);
    return { plan: "freelance", status: null, ownerEmail: null };
  }
}

function requireAiAccess(
  plan: Plan,
  status: SubscriptionStatus,
  email: string | undefined,
  res: Response
): boolean {
  if (email && ADMIN_EMAILS.includes(email)) return true;
  if (hasFeature(plan, status, "ai_assistant")) return true;

  res.status(403).json({
    error: "PLAN_REQUIRED",
    message: "L'assistant IA est réservé au plan Agence.",
    requiredPlan: "agency",
  });
  return false;
}

interface ProjectContextBody {
  name?: string;
  description?: string;
  budget?: number;
  status?: string;
  timeConsumedHours?: number;
  marginPercent?: number;
}

interface ChatRequestBody {
  message: string;
  projectContext?: ProjectContextBody;
}

interface ContentRequestBody {
  content: unknown;
  title?: string;
  type?: "note" | "document";
}

interface ProjectAnalysisBody {
  project: {
    name: string;
    description?: string;
    budget?: number | null;
    status?: string;
    timeConsumedHours?: number;
    marginPercent?: number;
    totalBilled?: number;
    margin?: number;
    category?: string;
  };
}

router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { plan, status, ownerEmail } = await getAccountBilling(accountId);
    if (!requireAiAccess(plan, status, ownerEmail, res)) return;

    const { message, projectContext } = req.body as ChatRequestBody;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Le message est requis" });
    }

    const response = await callAi(message, {
      user: { plan: plan ?? "freelance" },
      project: projectContext,
    });

    res.json({ response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'assistant IA";
    console.error("AI /chat error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/project-analysis", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { plan, status, ownerEmail } = await getAccountBilling(accountId);
    if (!requireAiAccess(plan, status, ownerEmail, res)) return;

    const { project } = req.body as ProjectAnalysisBody;

    if (!project?.name) {
      return res.status(400).json({ error: "Les données projet sont requises" });
    }

    const prompt = `Analyse ce projet et fournis un diagnostic structuré en 4 sections :

**Diagnostic de rentabilité** : évalue la santé financière du projet.
**Risques identifiés** : liste les risques majeurs (dépassement budget, marge, etc.).
**Quick wins** : actions rapides à fort impact pour améliorer la situation.
**Priorités recommandées** : 3 actions prioritaires à mener maintenant.

Données du projet :
- Nom : ${project.name}
- Description : ${project.description || "N/A"}
- Catégorie : ${project.category || "N/A"}
- Statut : ${project.status || "N/A"}
- Budget : ${project.budget != null ? project.budget + "€" : "N/A"}
- Facturé : ${project.totalBilled != null ? project.totalBilled + "€" : "N/A"}
- Marge : ${project.margin != null ? project.margin + "€" : "N/A"} (${project.marginPercent != null ? project.marginPercent.toFixed(1) + "%" : "N/A"})
- Temps consommé : ${project.timeConsumedHours != null ? project.timeConsumedHours + "h" : "N/A"}

Sois concis et actionnable.`;

    const response = await callAi(prompt, {
      user: { plan: plan ?? "freelance" },
      project: {
        name: project.name,
        description: project.description,
        budget: project.budget,
        status: project.status,
        timeConsumedHours: project.timeConsumedHours,
        marginPercent: project.marginPercent,
      },
    });

    res.json({ analysis: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'analyse IA";
    console.error("AI /project-analysis error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/summarize", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { plan, status, ownerEmail } = await getAccountBilling(accountId);
    if (!requireAiAccess(plan, status, ownerEmail, res)) return;

    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const prompt = `Synthétise ce ${type === "document" ? "document" : "note"} en 3-5 points clés sous forme de liste.${title ? ` Titre : "${title}".` : ""} Sois concis.`;

    const response = await callAi(prompt, { user: { plan: plan ?? "freelance" }, content: text });
    res.json({ result: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de la synthèse IA";
    console.error("AI /summarize error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/improve", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { plan, status, ownerEmail } = await getAccountBilling(accountId);
    if (!requireAiAccess(plan, status, ownerEmail, res)) return;

    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const prompt = `Améliore la clarté, la structure et le style de ce ${type === "document" ? "document" : "note"} professionnel${title ? ` intitulé "${title}"` : ""}. Conserve les idées principales. Fournis le texte amélioré directement sans introduction.`;

    const response = await callAi(prompt, { user: { plan: plan ?? "freelance" }, content: text });
    res.json({ result: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'amélioration IA";
    console.error("AI /improve error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/recommendations", requireAuth, async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { plan, status, ownerEmail } = await getAccountBilling(accountId);
    if (!requireAiAccess(plan, status, ownerEmail, res)) return;

    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const prompt = `En te basant sur ce ${type === "document" ? "document" : "note"}${title ? ` "${title}"` : ""}, fournis 3-5 recommandations concrètes et actionnables pour améliorer la situation ou avancer. Format : liste numérotée.`;

    const response = await callAi(prompt, { user: { plan: plan ?? "freelance" }, content: text });
    res.json({ result: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur des recommandations IA";
    console.error("AI /recommendations error:", err);
    res.status(503).json({ error: message });
  }
});

export default router;
