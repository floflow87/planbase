import { db } from "../db";
import { storage } from "../storage";
import {
  backlogs,
  epics,
  userStories,
  roadmaps,
  roadmapItems,
  projectScopeItems,
  okrObjectives,
  okrKeyResults,
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
  createdBy: string,
  cdcSessionId?: string
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
    mode: 'scrum',
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
      cdcSessionId,
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

const PHASE_TO_LANE: Record<string, string> = {
  'T1': 'now',
  'T2': 'next',
  'T3': 'later',
  'T4': 'later',
  'LT': 'later',
};

export async function generateRoadmapFromCdc(
  accountId: string,
  projectId: string,
  scopeItems: ProjectScopeItem[],
  createdBy: string,
  roadmapType: string = 'feature_based'
): Promise<string> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const isNnl = roadmapType === 'now_next_later';

  const [roadmap] = await db.insert(roadmaps).values({
    accountId,
    projectId,
    name: `Roadmap - ${project.name}`,
    description: `Roadmap générée à partir du CDC de ${project.name}`,
    viewMode: isNnl ? 'nnl' : 'quarter',
    type: roadmapType,
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

    for (const item of items) {
      const durationDays = parseFloat(item.estimatedDays?.toString() || '1') || 1;
      const itemEnd = new Date(phaseStart);
      itemEnd.setDate(itemEnd.getDate() + Math.ceil(durationDays));

      const color = SCOPE_TYPE_COLORS[item.scopeType] || '#6B7280';
      
      const values: any = {
        roadmapId: roadmap.id,
        projectId,
        title: item.label,
        description: item.description || '',
        color,
        progress: 0,
        orderIndex: currentRow++,
        phase: phase,
      };

      if (isNnl) {
        values.lane = PHASE_TO_LANE[phase] || 'later';
      } else {
        values.startDate = formatDateString(phaseStart);
        values.endDate = formatDateString(itemEnd);
      }
      
      const [roadmapItem] = await db.insert(roadmapItems).values(values).returning();

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
      
      const values: any = {
        roadmapId: roadmap.id,
        projectId,
        title: item.label,
        description: item.description || '',
        color,
        progress: 0,
        orderIndex: currentRow++,
        phase: 'LT',
      };

      if (isNnl) {
        values.lane = 'later';
      } else {
        values.startDate = formatDateString(lastPhaseEnd);
        values.endDate = formatDateString(itemEnd);
      }
      
      const [roadmapItem] = await db.insert(roadmapItems).values(values).returning();

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

interface OkrTemplate {
  type: 'business' | 'product' | 'marketing';
  title: string;
  description: string;
  targetPhase: 'T1' | 'T2' | 'T3' | 'LT';
  keyResults: {
    title: string;
    metricType: 'delivery' | 'time' | 'margin' | 'adoption' | 'volume';
    targetValue: number;
    unit: string;
  }[];
}

const OKR_TEMPLATES_BY_PROJECT_TYPE: Record<string, OkrTemplate[]> = {
  dev_saas: [
    {
      type: 'product',
      title: 'Livrer le MVP fonctionnel',
      description: 'Atteindre un produit minimum viable avec les fonctionnalités core',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Fonctionnalités core livrées', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Tests automatisés en place', metricType: 'delivery', targetValue: 80, unit: '%' },
        { title: 'Documentation technique', metricType: 'delivery', targetValue: 100, unit: '%' },
      ],
    },
    {
      type: 'business',
      title: 'Préparer le lancement commercial',
      description: 'Mettre en place les éléments pour le go-to-market',
      targetPhase: 'T2',
      keyResults: [
        { title: 'Beta testeurs actifs', metricType: 'volume', targetValue: 10, unit: 'utilisateurs' },
        { title: 'Taux de satisfaction beta', metricType: 'adoption', targetValue: 80, unit: '%' },
        { title: 'Bugs critiques résolus', metricType: 'delivery', targetValue: 100, unit: '%' },
      ],
    },
  ],
  design: [
    {
      type: 'product',
      title: 'Livrer les livrables design validés',
      description: 'Produire et faire valider tous les livrables graphiques',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Maquettes validées', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Design system documenté', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Temps de révision', metricType: 'time', targetValue: 3, unit: 'jours' },
      ],
    },
    {
      type: 'business',
      title: 'Garantir la satisfaction client',
      description: 'Assurer une expérience client fluide et professionnelle',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Taux de satisfaction client', metricType: 'adoption', targetValue: 90, unit: '%' },
        { title: 'Respect du planning initial', metricType: 'time', targetValue: 100, unit: '%' },
      ],
    },
  ],
  conseil: [
    {
      type: 'business',
      title: 'Livrer les recommandations stratégiques',
      description: 'Fournir un livrable actionnable de qualité',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Livrables validés par le client', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Actions prioritaires identifiées', metricType: 'delivery', targetValue: 5, unit: 'actions' },
        { title: 'Satisfaction client', metricType: 'adoption', targetValue: 90, unit: '%' },
      ],
    },
    {
      type: 'product',
      title: 'Accompagner la mise en oeuvre',
      description: 'Supporter le client dans l\'exécution des recommandations',
      targetPhase: 'T2',
      keyResults: [
        { title: 'Sessions de suivi réalisées', metricType: 'volume', targetValue: 4, unit: 'sessions' },
        { title: 'Recommandations mises en oeuvre', metricType: 'delivery', targetValue: 80, unit: '%' },
      ],
    },
  ],
  ecommerce: [
    {
      type: 'product',
      title: 'Mettre en ligne la boutique',
      description: 'Lancer le site e-commerce avec toutes les fonctionnalités',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Pages produits publiées', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Tunnel de paiement fonctionnel', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Performance PageSpeed', metricType: 'delivery', targetValue: 80, unit: 'score' },
      ],
    },
    {
      type: 'marketing',
      title: 'Optimiser la conversion',
      description: 'Améliorer les indicateurs de conversion du site',
      targetPhase: 'T2',
      keyResults: [
        { title: 'Taux de conversion', metricType: 'adoption', targetValue: 3, unit: '%' },
        { title: 'Panier moyen', metricType: 'margin', targetValue: 100, unit: '€' },
        { title: 'Taux d\'abandon panier', metricType: 'adoption', targetValue: 30, unit: '%' },
      ],
    },
  ],
  site_vitrine: [
    {
      type: 'product',
      title: 'Livrer le site vitrine',
      description: 'Mettre en ligne le site avec tout le contenu',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Pages livrées', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'SEO optimisé', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Responsive mobile validé', metricType: 'delivery', targetValue: 100, unit: '%' },
      ],
    },
    {
      type: 'business',
      title: 'Assurer la qualité projet',
      description: 'Garantir le respect des engagements',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Respect du budget', metricType: 'margin', targetValue: 100, unit: '%' },
        { title: 'Respect du planning', metricType: 'time', targetValue: 100, unit: '%' },
        { title: 'Satisfaction client', metricType: 'adoption', targetValue: 90, unit: '%' },
      ],
    },
  ],
  integration: [
    {
      type: 'product',
      title: 'Intégrer les systèmes',
      description: 'Réaliser les intégrations techniques prévues',
      targetPhase: 'T1',
      keyResults: [
        { title: 'API connectées', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Tests d\'intégration passés', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Documentation technique', metricType: 'delivery', targetValue: 100, unit: '%' },
      ],
    },
  ],
  formation: [
    {
      type: 'product',
      title: 'Dispenser la formation',
      description: 'Réaliser les sessions de formation prévues',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Modules délivrés', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Participants formés', metricType: 'volume', targetValue: 10, unit: 'personnes' },
        { title: 'Taux de satisfaction', metricType: 'adoption', targetValue: 85, unit: '%' },
      ],
    },
  ],
  cpo: [
    {
      type: 'product',
      title: 'Définir la vision produit',
      description: 'Établir une roadmap produit claire et priorisée',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Vision produit documentée', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Backlog priorisé', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'KPIs produit définis', metricType: 'delivery', targetValue: 5, unit: 'KPIs' },
      ],
    },
    {
      type: 'business',
      title: 'Aligner les parties prenantes',
      description: 'Assurer l\'adhésion des stakeholders à la vision',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Stakeholders alignés', metricType: 'adoption', targetValue: 100, unit: '%' },
        { title: 'Décisions documentées', metricType: 'delivery', targetValue: 100, unit: '%' },
      ],
    },
  ],
  autre: [
    {
      type: 'business',
      title: 'Livrer le projet avec succès',
      description: 'Atteindre les objectifs définis dans le périmètre',
      targetPhase: 'T1',
      keyResults: [
        { title: 'Livrables validés', metricType: 'delivery', targetValue: 100, unit: '%' },
        { title: 'Respect du planning', metricType: 'time', targetValue: 100, unit: '%' },
        { title: 'Satisfaction client', metricType: 'adoption', targetValue: 85, unit: '%' },
      ],
    },
  ],
};

