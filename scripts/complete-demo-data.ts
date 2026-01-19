/**
 * Script de complétion des données de démonstration
 * Complète les roadmaps, OKRs et tâches manquantes
 */

import { db } from "../server/db";
import { 
  appUsers, projects, backlogs, sprints, epics,
  roadmaps, roadmapItems, roadmapItemLinks,
  okrObjectives, okrKeyResults, okrLinks,
  tasks, taskColumns
} from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const ACCOUNT_ID = "350c1969-2378-4f97-8c33-3a6ff7ac4f4f";
const USER_ID = "752e4aef-8a1d-4cbb-a659-7281805c1ce7";

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log("🚀 Complétion des données de démonstration...\n");

  // Récupérer les données existantes
  const accountUsers = await db.select().from(appUsers).where(eq(appUsers.accountId, ACCOUNT_ID));
  const existingProjects = await db.select().from(projects).where(eq(projects.accountId, ACCOUNT_ID));
  const existingBacklogs = await db.select().from(backlogs).where(eq(backlogs.accountId, ACCOUNT_ID));
  const existingSprints = await db.select().from(sprints).where(eq(sprints.accountId, ACCOUNT_ID));
  const existingEpics = await db.select().from(epics).where(eq(epics.accountId, ACCOUNT_ID));
  const existingRoadmaps = await db.select().from(roadmaps).where(eq(roadmaps.accountId, ACCOUNT_ID));
  const existingOKRs = await db.select().from(okrObjectives).where(eq(okrObjectives.accountId, ACCOUNT_ID));
  
  const getRandomUser = () => randomChoice(accountUsers);
  console.log(`📊 Projets: ${existingProjects.length}, Backlogs: ${existingBacklogs.length}, Roadmaps: ${existingRoadmaps.length}, OKRs: ${existingOKRs.length}\n`);

  // 1. Créer les Roadmaps si manquantes
  if (existingRoadmaps.length === 0) {
    console.log("🗺️ Création des Roadmaps...");
    
    for (const project of existingProjects.slice(0, 5)) {
      const backlog = existingBacklogs.find(b => b.projectId === project.id);
      const baseDate = new Date(project.startDate || new Date());
      
      const [roadmap] = await db.insert(roadmaps).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        name: `Roadmap - ${project.name}`,
        horizon: "2026-Q2",
        createdBy: USER_ID,
      }).returning();

      // Créer 8 blocs roadmap
      const phases = ["T1", "T2", "T3", "LT"];
      for (let i = 0; i < 8; i++) {
        const phase = phases[Math.floor(i / 2)] || "LT";
        const startDate = addDays(baseDate, i * 30);
        
        await db.insert(roadmapItems).values({
          roadmapId: roadmap.id,
          projectId: project.id,
          title: `Livrable ${i + 1} - ${randomChoice(["Auth", "Dashboard", "API", "Mobile", "Analytics"])}`,
          type: "deliverable",
          phase,
          startDate: formatDate(startDate),
          endDate: formatDate(addDays(startDate, 25)),
          status: i < 2 ? "done" : i < 4 ? "in_progress" : "planned",
          priority: randomChoice(["low", "normal", "high"]),
          progress: i < 2 ? 100 : i < 4 ? randomInt(30, 70) : 0,
          orderIndex: i,
          ownerUserId: getRandomUser().id,
        });
      }

      // 2 milestones
      for (let m = 0; m < 2; m++) {
        await db.insert(roadmapItems).values({
          roadmapId: roadmap.id,
          projectId: project.id,
          title: m === 0 ? "Jalon MVP" : "Jalon Release V1",
          type: "milestone",
          phase: m === 0 ? "T2" : "T3",
          targetDate: formatDate(addDays(baseDate, m === 0 ? 90 : 180)),
          status: m === 0 ? "done" : "planned",
          priority: "high",
          milestoneType: m === 0 ? "DELIVERY" : "VALIDATION",
          isCritical: m === 1,
          orderIndex: 8 + m,
          ownerUserId: getRandomUser().id,
        });
      }
    }
    console.log("✅ Roadmaps créées\n");
  }

  // 2. Créer les OKRs si manquants
  if (existingOKRs.length === 0) {
    console.log("🎯 Création des OKR...");
    
    const projectsWithBacklogs = existingProjects.filter(p => 
      existingBacklogs.some(b => b.projectId === p.id)
    );

    for (const project of projectsWithBacklogs.slice(0, 5)) {
      const backlog = existingBacklogs.find(b => b.projectId === project.id)!;
      const projectSprints = existingSprints.filter(s => s.backlogId === backlog.id);
      
      // 3 objectifs par projet
      const objTypes: Array<{ type: "business" | "product" | "marketing"; title: string }> = [
        { type: "business", title: "Croissance du CA projet" },
        { type: "product", title: "Livraison des fonctionnalités clés" },
        { type: "marketing", title: "Adoption utilisateur" },
      ];

      for (let o = 0; o < 3; o++) {
        const objType = objTypes[o];
        
        const [objective] = await db.insert(okrObjectives).values({
          accountId: ACCOUNT_ID,
          projectId: project.id,
          title: objType.title,
          description: `Objectif ${objType.type} pour ${project.name}`,
          type: objType.type,
          targetPhase: randomChoice(["T1", "T2", "T3"]),
          status: randomChoice(["on_track", "at_risk", "achieved"]),
          progress: randomInt(20, 90),
          position: o,
          createdBy: USER_ID,
        }).returning();

        // 3 Key Results par objectif
        const krTemplates = [
          { title: "Taux de complétion sprints", targetValue: 100, unit: "%" },
          { title: "Vélocité moyenne", targetValue: 40, unit: "pts" },
          { title: "Satisfaction client", targetValue: 4.5, unit: "/5" },
        ];

        for (let k = 0; k < 3; k++) {
          const kr = krTemplates[k];
          const currentValue = kr.targetValue * (randomInt(40, 95) / 100);
          
          const [keyResult] = await db.insert(okrKeyResults).values({
            accountId: ACCOUNT_ID,
            objectiveId: objective.id,
            title: kr.title,
            metricType: "delivery",
            targetValue: kr.targetValue,
            currentValue: Math.round(currentValue * 10) / 10,
            unit: kr.unit,
            status: currentValue >= kr.targetValue * 0.8 ? "ok" : "critical",
            weight: 1,
            position: k,
          }).returning();

          // Lier au premier sprint disponible
          if (projectSprints.length > 0) {
            await db.insert(okrLinks).values({
              accountId: ACCOUNT_ID,
              keyResultId: keyResult.id,
              entityType: "sprint",
              entityId: randomChoice(projectSprints).id,
            });
          }
        }
      }
    }
    console.log("✅ OKRs créés\n");
  }

  // 3. Créer les tâches globales
  const existingTasks = await db.select().from(tasks).where(eq(tasks.accountId, ACCOUNT_ID));
  
  if (existingTasks.length < 30) {
    console.log("✅ Création des tâches globales...");
    
    // Vérifier/créer les colonnes
    let columns = await db.select().from(taskColumns).where(
      and(eq(taskColumns.accountId, ACCOUNT_ID), isNull(taskColumns.projectId))
    );
    
    if (columns.length === 0) {
      const [todoCol] = await db.insert(taskColumns).values({
        accountId: ACCOUNT_ID,
        projectId: null,
        name: "À faire",
        color: "#E5E7EB",
        order: 0,
        isLocked: 1,
      }).returning();
      const [inProgressCol] = await db.insert(taskColumns).values({
        accountId: ACCOUNT_ID,
        projectId: null,
        name: "En cours",
        color: "#93C5FD",
        order: 1,
        isLocked: 0,
      }).returning();
      const [doneCol] = await db.insert(taskColumns).values({
        accountId: ACCOUNT_ID,
        projectId: null,
        name: "Terminé",
        color: "#86EFAC",
        order: 2,
        isLocked: 1,
      }).returning();
      columns = [todoCol, inProgressCol, doneCol];
    }

    const todoColId = columns.find(c => c.name === "À faire")?.id || columns[0].id;
    const inProgressColId = columns.find(c => c.name === "En cours")?.id || columns[1]?.id || columns[0].id;
    const doneColId = columns.find(c => c.name === "Terminé")?.id || columns[2]?.id || columns[0].id;

    const taskTitles = [
      "Préparer la documentation technique",
      "Organiser la réunion de lancement",
      "Réviser le contrat client",
      "Mettre à jour le planning projet",
      "Préparer la démo client",
      "Analyser les métriques de performance",
      "Rédiger le compte-rendu réunion",
      "Valider les maquettes UI",
      "Configurer l'environnement de prod",
      "Former l'équipe sur les nouveaux outils",
      "Auditer la sécurité de l'application",
      "Optimiser les requêtes base de données",
      "Préparer le support utilisateur",
      "Créer les templates email",
      "Tester l'intégration API partenaire",
      "Mettre à jour la roadmap produit",
      "Réviser la stratégie de pricing",
      "Analyser les retours utilisateurs",
      "Préparer le rapport mensuel",
      "Organiser le sprint planning",
      "Faire la revue de code",
      "Déployer en staging",
      "Préparer les assets marketing",
      "Mettre à jour la FAQ",
      "Configurer les alertes monitoring",
      "Réviser les SLA",
      "Préparer la migration données",
      "Tester le plan de reprise",
      "Valider le budget Q2",
      "Organiser le team building",
    ];

    const toCreate = 30 - existingTasks.length;
    for (let t = 0; t < toCreate; t++) {
      const project = randomChoice(existingProjects);
      const status = randomChoice(["todo", "in_progress", "done"]);
      const columnId = status === "todo" ? todoColId : status === "in_progress" ? inProgressColId : doneColId;
      
      await db.insert(tasks).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        columnId,
        title: taskTitles[t % taskTitles.length],
        description: `Description de la tâche`,
        status,
        priority: randomChoice(["low", "medium", "high"]),
        assignedToId: getRandomUser().id,
        dueDate: formatDate(addDays(new Date(), randomInt(-7, 30))),
        effort: randomInt(1, 5),
        positionInColumn: t,
        order: t,
        createdBy: USER_ID,
      });
    }
    console.log(`✅ ${toCreate} tâches globales créées\n`);
  }

  console.log("🎉 Complétion terminée!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Erreur:", error);
  process.exit(1);
});
