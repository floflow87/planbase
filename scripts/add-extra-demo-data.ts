/**
 * Script d'ajout de données supplémentaires de démonstration
 * - Recettes (cahier de recette)
 * - Rétrospectives
 * - Cahier des charges (scope items)
 * - Time tracking
 * - Ressources (templates et project resources)
 * - Notes
 */

import { db } from "../server/db";
import { 
  appUsers, projects, backlogs, sprints, userStories, backlogTasks,
  ticketRecipes, retros, retroCards,
  projectScopeItems, timeEntries,
  resourceTemplates, projectResources,
  notes, tasks, taskColumns
} from "../shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

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
  console.log("🚀 Ajout de données supplémentaires de démonstration...\n");

  // Récupérer les données existantes
  const accountUsers = await db.select().from(appUsers).where(eq(appUsers.accountId, ACCOUNT_ID));
  const existingProjects = await db.select().from(projects).where(eq(projects.accountId, ACCOUNT_ID));
  const existingBacklogs = await db.select().from(backlogs).where(eq(backlogs.accountId, ACCOUNT_ID));
  const existingSprints = await db.select().from(sprints).where(eq(sprints.accountId, ACCOUNT_ID));
  const existingUserStories = await db.select().from(userStories).where(eq(userStories.accountId, ACCOUNT_ID));
  const existingBacklogTasks = await db.select().from(backlogTasks).where(eq(backlogTasks.accountId, ACCOUNT_ID));
  
  const getRandomUser = () => randomChoice(accountUsers);
  console.log(`📊 Sprints: ${existingSprints.length}, Stories: ${existingUserStories.length}, Tasks: ${existingBacklogTasks.length}\n`);

  // 1. Créer les recettes (cahier de recette) pour les tickets
  console.log("🧪 Création des recettes...");
  
  // Vérifier les recettes existantes
  const existingRecipes = await db.select().from(ticketRecipes).where(eq(ticketRecipes.accountId, ACCOUNT_ID));
  const existingRecipeKeys = new Set(existingRecipes.map(r => `${r.ticketId}_${r.sprintId}`));
  let recipesCreated = 0;
  
  const completedOrInProgressSprints = existingSprints.filter(s => 
    s.status === "termine" || s.status === "en_cours"
  );
  
  for (const sprint of completedOrInProgressSprints.slice(0, 10)) {
    const backlog = existingBacklogs.find(b => b.id === sprint.backlogId);
    if (!backlog) continue;
    
    // Récupérer les stories et tasks de ce sprint
    const sprintStories = existingUserStories.filter(us => us.sprintId === sprint.id);
    const sprintTasks = existingBacklogTasks.filter(t => t.sprintId === sprint.id);
    
    // Créer des recettes pour les stories
    for (const story of sprintStories.slice(0, 5)) {
      const key = `${story.id}_${sprint.id}`;
      if (existingRecipeKeys.has(key)) continue; // Skip if already exists
      
      const status = randomChoice(["a_tester", "en_test", "teste"]);
      const conclusion = status === "teste" ? randomChoice(["termine", "a_ameliorer", "a_fix", null]) : null;
      
      await db.insert(ticketRecipes).values({
        accountId: ACCOUNT_ID,
        backlogId: backlog.id,
        sprintId: sprint.id,
        ticketId: story.id,
        ticketType: "user_story",
        status,
        observedResults: status !== "a_tester" ? randomChoice([
          "Le comportement observé correspond aux attentes",
          "Fonctionne correctement sur les cas nominaux",
          "Quelques ajustements mineurs nécessaires",
          "Bug mineur détecté sur mobile",
        ]) : null,
        conclusion,
        suggestions: conclusion === "a_ameliorer" ? "Améliorer l'ergonomie du formulaire" : null,
        remarks: randomChoice([null, "Test effectué sur Chrome et Firefox", "Validation client OK"]),
        isFixedDone: conclusion === "termine",
        updatedBy: getRandomUser().id,
      });
      existingRecipeKeys.add(key);
      recipesCreated++;
    }
    
    // Créer des recettes pour quelques tasks
    for (const task of sprintTasks.slice(0, 3)) {
      const key = `${task.id}_${sprint.id}`;
      if (existingRecipeKeys.has(key)) continue; // Skip if already exists
      
      const status = randomChoice(["a_tester", "en_test", "teste"]);
      
      await db.insert(ticketRecipes).values({
        accountId: ACCOUNT_ID,
        backlogId: backlog.id,
        sprintId: sprint.id,
        ticketId: task.id,
        ticketType: "task", // Only 'user_story' and 'task' allowed by DB constraint
        status,
        observedResults: status !== "a_tester" ? "Implémentation conforme aux spécifications" : null,
        conclusion: status === "teste" ? randomChoice(["termine", "a_fix"]) : null,
        isFixedDone: false,
        updatedBy: getRandomUser().id,
      });
      existingRecipeKeys.add(key);
      recipesCreated++;
    }
  }
  console.log(`✅ ${recipesCreated} recettes créées (${existingRecipes.length} existantes)\n`);

  // 2. Créer les rétrospectives
  console.log("🔄 Création des rétrospectives...");
  let retrosCreated = 0;
  
  const completedSprints = existingSprints.filter(s => s.status === "termine");
  
  for (const sprint of completedSprints.slice(0, 8)) {
    const backlog = existingBacklogs.find(b => b.id === sprint.backlogId);
    if (!backlog) continue;
    
    const [retro] = await db.insert(retros).values({
      accountId: ACCOUNT_ID,
      backlogId: backlog.id,
      sprintId: sprint.id,
      number: 1,
      status: "termine",
      createdBy: USER_ID,
    }).returning();
    
    // Ajouter des cartes pour chaque colonne
    const workedCards = [
      "Communication d'équipe excellente",
      "Bonne vélocité maintenue",
      "Tests automatisés efficaces",
      "Déploiement sans incident",
    ];
    const notWorkedCards = [
      "Spécifications pas assez claires",
      "Blocage technique au milieu du sprint",
      "Retard sur l'intégration API",
    ];
    const toImproveCards = [
      "Mieux documenter les décisions techniques",
      "Planifier plus de temps pour les tests",
      "Améliorer la communication avec le client",
      "Automatiser les déploiements staging",
    ];
    
    for (let i = 0; i < 3; i++) {
      await db.insert(retroCards).values({
        accountId: ACCOUNT_ID,
        retroId: retro.id,
        column: "worked",
        content: workedCards[i],
        authorId: getRandomUser().id,
        order: i,
      });
    }
    
    for (let i = 0; i < 2; i++) {
      await db.insert(retroCards).values({
        accountId: ACCOUNT_ID,
        retroId: retro.id,
        column: "not_worked",
        content: notWorkedCards[i],
        authorId: getRandomUser().id,
        order: i,
      });
    }
    
    for (let i = 0; i < 3; i++) {
      await db.insert(retroCards).values({
        accountId: ACCOUNT_ID,
        retroId: retro.id,
        column: "to_improve",
        content: toImproveCards[i],
        authorId: getRandomUser().id,
        order: i,
      });
    }
    
    retrosCreated++;
  }
  console.log(`✅ ${retrosCreated} rétrospectives créées\n`);

  // 3. Créer les lignes de cahier des charges (scope items)
  console.log("📝 Création des éléments CDC...");
  let scopeItemsCreated = 0;
  
  const scopeTemplates = [
    { label: "Page d'accueil", scopeType: "functional", days: 3 },
    { label: "Système d'authentification", scopeType: "functional", days: 5 },
    { label: "Tableau de bord utilisateur", scopeType: "functional", days: 4 },
    { label: "Gestion des utilisateurs", scopeType: "functional", days: 6 },
    { label: "Module de facturation", scopeType: "functional", days: 8 },
    { label: "Architecture technique", scopeType: "technical", days: 3 },
    { label: "Base de données", scopeType: "technical", days: 4 },
    { label: "API REST", scopeType: "technical", days: 5 },
    { label: "Intégration CI/CD", scopeType: "technical", days: 2 },
    { label: "Design System", scopeType: "design", days: 4 },
    { label: "Maquettes UI/UX", scopeType: "design", days: 6 },
    { label: "Charte graphique", scopeType: "design", days: 2 },
    { label: "Gestion de projet", scopeType: "gestion", days: 3 },
    { label: "Recette et tests", scopeType: "gestion", days: 4 },
    { label: "Formation utilisateurs", scopeType: "autre", days: 2 },
  ];
  
  for (const project of existingProjects.slice(0, 8)) {
    const numItems = randomInt(8, 12);
    const shuffledTemplates = [...scopeTemplates].sort(() => Math.random() - 0.5).slice(0, numItems);
    
    for (let i = 0; i < shuffledTemplates.length; i++) {
      const template = shuffledTemplates[i];
      const phase = randomChoice(["T1", "T2", "T3", "T4", "LT"]);
      
      await db.insert(projectScopeItems).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        label: template.label,
        description: `Description détaillée pour ${template.label.toLowerCase()}`,
        scopeType: template.scopeType as any,
        isBillable: randomInt(1, 10) > 2 ? 1 : 0, // 80% facturable
        estimatedDays: (template.days + randomInt(-1, 2)).toString(),
        phase,
        isOptional: randomInt(1, 10) > 8 ? 1 : 0, // 20% optionnel
        order: i,
      });
      scopeItemsCreated++;
    }
  }
  console.log(`✅ ${scopeItemsCreated} éléments CDC créés\n`);

  // 4. Créer les entrées de time tracking
  console.log("⏱️ Création du time tracking...");
  let timeEntriesCreated = 0;
  
  for (const project of existingProjects.slice(0, 6)) {
    const backlog = existingBacklogs.find(b => b.projectId === project.id);
    const projectSprints = backlog ? existingSprints.filter(s => s.backlogId === backlog.id) : [];
    
    // Créer 10-20 entrées par projet
    const numEntries = randomInt(10, 20);
    for (let i = 0; i < numEntries; i++) {
      const user = getRandomUser();
      const startTime = addDays(new Date(), -randomInt(1, 60));
      const duration = randomInt(1800, 28800); // 30 min à 8h
      
      await db.insert(timeEntries).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        userId: user.id,
        sprintId: projectSprints.length > 0 ? randomChoice(projectSprints).id : null,
        description: randomChoice([
          "Développement fonctionnalité",
          "Réunion client",
          "Revue de code",
          "Correction de bugs",
          "Tests unitaires",
          "Documentation",
          "Design UI",
          "Intégration API",
          "Déploiement",
          "Support technique",
        ]),
        startTime,
        endTime: new Date(startTime.getTime() + duration * 1000),
        duration,
        isBillable: randomInt(1, 10) > 2 ? 1 : 0, // 80% facturable
      });
      timeEntriesCreated++;
    }
  }
  console.log(`✅ ${timeEntriesCreated} entrées de time tracking créées\n`);

  // 5. Créer les templates de ressources
  console.log("👥 Création des templates de ressources...");
  
  const humanTemplates = [
    { name: "Développeur Full-Stack Senior", profileType: "developer", mode: "internal", dailyCost: "450", dailyRate: "700" },
    { name: "Développeur Full-Stack Junior", profileType: "developer", mode: "internal", dailyCost: "280", dailyRate: "500" },
    { name: "Designer UI/UX", profileType: "designer", mode: "freelance", dailyCost: "400", dailyRate: "650" },
    { name: "Product Manager", profileType: "product_manager", mode: "internal", dailyCost: "500", dailyRate: "800" },
    { name: "DevOps Engineer", profileType: "devops", mode: "contractor", dailyCost: "480", dailyRate: "750" },
    { name: "QA Engineer", profileType: "qa", mode: "internal", dailyCost: "350", dailyRate: "550" },
    { name: "Chef de projet", profileType: "project_manager", mode: "internal", dailyCost: "420", dailyRate: "680" },
  ];
  
  const nonHumanTemplates = [
    { name: "Hébergement AWS", category: "hosting", costType: "monthly", amount: "150" },
    { name: "Hébergement Vercel", category: "hosting", costType: "monthly", amount: "50" },
    { name: "Supabase Pro", category: "saas", costType: "monthly", amount: "25" },
    { name: "OpenAI API", category: "api", costType: "monthly", amount: "100" },
    { name: "Figma Team", category: "saas", costType: "monthly", amount: "45" },
    { name: "GitHub Team", category: "saas", costType: "monthly", amount: "21" },
    { name: "Licence Adobe", category: "license", costType: "annual", amount: "720" },
    { name: "Domain & SSL", category: "infrastructure", costType: "annual", amount: "50" },
  ];
  
  // Vérifier si les templates existent déjà
  const existingTemplates = await db.select().from(resourceTemplates).where(eq(resourceTemplates.accountId, ACCOUNT_ID));
  
  if (existingTemplates.length === 0) {
    for (const template of humanTemplates) {
      await db.insert(resourceTemplates).values({
        accountId: ACCOUNT_ID,
        name: template.name,
        type: "human",
        profileType: template.profileType,
        mode: template.mode,
        dailyCostInternal: template.dailyCost,
        dailyRateBilled: template.dailyRate,
        defaultCapacity: 5, // 5 jours/semaine
        isBillable: 1,
        projectType: randomChoice(["dev_saas", "design", "ecommerce", null]),
        isSystemTemplate: 0,
      });
    }
    
    for (const template of nonHumanTemplates) {
      await db.insert(resourceTemplates).values({
        accountId: ACCOUNT_ID,
        name: template.name,
        type: "non_human",
        category: template.category,
        costType: template.costType,
        defaultAmount: template.amount,
        isBillable: 1,
        projectType: null,
        isSystemTemplate: 0,
      });
    }
    console.log(`✅ ${humanTemplates.length} templates humains + ${nonHumanTemplates.length} templates non-humains créés\n`);
  } else {
    console.log(`⏭️ Templates de ressources déjà existants (${existingTemplates.length})\n`);
  }

  // 6. Ajouter des ressources aux projets
  console.log("📦 Ajout de ressources aux projets...");
  let resourcesCreated = 0;
  
  const templates = await db.select().from(resourceTemplates).where(eq(resourceTemplates.accountId, ACCOUNT_ID));
  const humanResourceTemplates = templates.filter(t => t.type === "human");
  const nonHumanResourceTemplates = templates.filter(t => t.type === "non_human");
  
  for (const project of existingProjects.slice(0, 6)) {
    const baseDate = new Date(project.startDate || new Date());
    
    // 2-4 ressources humaines par projet
    const numHuman = randomInt(2, 4);
    const selectedHuman = [...humanResourceTemplates].sort(() => Math.random() - 0.5).slice(0, numHuman);
    
    for (const template of selectedHuman) {
      await db.insert(projectResources).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        templateId: template.id,
        name: template.name,
        type: "human",
        profileType: template.profileType,
        mode: template.mode,
        dailyCostInternal: template.dailyCostInternal,
        dailyRateBilled: template.dailyRateBilled,
        capacity: randomChoice([2, 3, 4, 5]),
        startDate: formatDate(baseDate),
        endDate: formatDate(addDays(baseDate, randomInt(60, 180))),
        roadmapPhase: randomChoice(["T1", "T2", "T3"]),
        isBillable: 1,
        status: "active",
        isSimulation: 0,
        createdBy: USER_ID,
      });
      resourcesCreated++;
    }
    
    // 1-3 ressources non-humaines par projet
    const numNonHuman = randomInt(1, 3);
    const selectedNonHuman = [...nonHumanResourceTemplates].sort(() => Math.random() - 0.5).slice(0, numNonHuman);
    
    for (const template of selectedNonHuman) {
      await db.insert(projectResources).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        templateId: template.id,
        name: template.name,
        type: "non_human",
        category: template.category,
        costType: template.costType,
        amount: template.defaultAmount,
        startDate: formatDate(baseDate),
        endDate: formatDate(addDays(baseDate, randomInt(90, 365))),
        isBillable: 1,
        status: "active",
        isSimulation: 0,
        notes: `Ressource ${template.name} pour le projet`,
        createdBy: USER_ID,
      });
      resourcesCreated++;
    }
  }
  console.log(`✅ ${resourcesCreated} ressources projet créées\n`);

  // 7. Créer les notes
  console.log("📒 Création des notes...");
  let notesCreated = 0;
  
  const noteTemplates = [
    { title: "Réunion de lancement projet", content: "Points abordés lors de la réunion de kick-off avec le client..." },
    { title: "Spécifications techniques", content: "Architecture technique retenue pour le projet..." },
    { title: "Compte-rendu sprint review", content: "Démonstration des fonctionnalités livrées..." },
    { title: "Notes de réunion client", content: "Retours du client sur les dernières livraisons..." },
    { title: "Décisions d'architecture", content: "Choix techniques validés par l'équipe..." },
    { title: "Todo list équipe", content: "Actions à réaliser pour la semaine..." },
    { title: "Idées d'amélioration", content: "Suggestions d'optimisation du produit..." },
    { title: "Problèmes rencontrés", content: "Difficultés techniques et solutions proposées..." },
    { title: "Planning de release", content: "Calendrier des prochaines mises en production..." },
    { title: "Documentation API", content: "Notes sur les endpoints API du projet..." },
    { title: "Retours utilisateurs", content: "Feedback collecté auprès des premiers utilisateurs..." },
    { title: "Formation équipe", content: "Points à couvrir lors de la session de formation..." },
    { title: "Stratégie produit", content: "Réflexions sur l'évolution du produit..." },
    { title: "Analyse concurrentielle", content: "Benchmark des solutions concurrentes..." },
    { title: "Roadmap technique", content: "Évolutions techniques prévues pour les prochains mois..." },
  ];
  
  for (const template of noteTemplates) {
    await db.insert(notes).values({
      accountId: ACCOUNT_ID,
      createdBy: getRandomUser().id,
      title: template.title,
      content: [
        { type: "paragraph", children: [{ text: template.content }] },
        { type: "paragraph", children: [{ text: "" }] },
        { type: "paragraph", children: [{ text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." }] },
        { type: "paragraph", children: [{ text: "" }] },
        { type: "paragraph", children: [{ text: "Points importants:" }] },
        { type: "paragraph", children: [{ text: "- Premier point clé à retenir" }] },
        { type: "paragraph", children: [{ text: "- Deuxième élément important" }] },
        { type: "paragraph", children: [{ text: "- Troisième observation" }] },
      ],
      plainText: `${template.title}\n${template.content}\nLorem ipsum dolor sit amet...`,
      status: "active",
      visibility: randomChoice(["private", "account"]),
      isFavorite: randomInt(1, 10) > 7,
    });
    notesCreated++;
  }
  console.log(`✅ ${notesCreated} notes créées\n`);

  // 8. Ajouter plus de tâches globales
  console.log("✅ Ajout de tâches supplémentaires...");
  
  const existingTasks = await db.select().from(tasks).where(eq(tasks.accountId, ACCOUNT_ID));
  let columns = await db.select().from(taskColumns).where(
    and(eq(taskColumns.accountId, ACCOUNT_ID), isNull(taskColumns.projectId))
  );
  
  const todoColId = columns.find(c => c.name === "À faire")?.id || columns[0]?.id;
  const inProgressColId = columns.find(c => c.name === "En cours")?.id || columns[1]?.id;
  const doneColId = columns.find(c => c.name === "Terminé")?.id || columns[2]?.id;
  
  if (todoColId) {
    const additionalTasks = [
      "Réviser les contrats fournisseurs",
      "Préparer le budget prévisionnel",
      "Analyser les KPIs mensuels",
      "Mettre à jour le site web",
      "Organiser la rétrospective trimestrielle",
      "Préparer la présentation investisseurs",
      "Auditer les performances serveur",
      "Revoir la stratégie SEO",
      "Planifier les entretiens RH",
      "Créer les visuels marketing",
    ];
    
    let tasksCreated = 0;
    for (let i = 0; i < additionalTasks.length; i++) {
      const project = randomChoice(existingProjects);
      const status = randomChoice(["todo", "in_progress", "done"]);
      const columnId = status === "todo" ? todoColId : status === "in_progress" ? inProgressColId : doneColId;
      
      await db.insert(tasks).values({
        accountId: ACCOUNT_ID,
        projectId: project.id,
        columnId,
        title: additionalTasks[i],
        description: `Description de la tâche: ${additionalTasks[i]}`,
        status,
        priority: randomChoice(["low", "medium", "high"]),
        assignedToId: getRandomUser().id,
        dueDate: formatDate(addDays(new Date(), randomInt(-14, 30))),
        effort: randomInt(1, 5),
        positionInColumn: existingTasks.length + i,
        order: existingTasks.length + i,
        createdBy: USER_ID,
      });
      tasksCreated++;
    }
    console.log(`✅ ${tasksCreated} tâches supplémentaires créées\n`);
  }

  console.log("🎉 Ajout des données supplémentaires terminé!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Erreur:", error);
  process.exit(1);
});
