import { db } from "../server/db";
import { projects } from "../shared/schema";
import { eq } from "drizzle-orm";

async function testDrizzleConnection() {
  console.log("🧪 Test de la connexion Drizzle utilisée par l'application\n");

  try {
    console.log("1️⃣ Test: db.select().from(projects)");
    const allProjects = await db.select().from(projects);
    console.log(`✅ Réussi! ${allProjects.length} projets trouvés`);
    
    if (allProjects.length > 0) {
      console.log("\n📋 Premier projet:");
      console.log(JSON.stringify(allProjects[0], null, 2));
      console.log("\n🔑 Clés du premier projet:", Object.keys(allProjects[0]));
    }
  } catch (error: any) {
    console.error("❌ ERREUR:", error.message);
    console.error("Stack:", error.stack);
  }

  try {
    console.log("\n2️⃣ Test: Insertion d'un projet avec description");
    const [newProject] = await db
      .insert(projects)
      .values({
        accountId: "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4",
        name: "Test Drizzle",
        description: "Test de la colonne description",
        stage: "prospection",
        createdBy: "839d3ce6-6fbf-4541-952d-a999b193572f",
        tags: [],
        meta: {},
      })
      .returning();
    
    console.log("✅ Projet créé avec succès!");
    console.log(JSON.stringify(newProject, null, 2));
  } catch (error: any) {
    console.error("❌ ERREUR lors de l'insertion:", error.message);
  }

  process.exit(0);
}

testDrizzleConnection();
