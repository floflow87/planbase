export type PromptType =
  | "summarize"
  | "extractActions"
  | "classifyDocument"
  | "suggestCrmActions"
  | "projectAnalysis"
  | "improve"
  | "recommendations"
  | "generateTicket"
  | "chat";

export interface SummarizeContext {
  type?: "note" | "document";
  title?: string;
}

export interface ExtractActionsContext {
  title?: string;
  projects?: { id: string; name: string }[];
}

export interface SuggestCrmActionsContext {
  clientName: string;
  clientType?: string;
  clientStatus?: string;
  clientBudget?: number | string | null;
}

export interface ProjectAnalysisContext {
  name: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  budget?: number | null;
  totalBilled?: number | null;
  margin?: number | null;
  marginPercent?: number | null;
  targetTJM?: number | null;
  actualTJM?: number | null;
  theoreticalDays?: number | null;
  timeConsumedHours?: number | null;
  budgetConsumedPercent?: number | null;
  healthScore?: number | null;
  profitabilityStatus?: string | null;
  taskCounts?: { total: number; todo: number; inProgress: number; done: number; overdue: number } | null;
  scopeItems?: { total: number; completed: number; titles: string[] } | null;
}

export interface ImproveContext {
  type?: "note" | "document";
  title?: string;
}

export interface RecommendationsContext {
  type?: "note" | "document";
  title?: string;
}

export interface GenerateTicketContext {
  projectName?: string;
  projectDescription?: string;
  backlogName?: string;
}

export interface ClassifyDocumentContext {
  categories?: string[];
}

