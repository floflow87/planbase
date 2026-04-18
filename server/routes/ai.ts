import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAiAccess } from "../middleware/aiAccess";
import { extractTextFromProseMirror } from "../services/aiService";
import { runAi } from "../services/aiOrchestrator";
import {
  buildProjectContext,
  buildNoteContext,
  buildDocumentContext,
} from "../services/aiContextBuilder";
import { searchSimilarNotes, type SimilarNote } from "../services/embeddingService";
import { storage } from "../storage";
import { db } from "../db";
import { backlogs, projects } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.use(requireAuth, requireAiAccess);

interface ChatRequestBody {
  message: string;
  projectId?: string;
  clientId?: string;
}

interface ContentRequestBody {
  content: unknown;
  title?: string;
  type?: "note" | "document";
  noteId?: string;
  documentId?: string;
}

interface ProjectAnalysisBody {
  projectId?: string;
  project?: {
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

interface SearchContextBody {
  query: string;
  accountId?: string;
  limit?: number;
}

interface GenerateTicketBody {
  title: string;
  backlogId?: string;
}

interface ExtractActionsBody {
  noteId: string;
}

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { message, projectId } = req.body as ChatRequestBody;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Le message est requis" });
    }

    let projectCtx: Awaited<ReturnType<typeof buildProjectContext>> = null;
    if (projectId) {
      projectCtx = await buildProjectContext(accountId, projectId);
    }

    let semanticContext: string | undefined;
    let sources: Array<{ title: string; noteId: string }> = [];

    try {
      const similarNotes = await searchSimilarNotes(message, accountId, 5);
      if (similarNotes.length > 0) {
        sources = similarNotes.map((n) => ({ title: n.title, noteId: n.noteId }));
        semanticContext = similarNotes
          .map((n, i) => `[Note ${i + 1}] "${n.title}":\n${n.snippet}`)
          .join("\n\n");
      }
    } catch (_) {}

    const result = await runAi({
      type: "chat",
      provider: "ollama",
      context: {
        content: message,
        project: projectCtx
          ? {
              name: projectCtx.name,
              description: projectCtx.description,
              category: projectCtx.category,
              status: projectCtx.stage,
              priority: projectCtx.priority,
              budget: projectCtx.budget,
              totalBilled: projectCtx.totalBilled,
              margin: projectCtx.margin,
              marginPercent: projectCtx.marginPercent,
              targetTJM: projectCtx.targetTJM,
              actualTJM: projectCtx.actualTJM,
              theoreticalDays: projectCtx.theoreticalDays,
              timeConsumedHours: projectCtx.timeConsumedHours,
              budgetConsumedPercent: projectCtx.budgetConsumedPercent,
              healthScore: projectCtx.healthScore,
              profitabilityStatus: projectCtx.profitabilityStatus,
              taskCounts: projectCtx.taskCounts,
              scopeItems: projectCtx.scopeItems,
            }
          : undefined,
        semanticContext,
      },
    });