export async function generateOkrFromCdc(
  accountId: string,
  projectId: string,
  projectType: string,
  createdBy: string
): Promise<number> {
  const templates = OKR_TEMPLATES_BY_PROJECT_TYPE[projectType] || OKR_TEMPLATES_BY_PROJECT_TYPE['autre'];
  
  let objectivesCount = 0;
  
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    
    const [objective] = await db.insert(okrObjectives).values({
      accountId,
      projectId,
      title: template.title,
      description: template.description,
      type: template.type,
      targetPhase: template.targetPhase,
      status: 'on_track',
      progress: 0,
      position: i,
      createdBy,
    }).returning();
    
    objectivesCount++;
    
    for (let j = 0; j < template.keyResults.length; j++) {
      const kr = template.keyResults[j];
      
      await db.insert(okrKeyResults).values({
        accountId,
        objectiveId: objective.id,
        title: kr.title,
        metricType: kr.metricType,
        targetValue: kr.targetValue,
        currentValue: 0,
        unit: kr.unit,
        status: 'on_track',
        weight: 1,
        position: j,
      });
    }
  }
  
  await storage.createActivity({
    accountId,
    subjectType: "project",
    subjectId: projectId,
    kind: "updated",
    payload: { description: `${objectivesCount} OKR générés depuis le CDC` },
    createdBy,
  });
  
  return objectivesCount;
}
