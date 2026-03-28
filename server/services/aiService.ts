const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const REQUEST_TIMEOUT_MS = 60000;
const MAX_CONTEXT_LENGTH = 8000;

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n[... contenu tronqué ...]";
}

export interface AiContext {
  user?: { email?: string; plan?: string };
  project?: {
    name?: string;
    description?: string;
    budget?: number | null;
    status?: string;
    timeConsumedHours?: number;
    marginPercent?: number;
  };
  content?: string;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaResponse {
  message?: { content?: string };
  error?: string;
}

export async function callAi(
  prompt: string,
  context?: AiContext
): Promise<string> {
  const systemParts: string[] = [
    "Tu es un assistant expert en gestion de projets freelance et d'agence pour PlanBase, un outil de pilotage business.",
    "Tu réponds en français, de manière concise et structurée.",
    "PlanBase couvre : CRM, projets, tâches, notes, documents, rentabilité, trésorerie, roadmap produit, ressources.",
  ];

  if (context?.user?.plan) {
    systemParts.push(`Plan utilisateur : ${context.user.plan}.`);
  }

  if (context?.project) {
    const p = context.project;
    systemParts.push(
      `Contexte projet actuel : "${p.name}"${p.description ? ` — ${p.description}` : ""}.` +
        (p.budget != null ? ` Budget : ${p.budget}€.` : "") +
        (p.status ? ` Statut : ${p.status}.` : "") +
        (p.timeConsumedHours != null ? ` Temps consommé : ${p.timeConsumedHours}h.` : "") +
        (p.marginPercent != null ? ` Marge actuelle : ${p.marginPercent.toFixed(1)}%.` : "")
    );
  }

  if (context?.content) {
    const truncated = truncate(context.content, MAX_CONTEXT_LENGTH);
    systemParts.push(`Contenu à analyser :\n${truncated}`);
  }

  const messages: OllamaMessage[] = [
    { role: "system", content: systemParts.join("\n") },
    { role: "user", content: truncate(prompt, 4000) },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${OLLAMA_URL}/api/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 1024,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      if (res.status === 404) {
        throw new Error(
          `Modèle "${OLLAMA_MODEL}" non trouvé sur Ollama. Vérifiez qu'il est installé avec: ollama pull ${OLLAMA_MODEL}`
        );
      }
      throw new Error(`Erreur Ollama (${res.status}) : ${errorText || res.statusText}`);
    }

    const data: OllamaResponse = await res.json();

    if (data.error) {
      throw new Error(`Erreur Ollama : ${data.error}`);
    }

    const content = data.message?.content ?? "";
    if (!content.trim()) {
      throw new Error("L'IA a renvoyé une réponse vide.");
    }

    return content;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Délai d'attente dépassé. L'IA n'a pas répondu dans les 60 secondes.");
    }
    if (err instanceof TypeError && (err as NodeJS.ErrnoException).cause) {
      const cause = (err as NodeJS.ErrnoException).cause as NodeJS.ErrnoException;
      if (cause.code === "ECONNREFUSED") {
        throw new Error(
          `Impossible de se connecter à Ollama (${OLLAMA_URL}). Vérifiez qu'Ollama est démarré.`
        );
      }
    }
    if (err instanceof Error && err.message.startsWith("Erreur Ollama")) {
      throw err;
    }
    if (err instanceof Error && (err.message.includes("Modèle") || err.message.includes("Délai") || err.message.includes("Impossible"))) {
      throw err;
    }
    if (err instanceof Error) {
      throw new Error(`Erreur de connexion à Ollama : ${err.message}`);
    }
    throw new Error("Erreur inattendue lors de l'appel à Ollama.");
  } finally {
    clearTimeout(timeout);
  }
}

export function extractTextFromProseMirror(doc: unknown): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  };
  walk(doc);
  return parts.join(" ").trim();
}
