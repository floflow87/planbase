import { db } from "../db";
import { storage } from "../storage";
import {
  backlogs,
  epics,
  userStories,
  roadmaps,
  roadmapItems,
  projectScopeItems,
  type ProjectScopeItem,
} from "@shared/schema";
import { eq } from "drizzle-orm";

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

type PhaseOrder = { [key: string]: number };

const PHASE_ORDER: PhaseOrder = {
  'T1': 1,
  'T2': 2,
  'T3': 3,
  'T4': 4,
  'LT': 5,
};

const SCOPE_TYPE_COLORS: { [key: string]: string } = {
  'functional': '#8B5CF6',
  'technical': '#06B6D4',
  'design': '#F59E0B',
  'gestion': '#10B981',
  'strategy': '#3B82F6',
  'autre': '#6B7280',
};

const SCOPE_TYPE_LABELS: { [key: string]: string } = {
  'functional': 'Fonctionnel',
  'technical': 'Technique',
  'design': 'Design',
  'gestion': 'Gestion de projet',
  'strategy': 'Stratégie',
  'autre': 'Autre',
};

export async function generateBacklogFromCdc(
  accountId: string,
  projectId: string,
  scopeItems: ProjectScopeItem[],
  createdBy: string
): Promise<string> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const [backlog] = await db.insert(backlogs).values({
    accountId,
    projectId,
    name: `CDC - ${project.name}`,
    description: `Backlog généré à partir du Cahier des Charges de ${project.name}`,
    mode: 'kanban',
    createdBy,
  }).returning();

  await storage.createActivity({
    accountId,
    subjectType: "backlog",
    subjectId: backlog.id,
    kind: "created",
    payload: { description: `Backlog généré depuis CDC: ${backlog.name}` },
    createdBy,
  });

  const scopeTypeGroups = groupByField(scopeItems, 'scopeType');
  
  let epicOrder = 0;
  for (const [scopeType, items] of Object.entries(scopeTypeGroups)) {
    const epicTitle = SCOPE_TYPE_LABELS[scopeType] || scopeType;
    const epicColor = SCOPE_TYPE_COLORS[scopeType] || '#6B7280';
    
    const [epic] = await db.insert(epics).values({
      accountId,
      backlogId: backlog.id,
      title: epicTitle,
      description: `Fonctionnalités ${epicTitle.toLowerCase()} issues du CDC`,
      color: epicColor,
      order: epicOrder++,
      state: 'a_faire',
      createdBy,
    }).returning();

    let storyOrder = 0;
    for (const item of items) {
      const [story] = await db.insert(userStories).values({
        accountId,
        backlogId: backlog.id,
        epicId: epic.id,
        title: item.label,
        description: item.description || '',
        state: 'a_faire',
        priority: item.isOptional ? 'low' : 'medium',
        storyPoints: estimateDaysToPoints(item.estimatedDays),
        order: storyOrder++,
        createdBy,
      }).returning();

      await db.update(projectScopeItems)
        .set({ generatedUserStoryId: story.id })
        .where(eq(projectScopeItems.id, item.id));
    }

    for (const item of items.filter(i => !i.generatedEpicId)) {
      await db.update(projectScopeItems)
        .set({ generatedEpicId: epic.id })
        .where(eq(projectScopeItems.id, item.id));
    }
  }

  return backlog.id;
}

export async function generateRoadmapFromCdc(
  accountId: string,
  projectId: string,
  scopeItems: ProjectScopeItem[],
  createdBy: string
): Promise<string> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const [roadmap] = await db.insert(roadmaps).values({
    accountId,
    projectId,
    name: `Roadmap - ${project.name}`,
    description: `Roadmap générée à partir du CDC de ${project.name}`,
    viewMode: 'quarter',
    createdBy,
  }).returning();

  await storage.createActivity({
    accountId,
    subjectType: "roadmap",
    subjectId: roadmap.id,
    kind: "created",
    payload: { description: `Roadmap générée depuis CDC: ${roadmap.name}` },
    createdBy,
  });

  const phaseGroups = groupByField(scopeItems.filter(i => i.phase), 'phase');
  const noPhaseItems = scopeItems.filter(i => !i.phase);

  const sortedPhases = Object.keys(phaseGroups).sort((a, b) => {
    return (PHASE_ORDER[a] || 99) - (PHASE_ORDER[b] || 99);
  });

  const baseDate = project.startDate ? new Date(project.startDate) : new Date();
  let currentRow = 0;
  
  for (const phase of sortedPhases) {
    const items = phaseGroups[phase];
    const phaseStart = calculatePhaseStartDate(baseDate, phase);
    const phaseEnd = calculatePhaseEndDate(phaseStart, items);

    for (const item of items) {
      const durationDays = parseFloat(item.estimatedDays?.toString() || '1') || 1;
      const itemEnd = new Date(phaseStart);
      itemEnd.setDate(itemEnd.getDate() + Math.ceil(durationDays));

      const color = SCOPE_TYPE_COLORS[item.scopeType] || '#6B7280';
      
      const [roadmapItem] = await db.insert(roadmapItems).values({
        roadmapId: roadmap.id,
        projectId,
        title: item.label,
        description: item.description || '',
        startDate: formatDateString(phaseStart),
        endDate: formatDateString(itemEnd),
        color,
        progress: 0,
        orderIndex: currentRow++,
      }).returning();

      await db.update(projectScopeItems)
        .set({ generatedRoadmapItemId: roadmapItem.id })
        .where(eq(projectScopeItems.id, item.id));
    }
  }

  if (noPhaseItems.length > 0) {
    const lastPhaseEnd = calculatePhaseStartDate(baseDate, 'LT');
    for (const item of noPhaseItems) {
      const durationDays = parseFloat(item.estimatedDays?.toString() || '1') || 1;
      const itemEnd = new Date(lastPhaseEnd);
      itemEnd.setDate(itemEnd.getDate() + Math.ceil(durationDays));

      const color = SCOPE_TYPE_COLORS[item.scopeType] || '#6B7280';
      
      const [roadmapItem] = await db.insert(roadmapItems).values({
        roadmapId: roadmap.id,
        projectId,
        title: item.label,
        description: item.description || '',
        startDate: formatDateString(lastPhaseEnd),
        endDate: formatDateString(itemEnd),
        color,
        progress: 0,
        orderIndex: currentRow++,
      }).returning();

      await db.update(projectScopeItems)
        .set({ generatedRoadmapItemId: roadmapItem.id })
        .where(eq(projectScopeItems.id, item.id));
    }
  }

  return roadmap.id;
}

function groupByField<T>(items: T[], field: keyof T): { [key: string]: T[] } {
  return items.reduce((acc, item) => {
    const key = String(item[field] || 'other');
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as { [key: string]: T[] });
}

function estimateDaysToPoints(days: string | null | undefined): number {
  const d = parseFloat(days?.toString() || '0');
  if (d <= 0.5) return 1;
  if (d <= 1) return 2;
  if (d <= 2) return 3;
  if (d <= 3) return 5;
  if (d <= 5) return 8;
  return 13;
}

function calculatePhaseStartDate(baseDate: Date, phase: string): Date {
  const date = new Date(baseDate);
  const monthOffset = {
    'T1': 0,
    'T2': 3,
    'T3': 6,
    'T4': 9,
    'LT': 12,
  }[phase] || 0;
  
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function calculatePhaseEndDate(startDate: Date, items: ProjectScopeItem[]): Date {
  const totalDays = items.reduce((sum, item) => {
    return sum + (parseFloat(item.estimatedDays?.toString() || '0') || 0);
  }, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.ceil(totalDays) + 7);
  return endDate;
}
