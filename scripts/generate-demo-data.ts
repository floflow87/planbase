/**
 * Script de génération de données de démonstration pour PlanBase
 * 
 * Usage: npx tsx scripts/generate-demo-data.ts
 * 
 * Ce script génère un jeu complet de données pour tester l'application:
 * - 15 clients CRM
 * - 10 projets (liés à 10 clients)
 * - 5 backlogs Scrum avec 8 sprints chacun
 * - Epics, User Stories, Tasks
 * - Roadmaps avec blocs et jalons
 * - OKR Objectifs et Key Results
 * - Tâches globales liées aux OKRs
 */

import { db } from "../server/db";
import { 
  accounts, appUsers, clients, contacts, projects, projectCategories,
  backlogs, sprints, epics, userStories, backlogTasks, checklistItems,
  ticketComments, ticketAcceptanceCriteria,
  roadmaps, roadmapItems, roadmapItemLinks,
  okrObjectives, okrKeyResults, okrLinks,
  tasks, taskColumns
} from "../shared/schema";
import { eq, and } from "drizzle-orm";

// Configuration
const TARGET_EMAIL = "jdelabarre@yopmail.com";

// Helpers
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

// Data templates
const clientTemplates = [
  { name: "TechStart SAS", sector: "Tech", status: "active" },
  { name: "BioVert Industries", sector: "Environnement", status: "active" },
  { name: "Mode Élégance", sector: "Mode", status: "active" },
  { name: "FinSecure Group", sector: "Finance", status: "vip" },
  { name: "SantéPlus Cliniques", sector: "Santé", status: "active" },
  { name: "EduNova Formation", sector: "Éducation", status: "prospect" },
  { name: "AgroLocal Coopérative", sector: "Agriculture", status: "active" },
  { name: "MediaWave Productions", sector: "Médias", status: "active" },
  { name: "LogiTrans Express", sector: "Logistique", status: "prospect" },
  { name: "ImmoPrestige Développement", sector: "Immobilier", status: "vip" },
  { name: "CulinaireArt Restaurants", sector: "Restauration", status: "active" },
  { name: "SportElite Club", sector: "Sport", status: "prospect" },
  { name: "JuriConseil Avocats", sector: "Juridique", status: "active" },
  { name: "BeautyLux Cosmétiques", sector: "Beauté", status: "active" },
  { name: "GreenEnergy Solutions", sector: "Énergie", status: "prospect" },
];

const projectTypes = [
  { name: "Développement SaaS", type: "dev_saas", category: "SaaS" },
  { name: "Site e-commerce", type: "ecommerce", category: "E-commerce" },
  { name: "Branding complet", type: "design", category: "Branding" },
  { name: "Application mobile", type: "dev_saas", category: "Mobile" },
  { name: "Design System", type: "design", category: "Design System" },
  { name: "Site vitrine", type: "site_vitrine", category: "Site web" },
  { name: "Formation digitale", type: "formation", category: "Formation" },
  { name: "Intégration CRM", type: "integration", category: "Intégration" },
  { name: "Refonte UX/UI", type: "design", category: "UX/UI" },
  { name: "Conseil stratégique", type: "conseil", category: "Conseil" },
];

const epicTemplates = [
  { title: "Authentification & Sécurité", description: "Système d'authentification utilisateur et gestion des permissions", priority: "high" },
  { title: "Onboarding utilisateur", description: "Parcours d'inscription et configuration initiale", priority: "high" },
  { title: "Tableau de bord", description: "Dashboard principal avec KPIs et widgets personnalisables", priority: "medium" },
  { title: "Gestion des paiements", description: "Intégration Stripe, facturation et abonnements", priority: "critical" },
  { title: "Notifications & Alertes", description: "Système de notifications temps réel et email", priority: "medium" },
  { title: "Reporting & Analytics", description: "Rapports personnalisés et export de données", priority: "low" },
  { title: "API & Intégrations", description: "API REST publique et webhooks", priority: "medium" },
  { title: "Mobile & PWA", description: "Application mobile progressive et responsive", priority: "high" },
];

