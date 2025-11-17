import { supabaseAdmin } from "../server/lib/supabase";

const accountId = "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4";
const userId = "839d3ce6-6fbf-4541-952d-a999b193572f";

async function recreateAll() {
  console.log("🔄 Recréation complète de l'environnement démo...\n");

  // 1. Créer le compte
  console.log("1️⃣ Création du compte...");
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .insert({
      id: accountId,
      name: "Demo Company",
      owner_user_id: userId,
      plan: "pro",
      settings: {},
    })
    .select()
    .single();

  if (accountError) {
    console.error("❌ Erreur création compte:", accountError);
    throw accountError;
  }
  console.log("✅ Compte créé:", account.name);

  // 2. Créer l'utilisateur
  console.log("\n2️⃣ Création de l'utilisateur...");
  const { data: user, error: userError } = await supabaseAdmin
    .from("app_users")
    .insert({
      id: userId,
      account_id: accountId,
      email: "demo@example.com",
      role: "owner",
      first_name: "Demo",
      last_name: "User",
      profile: {},
    })
    .select()
    .single();

  if (userError) {
    console.error("❌ Erreur création utilisateur:", userError);
    throw userError;
  }
  console.log("✅ Utilisateur créé:", user.email);

  // 3. Créer des clients
  console.log("\n3️⃣ Création des clients...");
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .insert([
      {
        account_id: accountId,
        type: "company",
        name: "TechCorp Solutions",
        status: "active",
        tags: ["tech", "b2b"],
        created_by: userId,
      },
      {
        account_id: accountId,
        type: "company",
        name: "Design Studio Pro",
        status: "prospecting",
        tags: ["design", "créatif"],
        created_by: userId,
      },
    ])
    .select();

  if (clientsError) {
    console.error("❌ Erreur création clients:", clientsError);
    throw clientsError;
  }
  console.log(`✅ ${clients.length} clients créés`);

  // 4. Créer des projets
  console.log("\n4️⃣ Création des projets...");
  const { data: projects, error: projectsError } = await supabaseAdmin
    .from("projects")
    .insert([
      {
        account_id: accountId,
        client_id: clients[0].id,
        name: "Refonte Site Web",
        description: "Refonte complète du site corporate",
        stage: "en_cours",
        category: "Développement Web",
        start_date: "2025-01-15",
        end_date: "2025-03-30",
        budget: 25000,
        tags: ["web", "ux"],
        created_by: userId,
      },
      {
        account_id: accountId,
        client_id: clients[1].id,
        name: "Identité Visuelle",
        description: "Création de l'identité visuelle complète",
        stage: "prospection",
        category: "Branding",
        start_date: "2025-02-01",
        end_date: "2025-04-15",
        budget: 15000,
        tags: ["design", "branding"],
        created_by: userId,
      },
    ])
    .select();

  if (projectsError) {
    console.error("❌ Erreur création projets:", projectsError);
    throw projectsError;
  }
  console.log(`✅ ${projects.length} projets créés`);

  // 5. Créer des tâches
  console.log("\n5️⃣ Création des tâches...");
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from("tasks")
    .insert([
      {
        account_id: accountId,
        project_id: projects[0].id,
        title: "Wireframes page d'accueil",
        description: "Créer les wireframes pour la nouvelle page d'accueil",
        status: "in_progress",
        priority: "high",
        due_date: "2025-02-15",
        assigned_to: userId,
        tags: ["design", "ux"],
        position: 0,
        created_by: userId,
      },
      {
        account_id: accountId,
        project_id: projects[0].id,
        title: "Setup environnement dev",
        description: "Configurer l'environnement de développement",
        status: "done",
        priority: "medium",
        due_date: "2025-01-20",
        assigned_to: userId,
        tags: ["dev", "setup"],
        position: 1,
        created_by: userId,
      },
      {
        account_id: accountId,
        project_id: projects[1].id,
        title: "Recherche inspiration visuelle",
        description: "Créer un moodboard pour le branding",
        status: "todo",
        priority: "medium",
        due_date: "2025-02-05",
        assigned_to: userId,
        tags: ["design", "research"],
        position: 0,
        created_by: userId,
      },
    ])
    .select();

  if (tasksError) {
    console.error("❌ Erreur création tâches:", tasksError);
    throw tasksError;
  }
  console.log(`✅ ${tasks.length} tâches créées`);

  // 6. Créer des notes
  console.log("\n6️⃣ Création des notes...");
  const { data: notes, error: notesError } = await supabaseAdmin
    .from("notes")
    .insert([
      {
        account_id: accountId,
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
              ],
            },
          ],
        }),
        type: "meeting",
        tags: ["réunion", "techcorp"],
        created_by: userId,
      },
      {
        account_id: accountId,
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
        created_by: userId,
      },
    ])
    .select();

  if (notesError) {
    console.error("❌ Erreur création notes:", notesError);
    throw notesError;
  }
  console.log(`✅ ${notes.length} notes créées`);

  console.log("\n✨ Environnement démo recréé avec succès !");
  console.log("\n📊 Résumé:");
  console.log(`  - 1 Compte: ${account.name}`);
  console.log(`  - 1 Utilisateur: ${user.email}`);
  console.log(`  - ${clients.length} Clients`);
  console.log(`  - ${projects.length} Projets`);
  console.log(`  - ${tasks.length} Tâches`);
  console.log(`  - ${notes.length} Notes`);
}

recreateAll()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
