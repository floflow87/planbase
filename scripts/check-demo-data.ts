import { db } from "../server/db";
import { clients, projects, backlogs, sprints, epics, userStories, backlogTasks, roadmaps, okrObjectives, tasks } from "../shared/schema";
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
  ]);
  
  console.log("📊 Données existantes pour le compte jdelabarre@yopmail.com:");
  console.log("   Clients:", counts[0][0].count);
  console.log("   Projets:", counts[1][0].count);
  console.log("   Backlogs:", counts[2][0].count);
  console.log("   Sprints:", counts[3][0].count);
  console.log("   Epics:", counts[4][0].count);
  console.log("   User Stories:", counts[5][0].count);
  console.log("   Backlog Tasks:", counts[6][0].count);
  console.log("   Roadmaps:", counts[7][0].count);
  console.log("   OKR Objectives:", counts[8][0].count);
  console.log("   Tasks:", counts[9][0].count);
  
  process.exit(0);
}

checkData();