    res.json({ response: result.text, sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'assistant IA";
    console.error("AI /chat error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/search-context", async (req: Request, res: Response) => {
  try {
    const { query, limit = 5 } = req.body as SearchContextBody;

    if (!query?.trim()) {
      return res.status(400).json({ error: "La requête est requise" });
    }

    const accountId = req.accountId!;
    const results: SimilarNote[] = await searchSimilarNotes(query, accountId, limit);

    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de la recherche sémantique";
    console.error("AI /search-context error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/project-analysis", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const body = req.body as ProjectAnalysisBody;

    let projectData: {
      name: string;
      description?: string;
      category?: string;
      stage?: string;
      priority?: string;
      budget?: number | null;
      totalBilled?: number;
      margin?: number;
      marginPercent?: number;
      targetTJM?: number;
      actualTJM?: number;
      theoreticalDays?: number;
      timeConsumedHours?: number;
      budgetConsumedPercent?: number;
      healthScore?: number;
      profitabilityStatus?: string;
      taskCounts?: { total: number; todo: number; inProgress: number; done: number; overdue: number };
      scopeItems?: { total: number; completed: number; titles: string[] };
    } | null = null;

    if (body.projectId) {
      const ctx = await buildProjectContext(accountId, body.projectId);
      if (!ctx) {
        return res.status(404).json({ error: "Projet introuvable" });
      }
      projectData = ctx;
    } else if (body.project?.name) {
      projectData = {
        name: body.project.name,
        description: body.project.description,
        category: body.project.category,
        stage: body.project.status,
        budget: body.project.budget ?? undefined,
        totalBilled: body.project.totalBilled,
        margin: body.project.margin,
        marginPercent: body.project.marginPercent,
        timeConsumedHours: body.project.timeConsumedHours,
      };
    }

    if (!projectData?.name) {
      return res.status(400).json({ error: "Les données projet sont requises" });
    }

    const p = projectData;

    const result = await runAi({
      type: "projectAnalysis",
      provider: "auto",
      context: {
        promptContext: {
          name: p.name,
          description: p.description,
          category: p.category,
          status: p.stage,
          priority: p.priority,
          budget: p.budget,
          totalBilled: p.totalBilled,
          margin: p.margin,
          marginPercent: p.marginPercent,
          targetTJM: p.targetTJM,
          actualTJM: p.actualTJM,
          theoreticalDays: p.theoreticalDays,
          timeConsumedHours: p.timeConsumedHours,
          budgetConsumedPercent: p.budgetConsumedPercent,
          healthScore: p.healthScore,
          profitabilityStatus: p.profitabilityStatus,
          taskCounts: p.taskCounts,
          scopeItems: p.scopeItems,
        },
        project: {
          name: p.name,
          description: p.description,
          category: p.category,
          status: p.stage,
          budget: p.budget,
          totalBilled: p.totalBilled,
          margin: p.margin,
          marginPercent: p.marginPercent,
          targetTJM: p.targetTJM,
          actualTJM: p.actualTJM,
          theoreticalDays: p.theoreticalDays,
          timeConsumedHours: p.timeConsumedHours,
          budgetConsumedPercent: p.budgetConsumedPercent,
          healthScore: p.healthScore,
          profitabilityStatus: p.profitabilityStatus,
          taskCounts: p.taskCounts,
          scopeItems: p.scopeItems,
        },
      },
    });

    // Try to parse structured JSON response
    let analysisData: { health?: string; risks?: string; quickWins?: string; priorities?: string } | null = null;
    try {
      const parsed = JSON.parse(result.text);
      if (parsed.health || parsed.risks || parsed.quickWins || parsed.priorities) {
        analysisData = parsed;
      }
    } catch {
      // fall back to plain text
    }

    if (analysisData) {
      res.json({ analysis: analysisData });
    } else {
      res.json({ analysis: result.text });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'analyse IA";
    console.error("AI /project-analysis error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/generate-ticket", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { title, backlogId } = req.body as GenerateTicketBody;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Le titre est requis" });
    }

    let projectName: string | undefined;
    let projectDescription: string | undefined;
    let backlogName: string | undefined;

    if (backlogId) {
      const [backlog] = await db
        .select()
        .from(backlogs)
        .where(and(eq(backlogs.id, backlogId), eq(backlogs.accountId, accountId)));
      if (backlog) {
        backlogName = backlog.name;
        if (backlog.projectId) {
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, backlog.projectId));
          if (project) {
            projectName = project.name;
            projectDescription = project.description ?? undefined;
          }
        }
      }
    }

    const result = await runAi({
      type: "generateTicket",
      provider: "auto",
      context: {
        content: title,
        promptContext: {
          projectName,
          projectDescription,
          backlogName,
        },
      },
    });

    // Parse the JSON response
    let ticketData: {
      description?: string;
      acceptanceCriteria?: string;
      nonRegression?: string;
      successMetrics?: string;
    } | null = null;

    try {
      ticketData = JSON.parse(result.text);
    } catch {
      // If parsing fails, return as plain text
      return res.json({ result: result.text });
    }

    res.json({ ticket: ticketData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de génération du ticket";
    console.error("AI /generate-ticket error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/extract-actions", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { noteId } = req.body as ExtractActionsBody;

    if (!noteId) {
      return res.status(400).json({ error: "noteId est requis" });
    }

    const note = await storage.getNote(noteId);
    if (!note || note.accountId !== accountId) {
      return res.status(404).json({ error: "Note introuvable" });
    }

    const text = typeof note.content === "string"
      ? note.content
      : extractTextFromProseMirror(note.content);

    if (!text.trim()) {
      return res.status(400).json({ error: "La note est vide" });
    }

    // Get available projects for context
    const projects = await storage.getProjectsByAccountId(accountId);
    const projectList = projects.map(p => ({ id: p.id, name: p.name }));

    // Determine note context for project suggestion
    const noteContext = await buildNoteContext(accountId, noteId);

    const result = await runAi({
      type: "extractActions",
      provider: "auto",
      context: {
        content: text,
        promptContext: {
          title: noteContext?.title,
          projects: projectList,
        },
      },
    });

    // Parse enriched actions
    let actions: { title: string; priority: string; suggestedProjectId: string | null }[] = [];
    try {
      const parsed = JSON.parse(result.text);
      if (Array.isArray(parsed.actions)) {
        actions = parsed.actions.map((a: any) => ({
          title: typeof a === "string" ? a : (a.title ?? ""),
          priority: a.priority ?? "medium",
          suggestedProjectId: a.suggestedProjectId ?? null,
        }));
      }
    } catch {
      // fallback - empty
    }

    res.json({ actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur d'extraction des actions";
    console.error("AI /extract-actions error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/summarize", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { content, title, type = "note", noteId, documentId } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    let noteOrDocCtx: { type: "note" | "document"; title: string; contentType?: string; status?: string; createdAt?: string; date?: string } | undefined;

    if (noteId) {
      const noteCtx = await buildNoteContext(accountId, noteId);
      if (noteCtx) {
        noteOrDocCtx = {
          type: "note",
          title: noteCtx.title,
          contentType: noteCtx.type ?? undefined,
          status: noteCtx.status,
          createdAt: noteCtx.createdAt,
          date: noteCtx.noteDate,
        };
      }
    } else if (documentId) {
      const docCtx = await buildDocumentContext(accountId, documentId);
      if (docCtx) {
        noteOrDocCtx = {
          type: "document",
          title: docCtx.name,
          contentType: docCtx.sourceType,
          status: docCtx.status,
          createdAt: docCtx.createdAt,
          date: docCtx.documentDate,
        };
      }
    }

    const effectiveTitle = noteOrDocCtx?.title ?? title;

    const result = await runAi({
      type: "summarize",
      provider: "auto",
      context: {
        content: text,
        promptContext: { type, title: effectiveTitle },
        noteOrDocument: noteOrDocCtx,
      },
    });

    res.json({ result: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de la synthèse IA";
    console.error("AI /summarize error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/improve", async (req: Request, res: Response) => {
  try {
    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const result = await runAi({
      type: "improve",
      provider: "auto",
      context: {
        content: text,
        promptContext: { type, title },
      },
    });

    res.json({ result: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'amélioration IA";
    console.error("AI /improve error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId!;
    const { content, title, type = "note", noteId, documentId } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    let noteOrDocCtx: { type: "note" | "document"; title: string; contentType?: string; status?: string; createdAt?: string; date?: string } | undefined;

    if (noteId) {
      const noteCtx = await buildNoteContext(accountId, noteId);
      if (noteCtx) {
        noteOrDocCtx = {
          type: "note",
          title: noteCtx.title,
          contentType: noteCtx.type ?? undefined,
          status: noteCtx.status,
          createdAt: noteCtx.createdAt,
          date: noteCtx.noteDate,
        };
      }
    } else if (documentId) {
      const docCtx = await buildDocumentContext(accountId, documentId);
      if (docCtx) {
        noteOrDocCtx = {
          type: "document",
          title: docCtx.name,
          contentType: docCtx.sourceType,
          status: docCtx.status,
          createdAt: docCtx.createdAt,
          date: docCtx.documentDate,
        };
      }
    }

    const effectiveTitle = noteOrDocCtx?.title ?? title;

    const result = await runAi({
      type: "recommendations",
      provider: "auto",
      context: {
        content: text,
        promptContext: { type, title: effectiveTitle },
        noteOrDocument: noteOrDocCtx,
      },
    });

    res.json({ result: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur des recommandations IA";
    console.error("AI /recommendations error:", err);
    res.status(503).json({ error: message });
  }
});

export default router;