const userStoryTemplates = [
  { title: "Connexion par email/mot de passe", description: "En tant qu'utilisateur, je veux me connecter avec mon email et mot de passe", complexity: "S", points: 2 },
  { title: "Connexion Google OAuth", description: "En tant qu'utilisateur, je veux me connecter avec mon compte Google", complexity: "M", points: 3 },
  { title: "Réinitialisation mot de passe", description: "En tant qu'utilisateur, je veux pouvoir réinitialiser mon mot de passe", complexity: "S", points: 2 },
  { title: "Profil utilisateur", description: "En tant qu'utilisateur, je veux modifier mon profil et avatar", complexity: "M", points: 3 },
  { title: "Validation email", description: "En tant qu'utilisateur, je veux valider mon email à l'inscription", complexity: "S", points: 2 },
  { title: "Gestion des rôles", description: "En tant qu'admin, je veux gérer les rôles des utilisateurs", complexity: "L", points: 5 },
  { title: "Historique connexions", description: "En tant qu'utilisateur, je veux voir mon historique de connexions", complexity: "M", points: 3 },
  { title: "2FA authentification", description: "En tant qu'utilisateur, je veux activer l'authentification à deux facteurs", complexity: "XL", points: 8 },
  { title: "Widget KPI personnalisable", description: "En tant qu'utilisateur, je veux personnaliser mes widgets KPI", complexity: "L", points: 5 },
  { title: "Graphiques temps réel", description: "En tant qu'utilisateur, je veux voir des graphiques mis à jour en temps réel", complexity: "L", points: 5 },
  { title: "Export PDF rapports", description: "En tant qu'utilisateur, je veux exporter mes rapports en PDF", complexity: "M", points: 3 },
  { title: "Filtres avancés", description: "En tant qu'utilisateur, je veux filtrer mes données avec des critères avancés", complexity: "M", points: 3 },
  { title: "Recherche globale", description: "En tant qu'utilisateur, je veux rechercher dans toute l'application", complexity: "L", points: 5 },
  { title: "Mode sombre", description: "En tant qu'utilisateur, je veux basculer en mode sombre", complexity: "S", points: 2 },
  { title: "Notifications push", description: "En tant qu'utilisateur, je veux recevoir des notifications push", complexity: "L", points: 5 },
  { title: "Email digest", description: "En tant qu'utilisateur, je veux recevoir un résumé quotidien par email", complexity: "M", points: 3 },
];

const taskTemplates = [
  { title: "Créer le composant UI", description: "Développer le composant React avec les styles" },
  { title: "Implémenter l'API", description: "Créer l'endpoint backend et la logique métier" },
  { title: "Ajouter les tests unitaires", description: "Écrire les tests Jest pour la fonctionnalité" },
  { title: "Intégrer avec le backend", description: "Connecter le frontend avec l'API" },
  { title: "Ajouter la validation", description: "Implémenter la validation des données" },
  { title: "Gérer les erreurs", description: "Ajouter la gestion des erreurs et messages" },
  { title: "Documenter l'API", description: "Rédiger la documentation OpenAPI/Swagger" },
  { title: "Optimiser les performances", description: "Améliorer les temps de réponse" },
];

const commentTemplates = [
  "J'ai commencé l'implémentation, tout se passe bien.",
  "Il y a un blocage avec la base de données, je cherche une solution.",
  "Le design a été validé par le client, on peut continuer.",
  "J'ai besoin d'une clarification sur les spécifications.",
  "Tests passés, prêt pour la review.",
  "Quelques ajustements mineurs à faire suite aux retours.",
  "Implémentation terminée, en attente de validation.",
  "Le client a demandé une modification, je m'en occupe.",
];

