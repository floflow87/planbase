import { db } from "../server/db";
import { 
  clients, projects, backlogs, sprints, epics, userStories, backlogTasks, 
  roadmaps, okrObjectives, tasks, ticketRecipes, retros, retroCards,
  projectScopeItems, timeEntries, resourceTemplates, projectResources, notes
} from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const accountId = "350c1969-2378-4f97-8c33-3a6ff7ac4f4f";

async function checkData() {
  const counts = await Promise.all([
    db.select({ count: sql`count(*)::int` }).from(clients).where(eq(clients.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(projects).where(eq(projects.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(backlogs).where(eq(backlogs.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(sprints).where(eq(sprints.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(epics).where(eq(epics.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(userStories).where(eq(userStories.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(backlogTasks).where(eq(backlogTasks.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(roadmaps).where(eq(roadmaps.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(okrObjectives).where(eq(okrObjectives.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(tasks).where(eq(tasks.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(ticketRecipes).where(eq(ticketRecipes.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(retros).where(eq(retros.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(retroCards).where(eq(retroCards.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(projectScopeItems).where(eq(projectScopeItems.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(timeEntries).where(eq(timeEntries.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(resourceTemplates).where(eq(resourceTemplates.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(projectResources).where(eq(projectResources.accountId, accountId)),
    db.select({ count: sql`count(*)::int` }).from(notes).where(eq(notes.accountId, accountId)),
  ]);
  
  console.log("📊 Données complètes pour le compte jdelabarre@yopmail.com:");
  console.log("");
  console.log("🏢 CRM & Projets:");
  console.log("   Clients:", counts[0][0].count);
  console.log("   Projets:", counts[1][0].count);
  console.log("");
  console.log("🏃 Backlogs & Sprints:");
  console.log("   Backlogs:", counts[2][0].count);
  console.log("   Sprints:", counts[3][0].count);
  console.log("   Epics:", counts[4][0].count);
  console.log("   User Stories:", counts[5][0].count);
  console.log("   Backlog Tasks:", counts[6][0].count);
  console.log("");
  console.log("🗺️ Roadmaps & OKRs:");
  console.log("   Roadmaps:", counts[7][0].count);
  console.log("   OKR Objectives:", counts[8][0].count);
  console.log("");
  console.log("📋 Tâches & Notes:");
  console.log("   Tasks:", counts[9][0].count);
  console.log("   Notes:", counts[17][0].count);
  console.log("");
  console.log("🧪 Recettes & Rétrospectives:");
  console.log("   Recettes:", counts[10][0].count);
  console.log("   Rétrospectives:", counts[11][0].count);
  console.log("   Retro Cards:", counts[12][0].count);
  console.log("");
  console.log("📝 CDC & Suivi:");
  console.log("   Scope Items (CDC):", counts[13][0].count);
  console.log("   Time Entries:", counts[14][0].count);
  console.log("");
  console.log("👥 Ressources:");
  console.log("   Templates:", counts[15][0].count);
  console.log("   Project Resources:", counts[16][0].count);
  
  process.exit(0);
}

checkData();
