import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAiAccess } from "../middleware/aiAccess";
import { extractTextFromProseMirror } from "../services/aiService";
import { runAi } from "../services/aiOrchestrator";

const router = Router();

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

router.post("/chat", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
  try {
    const { message, projectContext } = req.body as ChatRequestBody;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Le message est requis" });
    }

    const result = await runAi({
      type: "chat",
      provider: "ollama",
      context: {
        content: message,
        project: projectContext,
      },
    });

    res.json({ response: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'assistant IA";
    console.error("AI /chat error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/project-analysis", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
  try {
    const { project } = req.body as ProjectAnalysisBody;

    if (!project?.name) {
      return res.status(400).json({ error: "Les données projet sont requises" });
    }

    const result = await runAi({
      type: "projectAnalysis",
      provider: "auto",
      context: {
        promptContext: {
          name: project.name,
          description: project.description,
          category: project.category,
          status: project.status,
          budget: project.budget,
          totalBilled: project.totalBilled,
          margin: project.margin,
          marginPercent: project.marginPercent,
          timeConsumedHours: project.timeConsumedHours,
        },
        project: {
          name: project.name,
          description: project.description,
          budget: project.budget,
          status: project.status,
          timeConsumedHours: project.timeConsumedHours,
          marginPercent: project.marginPercent,
        },
      },
    });

    res.json({ analysis: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de l'analyse IA";
    console.error("AI /project-analysis error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/summarize", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
  try {
    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const result = await runAi({
      type: "summarize",
      provider: "auto",
      context: {
        content: text,
        promptContext: { type, title },
      },
    });

    res.json({ result: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de la synthèse IA";
    console.error("AI /summarize error:", err);
    res.status(503).json({ error: message });
  }
});

router.post("/improve", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
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

router.post("/recommendations", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
  try {
    const { content, title, type = "note" } = req.body as ContentRequestBody;

    const text = typeof content === "string" ? content : extractTextFromProseMirror(content);

    if (!text.trim()) {
      return res.status(400).json({ error: "Le contenu est vide" });
    }

    const result = await runAi({
      type: "recommendations",
      provider: "auto",
      context: {
        content: text,
        promptContext: { type, title },
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