const acceptanceCriteriaTemplates = [
  "L'utilisateur peut se connecter avec des identifiants valides",
  "Un message d'erreur s'affiche si les identifiants sont incorrects",
  "La session expire après 24 heures d'inactivité",
  "Les données sont chiffrées en transit (HTTPS)",
  "L'interface est responsive sur mobile et desktop",
  "Le temps de chargement est inférieur à 2 secondes",
  "Les validations côté client et serveur sont cohérentes",
  "Un email de confirmation est envoyé après l'action",
];

async function main() {
  console.log("🚀 Démarrage de la génération de données de démonstration...\n");

  // 1. Trouver le compte cible
  console.log(`📍 Recherche du compte pour ${TARGET_EMAIL}...`);
  const [user] = await db.select().from(appUsers).where(eq(appUsers.email, TARGET_EMAIL)).limit(1);
  
  if (!user) {
    console.error(`❌ Utilisateur ${TARGET_EMAIL} non trouvé`);
    process.exit(1);
  }

  const accountId = user.accountId;
  const userId = user.id;
  console.log(`✅ Compte trouvé: ${accountId}`);
  console.log(`   Utilisateur: ${userId}\n`);

  // Récupérer tous les utilisateurs du compte pour les assignations
  const accountUsers = await db.select().from(appUsers).where(eq(appUsers.accountId, accountId));
  const getRandomUser = () => randomChoice(accountUsers);

  // 2. Créer les catégories de projets
  console.log("📂 Création des catégories de projets...");
  const existingCategories = await db.select().from(projectCategories).where(eq(projectCategories.accountId, accountId));
  const existingCategoryNames = new Set(existingCategories.map(c => c.name));
  
  for (const pt of projectTypes) {
    if (!existingCategoryNames.has(pt.category)) {
      await db.insert(projectCategories).values({
        accountId,
        name: pt.category,
        projectType: pt.type,
      });
    }
  }
  console.log(`✅ ${projectTypes.length} catégories vérifiées\n`);

  // 3. Créer les 15 clients
  console.log("👥 Création des 15 clients CRM...");
  const createdClients: Array<{ id: string; name: string }> = [];
  
  for (const template of clientTemplates) {
    const [client] = await db.insert(clients).values({
      accountId,
      type: "company",
      name: template.name,
      status: template.status === "vip" ? "client" : template.status === "prospect" ? "prospecting" : "client",
      tags: [template.sector, template.status.toUpperCase()],
      notes: `Client du secteur ${template.sector}. Notes internes: Relation établie depuis 2024.`,
      createdBy: userId,
    }).returning();
    
    createdClients.push({ id: client.id, name: client.name });

    // Créer 1-2 contacts pour chaque client
    const numContacts = randomInt(1, 2);
    const contactFirstNames = ["Marie", "Pierre", "Sophie", "Jean", "Camille", "Lucas"];
    const contactLastNames = ["Dupont", "Martin", "Bernard", "Durand", "Moreau", "Leroy"];
    
    for (let c = 0; c < numContacts; c++) {
      const firstName = randomChoice(contactFirstNames);
      const lastName = randomChoice(contactLastNames);
      await db.insert(contacts).values({
        accountId,
        clientId: client.id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${template.name.toLowerCase().replace(/\s+/g, '')}.fr`,
        phone: `+33 1 ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        position: randomChoice(["Directeur", "Responsable projet", "Chef de produit", "DSI"]),
        isPrimary: c === 0 ? 1 : 0,
        createdBy: userId,
      });
    }
  }
  console.log(`✅ ${createdClients.length} clients créés\n`);

  // 4. Créer les 10 projets (liés aux 10 premiers clients)
  console.log("📋 Création des 10 projets...");
  const createdProjects: Array<{ id: string; name: string; clientId: string; startDate: Date; hasBacklog: boolean }> = [];
  const stages = ["prospection", "signe", "en_cours", "livre", "termine"];
  const priorities = ["low", "normal", "high", "strategic"];
  const baseDate = new Date();
  
  for (let i = 0; i < 10; i++) {
    const client = createdClients[i];
    const projectType = projectTypes[i];
    const startDate = addDays(baseDate, -randomInt(30, 180)); // Projet démarré entre 1 et 6 mois
    const hasBacklog = i < 5; // Les 5 premiers auront un backlog
    
    const budget = randomInt(15000, 150000);
    const billedPercent = randomChoice([0.2, 0.4, 0.6, 0.8, 1.0]);
    
    const [project] = await db.insert(projects).values({
      accountId,
      clientId: client.id,
      name: `${projectType.name} - ${client.name}`,
      description: `Projet de ${projectType.name.toLowerCase()} pour ${client.name}. Ce projet comprend l'analyse, la conception, le développement et la mise en production.`,
      stage: randomChoice(stages),
      priority: randomChoice(priorities),
      businessType: "client",
      category: projectType.category,
      startDate: formatDate(startDate),
      endDate: formatDate(addDays(startDate, randomInt(60, 180))),
      budget: budget.toString(),
      totalBilled: Math.floor(budget * billedPercent).toString(),
      billingRate: randomChoice(["600", "700", "800", "900"]),
      numberOfDays: randomInt(20, 80).toString(),
      projectTypeInferred: projectType.type,
      signatureDate: formatDate(addDays(startDate, -7)),
      createdBy: userId,
    }).returning();
    
    createdProjects.push({ 
      id: project.id, 
      name: project.name, 
      clientId: client.id,
      startDate,
      hasBacklog
    });
  }
  console.log(`✅ ${createdProjects.length} projets créés\n`);

  // 5. Créer les 5 backlogs Scrum avec 8 sprints chacun
  console.log("🏃 Création des 5 backlogs Scrum avec sprints...");
  const createdBacklogs: Array<{ id: string; projectId: string; sprints: Array<{ id: string; status: string }> }> = [];
  
  for (let b = 0; b < 5; b++) {
    const project = createdProjects[b];
    
    const [backlog] = await db.insert(backlogs).values({
      accountId,
      projectId: project.id,
      name: `Backlog - ${project.name}`,
      description: `Backlog Scrum pour le projet ${project.name}`,
      mode: "scrum",
      createdBy: userId,
    }).returning();

    const createdSprints: Array<{ id: string; status: string }> = [];
    const sprintDuration = 14; // 2 semaines
    
    for (let s = 0; s < 8; s++) {
      // 2 premiers terminés, 1 en cours, reste en préparation
      let status: "termine" | "en_cours" | "preparation";
      if (s < 2) status = "termine";
      else if (s === 2) status = "en_cours";
      else status = "preparation";
      
      const sprintStart = addDays(project.startDate, s * sprintDuration);
      const sprintEnd = addDays(sprintStart, sprintDuration);
      
      const [sprint] = await db.insert(sprints).values({
        accountId,
        backlogId: backlog.id,
        name: `Sprint ${s + 1}`,
        goal: `Objectif du Sprint ${s + 1}: Livrer les fonctionnalités prioritaires`,
        startDate: sprintStart,
        endDate: sprintEnd,
        status,
        position: s,
        completedAt: status === "termine" ? sprintEnd : null,
        createdBy: userId,
      }).returning();
      
      createdSprints.push({ id: sprint.id, status });
    }
    
    createdBacklogs.push({ id: backlog.id, projectId: project.id, sprints: createdSprints });
  }
  console.log(`✅ ${createdBacklogs.length} backlogs avec ${8 * 5} sprints créés\n`);

  // 6. Créer les Epics, User Stories et Tasks
  console.log("📌 Création des Epics, User Stories et Tasks...");
  let totalEpics = 0;
  let totalStories = 0;
  let totalTasks = 0;

  for (const backlog of createdBacklogs) {
    // 4 epics par backlog
    const shuffledEpicTemplates = [...epicTemplates].sort(() => Math.random() - 0.5).slice(0, 4);
    const createdEpics: Array<{ id: string; title: string }> = [];
    
    for (let e = 0; e < 4; e++) {
      const template = shuffledEpicTemplates[e];
      const owner = getRandomUser();
      
      const [epic] = await db.insert(epics).values({
        accountId,
        backlogId: backlog.id,
        title: template.title,
        description: template.description,
        priority: template.priority as any,
        state: randomChoice(["a_faire", "en_cours", "termine"]),
        color: randomChoice(["#C4B5FD", "#93C5FD", "#86EFAC", "#FDE047", "#FDBA74"]),
        order: e,
        ownerId: owner.id,
        createdBy: userId,
      }).returning();
      
      createdEpics.push({ id: epic.id, title: epic.title });
      totalEpics++;

      // 6+ user stories par epic
      const numStories = randomInt(6, 8);
      for (let us = 0; us < numStories; us++) {
        const storyTemplate = randomChoice(userStoryTemplates);
        const assignee = getRandomUser();
        const reporter = getRandomUser();
        
        // Répartir entre sprints et backlog
        let sprintId: string | null = null;
        if (us < 5 && backlog.sprints.length > 0) {
          // Assigner aux 5 premiers sprints
          sprintId = backlog.sprints[Math.min(us, backlog.sprints.length - 1)].id;
        }
        
        // État basé sur le sprint
        let state = "a_faire";
        if (sprintId) {
          const sprint = backlog.sprints.find(s => s.id === sprintId);
          if (sprint?.status === "termine") {
            state = "termine";
          } else if (sprint?.status === "en_cours") {
            state = randomChoice(["a_faire", "en_cours", "testing", "review"]);
          }
        }
        
        const [userStory] = await db.insert(userStories).values({
          accountId,
          backlogId: backlog.id,
          epicId: epic.id,
          sprintId,
          title: `${storyTemplate.title} - ${epic.title}`,
          description: storyTemplate.description,
          complexity: storyTemplate.complexity,
          priority: randomChoice(["low", "medium", "high", "critical"]),
          estimatePoints: storyTemplate.points,
          state,
          order: us,
          dueDate: formatDate(addDays(new Date(), randomInt(7, 60))),
          ownerId: getRandomUser().id,
          assigneeId: assignee.id,
          reporterId: reporter.id,
          createdBy: userId,
        }).returning();
        
        totalStories++;

        // Ajouter 3+ critères d'acceptation
        const numCriteria = randomInt(3, 5);
        for (let ac = 0; ac < numCriteria; ac++) {
          await db.insert(ticketAcceptanceCriteria).values({
            accountId,
            ticketId: userStory.id,
            ticketType: "user_story",
            content: randomChoice(acceptanceCriteriaTemplates),
            position: ac,
          });
        }

        // Ajouter 2+ commentaires
        const numComments = randomInt(2, 4);
        for (let cm = 0; cm < numComments; cm++) {
          await db.insert(ticketComments).values({
            accountId,
            ticketId: userStory.id,
            ticketType: "user_story",
            content: randomChoice(commentTemplates),
            authorId: getRandomUser().id,
          });
        }

        // 3-6 tasks par user story
        const numTasks = randomInt(3, 6);
        for (let t = 0; t < numTasks; t++) {
          const taskTemplate = randomChoice(taskTemplates);
          
          // État des tasks suit celui de la user story
          let taskState = "a_faire";
          if (state === "termine") {
            taskState = "termine";
          } else if (state === "en_cours" || state === "testing") {
            taskState = randomChoice(["a_faire", "en_cours", "termine"]);
          }
          
          const [task] = await db.insert(backlogTasks).values({
            accountId,
            backlogId: backlog.id,
            userStoryId: userStory.id,
            epicId: epic.id,
            sprintId,
            taskType: randomInt(1, 10) > 8 ? "bug" : "task",
            title: taskTemplate.title,
            description: taskTemplate.description,
            state: taskState,
            priority: randomChoice(["low", "medium", "high"]),
            estimatePoints: randomChoice([1, 2, 3, 5]),
            order: t,
            assigneeId: getRandomUser().id,
            reporterId: getRandomUser().id,
            createdBy: userId,
          }).returning();
          
          totalTasks++;

          // Ajouter 1-2 commentaires aux tasks
          await db.insert(ticketComments).values({
            accountId,
            ticketId: task.id,
            ticketType: "task",
            content: randomChoice(commentTemplates),
            authorId: getRandomUser().id,
          });
        }
      }
    }
  }
  console.log(`✅ ${totalEpics} epics, ${totalStories} user stories, ${totalTasks} tasks créés\n`);

  // 7. Créer les Roadmaps
  console.log("🗺️ Création des Roadmaps avec blocs et jalons...");
  const createdRoadmaps: Array<{ id: string; projectId: string }> = [];
  
  for (let r = 0; r < 5; r++) {
    const project = createdProjects[r];
    const backlog = createdBacklogs.find(b => b.projectId === project.id);
    
    const [roadmap] = await db.insert(roadmaps).values({
      accountId,
      projectId: project.id,
      name: `Roadmap - ${project.name}`,
      horizon: "2026-Q2",
      createdBy: userId,
    }).returning();
    
    createdRoadmaps.push({ id: roadmap.id, projectId: project.id });

    // Calculer les phases basées sur la date de début
    const t1Start = project.startDate;
    const t2Start = addDays(t1Start, 90);
    const t3Start = addDays(t1Start, 180);
    const ltStart = addDays(t1Start, 270);

    // 8-12 blocs roadmap
    const numBlocs = randomInt(8, 12);
    const phases = ["T1", "T2", "T3", "LT"];
    const createdItems: string[] = [];
    
    for (let i = 0; i < numBlocs; i++) {
      const phase = phases[Math.floor(i / 3)] || "LT";
      let startDate: Date;
      switch (phase) {
        case "T1": startDate = addDays(t1Start, randomInt(0, 60)); break;
        case "T2": startDate = addDays(t2Start, randomInt(0, 60)); break;
        case "T3": startDate = addDays(t3Start, randomInt(0, 60)); break;
        default: startDate = addDays(ltStart, randomInt(0, 60));
      }
      
      const [item] = await db.insert(roadmapItems).values({
        roadmapId: roadmap.id,
        projectId: project.id,
        title: `${randomChoice(["Livrable", "Feature", "Module", "Sprint"])} ${i + 1} - ${randomChoice(["Authentification", "Dashboard", "API", "Mobile", "Analytics"])}`,
        type: "deliverable",
        phase,
        startDate: formatDate(startDate),
        endDate: formatDate(addDays(startDate, randomInt(14, 45))),
        status: randomChoice(["planned", "in_progress", "done"]),
        priority: randomChoice(["low", "normal", "high"]),
        description: `Description du livrable pour la phase ${phase}`,
        progress: randomInt(0, 100),
        orderIndex: i,
        ownerUserId: getRandomUser().id,
      }).returning();
      
      createdItems.push(item.id);
    }

    // 3 jalons (milestones)
    const milestoneTypes = ["DELIVERY", "VALIDATION", "GO_NO_GO"];
    for (let m = 0; m < 3; m++) {
      const phase = phases[m];
      let targetDate: Date;
      switch (phase) {
        case "T1": targetDate = addDays(t1Start, 85); break;
        case "T2": targetDate = addDays(t2Start, 85); break;
        default: targetDate = addDays(t3Start, 85);
      }
      
      const [milestone] = await db.insert(roadmapItems).values({
        roadmapId: roadmap.id,
        projectId: project.id,
        title: `Jalon ${m + 1} - ${randomChoice(["Livraison MVP", "Validation client", "Go/No-Go production", "Release V1"])}`,
        type: "milestone",
        phase,
        targetDate: formatDate(targetDate),
        status: m === 0 ? "done" : "planned",
        priority: "high",
        description: `Jalon critique pour la phase ${phase}`,
        milestoneType: milestoneTypes[m],
        isCritical: m === 2,
        orderIndex: numBlocs + m,
        ownerUserId: getRandomUser().id,
      }).returning();

      // Lier le jalon à un bloc
      if (createdItems.length > m * 3) {
        await db.insert(roadmapItemLinks).values({
          roadmapItemId: milestone.id,
          linkedType: "roadmap_item",
          linkedId: createdItems[m * 3],
          linkedTitle: "Bloc lié",
          weight: 1,
        });
      }
    }
  }
  console.log(`✅ ${createdRoadmaps.length} roadmaps créées\n`);

  // 8. Créer les OKR
  console.log("🎯 Création des OKR (Objectifs et Key Results)...");
  const createdObjectives: Array<{ id: string; projectId: string }> = [];
  
  for (const roadmap of createdRoadmaps) {
    const project = createdProjects.find(p => p.id === roadmap.projectId)!;
    const backlog = createdBacklogs.find(b => b.projectId === project.id);
    
    const objectiveTypes: Array<{ type: "business" | "product" | "marketing"; title: string; description: string }> = [
      { type: "business", title: "Croissance du CA projet", description: "Augmenter le chiffre d'affaires généré par ce projet" },
      { type: "product", title: "Livraison des fonctionnalités clés", description: "Livrer toutes les fonctionnalités MVP dans les délais" },
      { type: "marketing", title: "Adoption utilisateur", description: "Atteindre les objectifs d'adoption et de satisfaction" },
    ];

    for (const objTemplate of objectiveTypes) {
      const [objective] = await db.insert(okrObjectives).values({
        accountId,
        projectId: project.id,
        title: objTemplate.title,
        description: objTemplate.description,
        type: objTemplate.type,
        targetPhase: randomChoice(["T1", "T2", "T3"]),
        status: randomChoice(["on_track", "at_risk", "achieved"]),
        progress: randomInt(20, 90),
        position: objectiveTypes.indexOf(objTemplate),
        createdBy: userId,
      }).returning();
      
      createdObjectives.push({ id: objective.id, projectId: project.id });

      // 3 Key Results par objectif
      const krTemplates = [
        { title: "Taux de complétion des sprints", targetValue: 100, unit: "%", metricType: "delivery" },
        { title: "Vélocité moyenne", targetValue: 40, unit: "points", metricType: "delivery" },
        { title: "Bugs critiques résolus", targetValue: 0, unit: "bugs", metricType: "delivery" },
        { title: "Couverture de tests", targetValue: 80, unit: "%", metricType: "delivery" },
        { title: "Temps de réponse API", targetValue: 200, unit: "ms", metricType: "time" },
        { title: "Satisfaction client", targetValue: 4.5, unit: "/5", metricType: "adoption" },
        { title: "Taux de conversion", targetValue: 15, unit: "%", metricType: "adoption" },
        { title: "NPS Score", targetValue: 50, unit: "pts", metricType: "adoption" },
        { title: "Marge opérationnelle", targetValue: 30, unit: "%", metricType: "margin" },
      ];

      const selectedKRs = [...krTemplates].sort(() => Math.random() - 0.5).slice(0, 3);
      
      for (let k = 0; k < 3; k++) {
        const krTemplate = selectedKRs[k];
        const currentValue = krTemplate.targetValue * (randomInt(30, 95) / 100);
        
        const [keyResult] = await db.insert(okrKeyResults).values({
          accountId,
          objectiveId: objective.id,
          title: krTemplate.title,
          metricType: krTemplate.metricType as any,
          targetValue: krTemplate.targetValue,
          currentValue: Math.round(currentValue * 10) / 10,
          unit: krTemplate.unit,
          status: currentValue >= krTemplate.targetValue * 0.8 ? "ok" : currentValue >= krTemplate.targetValue * 0.5 ? "ok" : "critical",
          weight: 1,
          position: k,
        }).returning();

        // Lier le KR à des entités (epic, sprint, roadmap_item)
        if (backlog && backlog.sprints.length > 0) {
          await db.insert(okrLinks).values({
            accountId,
            keyResultId: keyResult.id,
            entityType: "sprint",
            entityId: randomChoice(backlog.sprints).id,
          });
        }
      }
    }
  }
  console.log(`✅ ${createdObjectives.length} objectifs OKR avec Key Results créés\n`);

  // 9. Créer les tâches globales liées aux OKRs
  console.log("✅ Création des 30+ tâches globales...");
  
  // D'abord, créer les colonnes de tâches par défaut si elles n'existent pas
  const existingColumns = await db.select().from(taskColumns).where(
    and(eq(taskColumns.accountId, accountId), eq(taskColumns.projectId, null as any))
  );
  
  let todoColumnId: string;
  let inProgressColumnId: string;
  let doneColumnId: string;
  
  if (existingColumns.length === 0) {
    const [todoCol] = await db.insert(taskColumns).values({
      accountId,
      projectId: null,
      name: "À faire",
      color: "#E5E7EB",
      order: 0,
      isLocked: 1,
    }).returning();
    const [inProgressCol] = await db.insert(taskColumns).values({
      accountId,
      projectId: null,
      name: "En cours",
      color: "#93C5FD",
      order: 1,
      isLocked: 0,
    }).returning();
    const [doneCol] = await db.insert(taskColumns).values({
      accountId,
      projectId: null,
      name: "Terminé",
      color: "#86EFAC",
      order: 2,
      isLocked: 1,
    }).returning();
    
    todoColumnId = todoCol.id;
    inProgressColumnId = inProgressCol.id;
    doneColumnId = doneCol.id;
  } else {
    todoColumnId = existingColumns.find(c => c.name === "À faire")?.id || existingColumns[0].id;
    inProgressColumnId = existingColumns.find(c => c.name === "En cours")?.id || existingColumns[1]?.id || existingColumns[0].id;
    doneColumnId = existingColumns.find(c => c.name === "Terminé")?.id || existingColumns[2]?.id || existingColumns[0].id;
  }

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

  let tasksCreated = 0;
  for (let t = 0; t < 30; t++) {
    const project = randomChoice(createdProjects);
    const status = randomChoice(["todo", "in_progress", "done"]);
    const columnId = status === "todo" ? todoColumnId : status === "in_progress" ? inProgressColumnId : doneColumnId;
    
    await db.insert(tasks).values({
      accountId,
      projectId: project.id,
      columnId,
      title: taskTitles[t],
      description: `Description de la tâche: ${taskTitles[t]}`,
      status,
      priority: randomChoice(["low", "medium", "high"]),
      assignedToId: getRandomUser().id,
      dueDate: formatDate(addDays(new Date(), randomInt(-7, 30))),
      effort: randomInt(1, 5),
      positionInColumn: t,
      order: t,
      createdBy: userId,
    });
    tasksCreated++;
  }
  console.log(`✅ ${tasksCreated} tâches globales créées\n`);

  console.log("🎉 Génération des données de démonstration terminée avec succès!");
  console.log("\nRésumé:");
  console.log(`   - ${createdClients.length} clients CRM`);
  console.log(`   - ${createdProjects.length} projets`);
  console.log(`   - ${createdBacklogs.length} backlogs avec ${createdBacklogs.length * 8} sprints`);
  console.log(`   - ${totalEpics} epics`);
  console.log(`   - ${totalStories} user stories`);
  console.log(`   - ${totalTasks} tasks`);
  console.log(`   - ${createdRoadmaps.length} roadmaps`);
  console.log(`   - ${createdObjectives.length} objectifs OKR`);
  console.log(`   - ${tasksCreated} tâches globales`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Erreur lors de la génération:", error);
  process.exit(1);
});
