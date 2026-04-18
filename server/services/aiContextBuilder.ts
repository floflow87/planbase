import { storage } from "../storage";
import { generateProfitabilityAnalysis } from "./profitabilityService";

export interface ProjectAiContext {
  id: string;
  name: string;
  description?: string;
  category?: string;
  stage?: string;
  priority?: string;
  budget?: number;
  totalBilled?: number;
  margin?: number;
  marginPercent?: number;
  targetTJM?: number;
  actualTJM?: number;
  timeConsumedHours?: number;
  theoreticalDays?: number;
  budgetConsumedPercent?: number;
  taskCounts: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
  scopeItems: {
    total: number;
    completed: number;
    titles: string[];
  };
  healthScore?: number;
  profitabilityStatus?: string;
}

export interface ClientAiContext {
  id: string;
  name: string;
  type?: string;
  status?: string;
  budget?: number;
  recentActivities: {
    kind: string;
    description?: string;
    occurredAt?: string;
  }[];
  linkedProjects: {
    id: string;
    name: string;
    stage?: string;
    budget?: number;
  }[];
  contacts: {
    fullName: string;
    position?: string;
    email?: string;
    isPrimary: boolean;
  }[];
  activeDeals: {
    title: string;
    value?: number;
    stage: string;
  }[];
}

export interface NoteAiContext {
  id: string;
  title: string;
  type?: string;
  status?: string;
  createdAt: string;
  noteDate?: string;
}

export interface DocumentAiContext {
  id: string;
  name: string;
  sourceType?: string;
  status?: string;
  version?: number;
  documentDate?: string;
  createdAt: string;
}

export async function buildProjectContext(
  accountId: string,
  projectId: string
): Promise<ProjectAiContext | null> {
  const project = await storage.getProject(projectId);
  if (!project || project.accountId !== accountId) return null;

  const [timeEntries, payments, tasks, scopeItems, globalTJMSetting] =
    await Promise.all([
      storage.getTimeEntriesByProjectId(accountId, projectId),
      storage.getPaymentsByProjectId(projectId),
      storage.getTasksByProjectId(projectId),
      storage.getScopeItemsByProjectId(projectId),
      storage.getSetting("ACCOUNT", accountId, "billing.defaultTJM"),
    ]);

  const globalTJM = globalTJMSetting?.value
    ? parseFloat(String(globalTJMSetting.value))
    : undefined;

  const analysis = generateProfitabilityAnalysis(
    project,
    timeEntries,
    payments,
    globalTJM
  );
  const { metrics, healthScore } = analysis;

  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now
  );

  const taskCounts = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: overdueTasks.length,
  };

  const completedScopeItems = scopeItems.filter(
    (s) => s.status === "done" || s.status === "validated"
  );

  const budgetConsumedPercent =
    metrics.theoreticalDays > 0 && metrics.actualDaysWorked > 0
      ? Math.round((metrics.actualDaysWorked / metrics.theoreticalDays) * 100)
      : undefined;

  return {
    id: projectId,
    name: project.name,
    description: project.description ?? undefined,
    category: project.category ?? undefined,
    stage: project.stage ?? undefined,
    priority: project.priority ?? undefined,
    budget: project.budget
      ? parseFloat(project.budget.toString())
      : undefined,
    totalBilled: metrics.totalBilled > 0 ? metrics.totalBilled : undefined,
    margin: metrics.margin !== 0 ? metrics.margin : undefined,
    marginPercent: metrics.marginPercent,
    targetTJM: metrics.targetTJM > 0 ? metrics.targetTJM : undefined,
    actualTJM: metrics.actualTJM > 0 ? metrics.actualTJM : undefined,
    timeConsumedHours:
      metrics.actualDaysWorked > 0
        ? Math.round(metrics.actualDaysWorked * 8 * 10) / 10
        : undefined,
    theoreticalDays:
      metrics.theoreticalDays > 0 ? metrics.theoreticalDays : undefined,
    budgetConsumedPercent,
    taskCounts,
    scopeItems: {
      total: scopeItems.length,
      completed: completedScopeItems.length,
      titles: scopeItems
        .slice(0, 5)
        .map((s) => s.title)
        .filter((t): t is string => Boolean(t)),
    },
    healthScore,
    profitabilityStatus: metrics.statusLabel,
  };
}

export async function buildClientContext(
  accountId: string,
  clientId: string
): Promise<ClientAiContext | null> {
  const client = await storage.getClient(accountId, clientId);
  if (!client) return null;

  const [activities, allProjects, contacts, allDeals] = await Promise.all([
    storage.getActivitiesBySubject(accountId, "client", clientId),
    storage.getProjectsByAccountId(accountId),
    storage.getContactsByClientId(accountId, clientId),
    storage.getDealsByAccountId(accountId),
  ]);

  const linkedProjects = allProjects
    .filter((p) => p.clientId === clientId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage ?? undefined,
      budget: p.budget ? parseFloat(p.budget.toString()) : undefined,
    }));

  const activeDeals = allDeals
    .filter((d) => d.clientId === clientId && d.stage !== "lost")
    .map((d) => ({
      title: d.title,
      value: d.value ? parseFloat(d.value.toString()) : undefined,
      stage: d.stage,
    }));

  const recentActivities = activities
    .sort((a, b) => {
      const dateA = a.occurredAt
        ? new Date(a.occurredAt).getTime()
        : new Date(a.createdAt).getTime();
      const dateB = b.occurredAt
        ? new Date(b.occurredAt).getTime()
        : new Date(b.createdAt).getTime();
      return dateB - dateA;
    })
    .slice(0, 10)
    .map((a) => ({
      kind: a.kind,
      description: a.description ?? undefined,
      occurredAt: a.occurredAt
        ? new Date(a.occurredAt).toLocaleDateString("fr-FR")
        : undefined,
    }));

  return {
    id: clientId,
    name: client.name,
    type: client.type,
    status: client.status,
    budget: client.budget ? parseFloat(client.budget.toString()) : undefined,
    recentActivities,
    linkedProjects,
    contacts: contacts.map((c) => ({
      fullName: c.fullName,
      position: c.position ?? undefined,
      email: c.email ?? undefined,
      isPrimary: c.isPrimary === 1,
    })),
    activeDeals,
  };
}

export async function buildNoteContext(
  accountId: string,
  noteId: string
): Promise<NoteAiContext | null> {
  const note = await storage.getNote(noteId);
  if (!note || note.accountId !== accountId) return null;

  return {
    id: noteId,
    title: note.title,
    type: note.type ?? undefined,
    status: note.status,
    createdAt: new Date(note.createdAt).toLocaleDateString("fr-FR"),
    noteDate: note.noteDate ?? undefined,
  };
}

export async function buildDocumentContext(
  accountId: string,
  documentId: string
): Promise<DocumentAiContext | null> {
  const document = await storage.getDocument(documentId);
  if (!document || document.accountId !== accountId) return null;

  return {
    id: documentId,
    name: document.name,
    sourceType: document.sourceType,
    status: document.status,
    version: document.version,
    documentDate: document.documentDate ?? undefined,
    createdAt: new Date(document.createdAt).toLocaleDateString("fr-FR"),
  };
}
