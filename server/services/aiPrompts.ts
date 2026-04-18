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
    return (
      `Tu es un assistant expert en gestion de projets pour PlanBase.\n` +
      `Identifie toutes les actions à réaliser, décisions prises et prochaines étapes dans ce texte${titlePart}.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "actions": ["action 1", "action 2", "action 3"] }`
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
      `Analyse ce projet et fournis un diagnostic structuré en 4 sections.\n` +
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
      `**Sections attendues (en markdown) :**\n` +
      `1. **Diagnostic de rentabilité** : évalue la santé financière du projet.\n` +
      `2. **Risques identifiés** : liste les risques majeurs (dépassement budget, marge insuffisante, tâches en retard, etc.).\n` +
      `3. **Quick wins** : actions rapides à fort impact pour améliorer la situation.\n` +
      `4. **Priorités recommandées** : 3 actions prioritaires à mener maintenant.`
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
    return (
      `Tu es un assistant expert en gestion de projets pour PlanBase.\n` +
      `Génère un ticket de tâche structuré et actionnable${projectPart} à partir de la description fournie.\n` +
      `Réponds en français uniquement.\n` +
      `Réponds exclusivement en JSON valide avec ce format :\n` +
      `{ "title": "string", "description": "string", "priority": "low|medium|high", "estimatedHours": number|null }`
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
