// Add demo tasks with due dates for calendar testing
import { db } from "../server/db";
import { tasks } from "@shared/schema";

async function addDemoTasks() {
  try {
    const accountId = "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4";
    const userId = "839d3ce6-6fbf-4541-952d-a999b193572f";
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    console.log("\n📝 Création de tâches de démonstration avec dates d'échéance...\n");
    
    const demoTasks = [
      {
        accountId,
        title: "Préparer présentation client",
        description: "Créer slides pour la démo produit",
        status: "in_progress",
        priority: "high",
        dueDate: today.toISOString().split('T')[0],
        progress: 60,
        createdBy: userId,
      },
      {
        accountId,
        title: "Révision code PR #123",
        description: "Review et tests du nouveau module",
        status: "todo",
        priority: "medium",
        dueDate: tomorrow.toISOString().split('T')[0],
        progress: 0,
        createdBy: userId,
      },
      {
        accountId,
        title: "Déploiement production v2.0",
        description: "Mise en prod de la nouvelle version",
        status: "todo",
        priority: "high",
        dueDate: nextWeek.toISOString().split('T')[0],
        progress: 0,
        createdBy: userId,
      },
      {
        accountId,
        title: "Réunion équipe mensuelle",
        description: "Point mensuel avec toute l'équipe",
        status: "todo",
        priority: "low",
        dueDate: nextMonth.toISOString().split('T')[0],
        progress: 0,
        createdBy: userId,
      },
    ];
    
    for (const task of demoTasks) {
      const [created] = await db.insert(tasks).values(task).returning();
      console.log(`✅ Tâche créée : "${created.title}"`);
      console.log(`   Échéance : ${created.dueDate}`);
      console.log(`   Priorité : ${created.priority}\n`);
    }
    
    console.log("🎉 Tâches de démonstration créées avec succès !");
    console.log("\n💡 Allez sur la page Calendar pour voir les tâches affichées !\n");
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }
}

addDemoTasks();
