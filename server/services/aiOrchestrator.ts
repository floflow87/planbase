import OpenAI from "openai";
import { callAi, AiContext } from "./aiService";
import { aiPrompts, PromptType } from "./aiPrompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type AiProvider = "openai" | "ollama" | "auto";

export interface RunAiOptions {
  type: PromptType;
  context: {
    content?: string;
    promptContext?: Record<string, unknown>;
    userPlan?: string;
    project?: AiContext["project"];
    noteOrDocument?: AiContext["noteOrDocument"];
    semanticContext?: string;
  };
  provider?: AiProvider;
}

export interface RunAiResult {
  text: string;
  data?: Record<string, unknown>;
  provider: "openai" | "ollama";
}

const OPENAI_STRUCTURED_TYPES: PromptType[] = [
  "extractActions",
  "classifyDocument",
  "suggestCrmActions",
  "generateTicket",
];

const OPENAI_JSON_TYPES: PromptType[] = [
  ...OPENAI_STRUCTURED_TYPES,
  "summarize",
];

function resolveProvider(type: PromptType, requested: AiProvider): "openai" | "ollama" {
  if (requested === "openai") return "openai";
  if (requested === "ollama") return "ollama";

  if (type === "chat") return "ollama";
  if (OPENAI_STRUCTURED_TYPES.includes(type)) return "openai";

  return "openai";
}

function buildSystemPrompt(
  type: PromptType,
  promptContext: Record<string, unknown>,
  semanticContext?: string
): string {
  switch (type) {
    case "summarize":
      return aiPrompts.summarize(promptContext as Parameters<typeof aiPrompts.summarize>[0]);
    case "extractActions":
      return aiPrompts.extractActions(promptContext as Parameters<typeof aiPrompts.extractActions>[0]);
    case "classifyDocument":
      return aiPrompts.classifyDocument(promptContext as Parameters<typeof aiPrompts.classifyDocument>[0]);
    case "suggestCrmActions":
      return aiPrompts.suggestCrmActions(promptContext as Parameters<typeof aiPrompts.suggestCrmActions>[0]);
    case "projectAnalysis":
      return aiPrompts.projectAnalysis(promptContext as Parameters<typeof aiPrompts.projectAnalysis>[0]);
    case "improve":
      return aiPrompts.improve(promptContext as Parameters<typeof aiPrompts.improve>[0]);
    case "recommendations":
      return aiPrompts.recommendations(promptContext as Parameters<typeof aiPrompts.recommendations>[0]);
    case "generateTicket":
      return aiPrompts.generateTicket(promptContext as Parameters<typeof aiPrompts.generateTicket>[0]);
    case "chat":
    default:
      return aiPrompts.chat({ semanticContext });
  }
}

interface ParsedResponse {
  text: string;
  data?: Record<string, unknown>;
}

function parseOpenAiResponse(type: PromptType, raw: string): ParsedResponse {
  if (!OPENAI_JSON_TYPES.includes(type)) return { text: raw };
  try {
    const parsed = JSON.parse(raw);
    if (type === "summarize") {
      const summary: string = parsed.summary ?? raw;
      return { text: summary };
    }
    if (type === "extractActions") {
      const actions: string[] = parsed.actions ?? [];
      return { text: JSON.stringify({ actions }), data: { actions } };
    }
    if (type === "classifyDocument") {
      const category: string = parsed.category ?? "";
      return { text: category, data: { category } };
    }
    if (type === "suggestCrmActions") {
      const suggestions: string[] = parsed.suggestions ?? [];
      return { text: JSON.stringify({ suggestions }), data: { suggestions } };
    }
    if (type === "generateTicket") {
      return { text: JSON.stringify(parsed), data: parsed as Record<string, unknown> };
    }
    return { text: raw };
  } catch {
    return { text: raw };
  }
}

async function callOpenAi(type: PromptType, systemPrompt: string, userContent: string): Promise<ParsedResponse> {
  const useJson = OPENAI_JSON_TYPES.includes(type);

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    ...(useJson ? { response_format: { type: "json_object" as const } } : {}),
    max_completion_tokens: type === "projectAnalysis" ? 1500 : 800,
  });

  const raw = response.choices[0].message.content ?? "";
  return parseOpenAiResponse(type, raw);
}

async function callOllama(
  type: PromptType,
  systemPrompt: string,
  userContent: string,
  aiContext: AiContext
): Promise<string> {
  const fullContext: AiContext = {
    ...aiContext,
    content: userContent,
  };
  const combinedPrompt = systemPrompt + (userContent ? `\n\n${userContent}` : "");
  return callAi(combinedPrompt, fullContext);
}

function classifyOpenAiError(msg: string): string {
  if (msg.includes("quota") || msg.includes("429") || msg.includes("billing")) {
    return "Quota OpenAI dépassé. Veuillez vérifier votre abonnement OpenAI.";
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "Délai d'attente dépassé pour OpenAI. Veuillez réessayer.";
  }
  if (msg.includes("model") || msg.includes("404")) {
    return "Modèle OpenAI indisponible. Veuillez contacter le support.";
  }
  return `Erreur OpenAI : ${msg}`;
}

function isOllamaUnavailable(msg: string): boolean {
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("Impossible de se connecter à Ollama") ||
    msg.includes("Erreur de connexion à Ollama")
  );
}

export async function runAi(options: RunAiOptions): Promise<RunAiResult> {
  const { type, context, provider = "auto" } = options;
  const resolvedProvider = resolveProvider(type, provider);
  const promptContext = context.promptContext ?? {};
  const userContent = context.content ?? "";
  const aiContext: AiContext = {
    user: { plan: context.userPlan },
    project: context.project,
    noteOrDocument: context.noteOrDocument,
    content: userContent,
  };

  const systemPrompt = buildSystemPrompt(type, promptContext, context.semanticContext);

  if (resolvedProvider === "openai") {
    try {
      const { text, data } = await callOpenAi(type, systemPrompt, userContent);
      return { text, data, provider: "openai" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AI Orchestrator] Erreur OpenAI pour type="${type}":`, msg);
      throw new Error(classifyOpenAiError(msg));
    }
  }

  try {
    const text = await callOllama(type, systemPrompt, userContent, aiContext);
    return { text, provider: "ollama" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    if (isOllamaUnavailable(msg)) {
      console.warn(
        `[AI Orchestrator] Ollama indisponible pour type="${type}", bascule sur OpenAI (fallback).`
      );
      try {
        const { text, data } = await callOpenAi(type, systemPrompt, userContent);
        return { text, data, provider: "openai" };
      } catch (fallbackErr: unknown) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error(
          `[AI Orchestrator] Fallback OpenAI également échoué pour type="${type}":`,
          fallbackMsg
        );
        throw new Error(classifyOpenAiError(fallbackMsg));
      }
    }

    const isTimeout = msg.includes("Délai") || msg.includes("AbortError") || msg.includes("60 secondes");
    const isModel = msg.includes("Modèle") && msg.includes("non trouvé");

    if (isTimeout) {
      console.error(`[AI Orchestrator] Timeout Ollama pour type="${type}":`, msg);
      throw new Error("Délai d'attente dépassé. L'IA n'a pas répondu dans les 60 secondes.");
    }
    if (isModel) {
      console.error(`[AI Orchestrator] Modèle Ollama absent pour type="${type}":`, msg);
      throw new Error(msg);
    }

    console.error(`[AI Orchestrator] Erreur Ollama pour type="${type}":`, msg);
    throw new Error(msg);
  }
}
