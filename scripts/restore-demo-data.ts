import { storage } from "../server/storage";

async function restoreDemoData() {
  const accountId = "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4";
  const userId = "839d3ce6-6fbf-4541-952d-a999b193572f";

  console.log("🔄 Restauration des données de démonstration...");

  // Créer des clients
  const client1 = await storage.createClient({
    accountId,
    type: "company",
    name: "TechCorp Solutions",
    status: "active",
    tags: ["tech", "b2b"],
    createdBy: userId,
  });

  const client2 = await storage.createClient({
    accountId,
    type: "company",
    name: "Design Studio Pro",
    status: "prospecting",
    tags: ["design", "créatif"],
    createdBy: userId,
  });

  console.log("✅ Clients créés:", client1.name, client2.name);

  // Créer des projets
  const project1 = await storage.createProject({
    accountId,
    clientId: client1.id,
    name: "Refonte Site Web",
    description: "Refonte complète du site corporate",
    stage: "en_cours",
    category: "Développement Web",
    startDate: "2025-01-15",
    endDate: "2025-03-30",
    budget: "25000",
    tags: ["web", "ux"],
    createdBy: userId,
  });

  const project2 = await storage.createProject({
    accountId,
    clientId: client2.id,
    name: "Identité Visuelle",
    description: "Création de l'identité visuelle complète",
    stage: "prospection",
    category: "Branding",
    startDate: "2025-02-01",
    endDate: "2025-04-15",
    budget: "15000",
    tags: ["design", "branding"],
    createdBy: userId,
  });

  console.log("✅ Projets créés:", project1.name, project2.name);

  // Créer des notes
  const note1 = await storage.createNote({
    accountId,
    title: "Notes de Réunion Client TechCorp",
    content: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Points discutés" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Architecture technique validée" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Design system à définir" }],
                },
              ],
            },
          ],
        },
      ],
    }),
    type: "meeting",
    tags: ["réunion", "techcorp"],
    createdBy: userId,
  });

  const note2 = await storage.createNote({
    accountId,
    title: "Idées Créatives - Design Studio",
    content: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Exploration de concepts visuels pour la nouvelle identité",
            },
          ],
        },
      ],
    }),
    type: "idea",
    tags: ["créatif", "branding"],
    createdBy: userId,
  });

  console.log("✅ Notes créées:", note1.title, note2.title);

  // Créer des tâches
  const task1 = await storage.createTask({
    accountId,
    projectId: project1.id,
    title: "Wireframes page d'accueil",
    description: "Créer les wireframes pour la nouvelle page d'accueil",
    status: "in_progress",
    priority: "high",
    dueDate: "2025-02-15",
    assignedTo: userId,
    tags: ["design", "ux"],
    position: 0,
    createdBy: userId,
  });

  const task2 = await storage.createTask({
    accountId,
    projectId: project1.id,
    title: "Setup environnement dev",
    description: "Configurer l'environnement de développement",
    status: "done",
    priority: "medium",
    dueDate: "2025-01-20",
    assignedTo: userId,
    tags: ["dev", "setup"],
    position: 1,
    createdBy: userId,
  });

  const task3 = await storage.createTask({
    accountId,
    projectId: project2.id,
    title: "Recherche inspiration visuelle",
    description: "Créer un moodboard pour le branding",
    status: "todo",
    priority: "medium",
    dueDate: "2025-02-05",
    assignedTo: userId,
    tags: ["design", "research"],
    position: 0,
    createdBy: userId,
  });

  console.log("✅ Tâches créées:", task1.title, task2.title, task3.title);

  console.log("\n✨ Données de démonstration restaurées avec succès !");
  console.log("📊 Résumé:");
  console.log("  - 2 Clients");
  console.log("  - 2 Projets");
  console.log("  - 2 Notes");
  console.log("  - 3 Tâches");
}

restoreDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
