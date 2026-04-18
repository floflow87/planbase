import { Router, Request, Response } from "express";
import { requireAuth, requireOrgMember, requirePermission } from "../middleware/auth";
import { requireAiAccess } from "../middleware/aiAccess";
import { extractActions, suggestNextActions } from "../lib/openai";
import { storage } from "../storage";

const router = Router();

router.use(requireAuth, requireOrgMember, requireAiAccess);

router.post("/notes/:id/extract-actions", requirePermission("notes", "read"), async (req: Request, res: Response) => {
  try {
    const note = await storage.getNote(req.params.id);
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    if (note.accountId !== req.accountId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const text = typeof note.content === "string" ? note.content : JSON.stringify(note.content);
    const actions = await extractActions(text);

    res.json({ actions });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/clients/:id/suggest-actions", requirePermission("crm", "read", "crm.clients"), async (req: Request, res: Response) => {
  try {
    const { buildClientContext } = await import("../services/aiContextBuilder");
    const clientCtx = await buildClientContext(req.accountId!, req.params.id);
    if (!clientCtx) {
      return res.status(404).json({ error: "Client not found" });
    }

    const parts: string[] = [
      `Client: ${clientCtx.name}, Type: ${clientCtx.type ?? "N/A"}, Status: ${clientCtx.status ?? "N/A"}, Budget: ${clientCtx.budget != null ? clientCtx.budget + "€" : "N/A"}`,
    ];

    if (clientCtx.contacts.length > 0) {
      const primary = clientCtx.contacts.find((c) => c.isPrimary) ?? clientCtx.contacts[0];
      parts.push(`Primary contact: ${primary.fullName}${primary.position ? ` (${primary.position})` : ""}`);
    }

    if (clientCtx.linkedProjects.length > 0) {
      parts.push(
        `Related projects: ${clientCtx.linkedProjects.map((p) => `${p.name} (${p.stage ?? "N/A"}${p.budget != null ? ", " + p.budget + "€" : ""})`).join("; ")}`
      );
    }

    if (clientCtx.activeDeals.length > 0) {
      parts.push(
        `Active deals: ${clientCtx.activeDeals.map((d) => `${d.title} (${d.stage}${d.value != null ? ", " + d.value + "€" : ""})`).join("; ")}`
      );
    }

    if (clientCtx.recentActivities.length > 0) {
      const activitySummary = clientCtx.recentActivities
        .slice(0, 5)
        .map((a) => `${a.kind}${a.description ? ": " + a.description : ""}${a.occurredAt ? " (" + a.occurredAt + ")" : ""}`)
        .join("; ");
      parts.push(`Recent interactions: ${activitySummary}`);
    }

    const history = parts.join(". ");
    const suggestions = await suggestNextActions(history);

    res.json({ suggestions });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
