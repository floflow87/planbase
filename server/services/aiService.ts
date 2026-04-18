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
    totalBilled?: number;
    margin?: number;
    targetTJM?: number;
    actualTJM?: number;
    theoreticalDays?: number;
    budgetConsumedPercent?: number;
    healthScore?: number;
    profitabilityStatus?: string;
    category?: string;
    priority?: string;
    taskCounts?: {
      total: number;
      todo: number;
      inProgress: number;
      done: number;
      overdue: number;
    };
    scopeItems?: {
      total: number;
      completed: number;
      titles: string[];
    };
  };
  client?: {
    name: string;
    type?: string;
    status?: string;
    budget?: number;
    recentActivities?: { kind: string; description?: string; occurredAt?: string }[];
    linkedProjects?: { name: string; stage?: string; budget?: number }[];
    contacts?: { fullName: string; position?: string; isPrimary: boolean }[];
    activeDeals?: { title: string; value?: number; stage: string }[];
  };
  noteOrDocument?: {
    type: "note" | "document";
    title: string;
    contentType?: string;
    status?: string;
    createdAt?: string;
    date?: string;
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
    const projectParts: string[] = [
      `Contexte projet actuel : "${p.name}"${p.description ? ` — ${p.description}` : ""}.`,
    ];
    if (p.category) projectParts.push(`Catégorie : ${p.category}.`);
    if (p.priority) projectParts.push(`Priorité : ${p.priority}.`);
    if (p.status) projectParts.push(`Statut : ${p.status}.`);
    if (p.profitabilityStatus) projectParts.push(`Rentabilité : ${p.profitabilityStatus}.`);
    if (p.budget != null) projectParts.push(`Budget : ${p.budget}€.`);
    if (p.totalBilled != null) projectParts.push(`Montant facturé : ${p.totalBilled}€.`);
    if (p.margin != null) projectParts.push(`Marge : ${p.margin.toFixed(0)}€.`);
    if (p.marginPercent != null) projectParts.push(`Taux de marge : ${p.marginPercent.toFixed(1)}%.`);
    if (p.targetTJM != null) projectParts.push(`TJM cible : ${p.targetTJM}€/j.`);
    if (p.actualTJM != null) projectParts.push(`TJM effectif : ${p.actualTJM.toFixed(0)}€/j.`);
    if (p.theoreticalDays != null) projectParts.push(`Jours prévus : ${p.theoreticalDays}j.`);
    if (p.timeConsumedHours != null) projectParts.push(`Temps consommé : ${p.timeConsumedHours}h.`);
    if (p.budgetConsumedPercent != null) projectParts.push(`Taux consommé : ${p.budgetConsumedPercent}%.`);
    if (p.healthScore != null) projectParts.push(`Score de santé : ${p.healthScore}/100.`);
    if (p.taskCounts) {
      projectParts.push(
        `Tâches : ${p.taskCounts.total} au total (${p.taskCounts.todo} à faire, ${p.taskCounts.inProgress} en cours, ${p.taskCounts.done} terminées${p.taskCounts.overdue > 0 ? `, ${p.taskCounts.overdue} en retard` : ""}).`
      );
    }
    if (p.scopeItems && p.scopeItems.total > 0) {
      projectParts.push(
        `Livrables : ${p.scopeItems.completed}/${p.scopeItems.total} complétés${p.scopeItems.titles.length > 0 ? ` (${p.scopeItems.titles.join(", ")})` : ""}.`
      );
    }
    systemParts.push(projectParts.join(" "));
  }

  if (context?.client) {
    const c = context.client;
    const clientParts: string[] = [
      `Contexte client CRM : "${c.name}" (${c.type ?? "entreprise"}, statut : ${c.status ?? "N/A"}).`,
    ];
    if (c.budget != null) clientParts.push(`Budget client : ${c.budget}€.`);
    if (c.contacts && c.contacts.length > 0) {
      const primaryContact = c.contacts.find((ct) => ct.isPrimary) ?? c.contacts[0];
      clientParts.push(
        `Contact principal : ${primaryContact.fullName}${primaryContact.position ? ` (${primaryContact.position})` : ""}.`
      );
    }
    if (c.linkedProjects && c.linkedProjects.length > 0) {
      clientParts.push(
        `Projets liés : ${c.linkedProjects.map((p) => `${p.name} (${p.stage ?? "N/A"}${p.budget != null ? `, ${p.budget}€` : ""})`).join(", ")}.`
      );
    }
    if (c.activeDeals && c.activeDeals.length > 0) {
      const totalDealsValue = c.activeDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
      clientParts.push(
        `Deals actifs : ${c.activeDeals.length} deal(s) pour ${totalDealsValue.toFixed(0)}€ total.`
      );
    }
    if (c.recentActivities && c.recentActivities.length > 0) {
      const activitySummary = c.recentActivities
        .slice(0, 5)
        .map((a) => `${a.kind}${a.description ? ` : ${a.description}` : ""}${a.occurredAt ? ` (${a.occurredAt})` : ""}`)
        .join("; ");
      clientParts.push(`Derniers échanges : ${activitySummary}.`);
    }
    systemParts.push(clientParts.join(" "));
  }

  if (context?.noteOrDocument) {
    const nd = context.noteOrDocument;
    systemParts.push(
      `Contexte ${nd.type === "document" ? "document" : "note"} : "${nd.title}"` +
        (nd.contentType ? ` (type : ${nd.contentType})` : "") +
        (nd.status ? `, statut : ${nd.status}` : "") +
        (nd.date ? `, date : ${nd.date}` : nd.createdAt ? `, créé le : ${nd.createdAt}` : "") +
        "."
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