export const aiPrompts = {
  summarize(ctx: SummarizeContext = {}): string {
    const entityType = ctx.type === "document" ? "document" : "note";
    const titlePart = ctx.title ? ` intitulé(e) "${ctx.title}"` : "";
    return (
      `Tu es un assistant expert en gestion de projets et d'agences pour PlanBase.\n` +
      `Synthétise ce ${entityType}${titlePart} en 3 à 5 points clés sous forme de liste concise.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "summary": "string contenant la synthèse en markdown liste" }`
    );
  },

  extractActions(ctx: ExtractActionsContext = {}): string {
    const titlePart = ctx.title ? ` intitulé "${ctx.title}"` : "";
    const projectsList = ctx.projects && ctx.projects.length > 0
      ? `\nProjets disponibles pour l'assignation : ${ctx.projects.map(p => `${p.id}:${p.name}`).join(", ")}`
      : "";
    return (
      `Tu es un assistant expert en gestion de projets pour PlanBase.\n` +
      `Identifie toutes les actions à réaliser, décisions prises et prochaines étapes dans ce texte${titlePart}.${projectsList}\n` +
      `Pour chaque action, détermine une priorité (low, medium, high) et si possible le projet associé parmi la liste fournie (utilise null si aucun projet ne correspond).\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "actions": [{ "title": "string", "priority": "low|medium|high", "suggestedProjectId": "uuid|null" }] }`
    );
  },

  classifyDocument(ctx: ClassifyDocumentContext = {}): string {
    const categories = ctx.categories ?? ["juridique", "produit", "finance", "technique", "marketing", "autre"];
    const catList = categories.join(", ");
    return (
      `Tu es un assistant expert en classification de documents professionnels pour PlanBase.\n` +
      `Classe ce document dans l'une des catégories suivantes : ${catList}.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "category": "nom_de_la_catégorie" }`
    );
  },

  suggestCrmActions(ctx: SuggestCrmActionsContext): string {
    const budgetPart = ctx.clientBudget != null ? `Budget estimé : ${ctx.clientBudget}€.` : "";
    return (
      `Tu es un assistant CRM expert pour PlanBase, spécialisé dans la relation client pour les freelances et agences.\n` +
      `Sur la base de l'historique du client "${ctx.clientName}" ` +
      `(type : ${ctx.clientType || "N/A"}, statut : ${ctx.clientStatus || "N/A"}${budgetPart ? ", " + budgetPart : ""}), ` +
      `propose 2 à 3 actions concrètes et pertinentes pour entretenir ou développer la relation.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"] }`
    );
  },

  projectAnalysis(ctx: ProjectAnalysisContext): string {
    const taskLine = ctx.taskCounts
      ? `${ctx.taskCounts.total} total (${ctx.taskCounts.inProgress} en cours, ${ctx.taskCounts.overdue} en retard)`
      : "N/A";
    const scopeLine = ctx.scopeItems
      ? `${ctx.scopeItems.completed}/${ctx.scopeItems.total} livrables complétés`
      : "N/A";
    return (
      `Tu es un assistant expert en gestion de projets et rentabilité pour PlanBase.\n` +
      `Analyse ce projet et fournis un diagnostic structuré.\n` +
      `Réponds en français, de manière concise et actionnable.\n\n` +
      `**Données du projet :**\n` +
      `- Nom : ${ctx.name}\n` +
      `- Description : ${ctx.description || "N/A"}\n` +
      `- Catégorie : ${ctx.category || "N/A"}\n` +
      `- Statut : ${ctx.status || "N/A"}\n` +
      (ctx.priority ? `- Priorité : ${ctx.priority}\n` : "") +
      (ctx.profitabilityStatus ? `- Rentabilité : ${ctx.profitabilityStatus}\n` : "") +
      (ctx.healthScore != null ? `- Score de santé : ${ctx.healthScore}/100\n` : "") +
      `- Budget : ${ctx.budget != null ? ctx.budget + "€" : "N/A"}\n` +
      `- Facturé : ${ctx.totalBilled != null ? ctx.totalBilled + "€" : "N/A"}\n` +
      `- Marge : ${ctx.margin != null ? Number(ctx.margin).toFixed(0) + "€" : "N/A"} ` +
      `(${ctx.marginPercent != null ? ctx.marginPercent.toFixed(1) + "%" : "N/A"})\n` +
      (ctx.targetTJM != null ? `- TJM cible : ${ctx.targetTJM}€/j\n` : "") +
      (ctx.actualTJM != null ? `- TJM effectif : ${Number(ctx.actualTJM).toFixed(0)}€/j\n` : "") +
      (ctx.theoreticalDays != null ? `- Jours prévus : ${ctx.theoreticalDays}j\n` : "") +
      `- Temps consommé : ${ctx.timeConsumedHours != null ? ctx.timeConsumedHours + "h" : "N/A"}\n` +
      (ctx.budgetConsumedPercent != null ? `- Taux consommé : ${ctx.budgetConsumedPercent}%\n` : "") +
      `- Tâches : ${taskLine}\n` +
      `- Livrables : ${scopeLine}\n\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "health": "diagnostic de santé financière en markdown", "risks": "risques identifiés en markdown liste", "quickWins": "actions rapides à fort impact en markdown liste", "priorities": "3 actions prioritaires en markdown liste numérotée" }`
    );
  },

  improve(ctx: ImproveContext = {}): string {
    const entityType = ctx.type === "document" ? "document" : "note";
    const titlePart = ctx.title ? ` intitulé(e) "${ctx.title}"` : "";
    return (
      `Tu es un assistant expert en rédaction professionnelle pour PlanBase.\n` +
      `Améliore la clarté, la structure et le style de ce ${entityType}${titlePart}.\n` +
      `Conserve les idées principales. Fournis le texte amélioré directement, sans introduction ni commentaire.\n` +
      `Réponds en français uniquement.`
    );
  },

  recommendations(ctx: RecommendationsContext = {}): string {
    const entityType = ctx.type === "document" ? "document" : "note";
    const titlePart = ctx.title ? ` "${ctx.title}"` : "";
    return (
      `Tu es un assistant expert en gestion de projets pour PlanBase.\n` +
      `En te basant sur ce ${entityType}${titlePart}, fournis 3 à 5 recommandations concrètes et actionnables ` +
      `pour améliorer la situation ou faire avancer le projet.\n` +
      `Réponds en français uniquement. Format : liste numérotée en markdown.`
    );
  },

  generateTicket(ctx: GenerateTicketContext = {}): string {
    const projectPart = ctx.projectName
      ? ` dans le projet "${ctx.projectName}"${ctx.projectDescription ? ` (${ctx.projectDescription})` : ""}`
      : "";
    const backlogPart = ctx.backlogName ? ` (backlog : ${ctx.backlogName})` : "";
    return (
      `Tu es un assistant expert en gestion de produit et backlog pour PlanBase.\n` +
      `Génère un ticket structuré et actionnable${projectPart}${backlogPart} à partir du titre fourni.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "description": "description fonctionnelle claire de la fonctionnalité (2-4 phrases)", "acceptanceCriteria": "critères d'acceptation en liste markdown (3-5 points)", "nonRegression": "scénarios de non-régression en liste markdown (2-3 points)", "successMetrics": "métriques de succès mesurables en liste markdown (2-3 points)" }`
    );
  },

  chat(ctx?: { semanticContext?: string }): string {
    let base =
      `Tu es un assistant expert en gestion de projets freelance et d'agence pour PlanBase, un outil de pilotage business.\n` +
      `Tu réponds en français, de manière concise et structurée.\n` +
      `PlanBase couvre : CRM, projets, tâches, notes, documents, rentabilité, trésorerie, roadmap produit, ressources.`;

    if (ctx?.semanticContext) {
      base +=
        `\n\n---\nContexte pertinent issu des notes de l'organisation (utilise ces informations pour répondre précisément) :\n` +
        ctx.semanticContext +
        `\n---`;
    }

    return base;
  },
};
