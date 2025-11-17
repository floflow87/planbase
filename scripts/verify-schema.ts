import { supabaseAdmin } from "../server/lib/supabase";

async function verifySchema() {
  console.log("🔍 Vérification directe du schéma Supabase...\n");

  // Essayer de récupérer un projet existant pour voir les colonnes retournées
  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Erreur:", error);
  } else {
    console.log("✅ Requête réussie");
    console.log("📋 Colonnes retournées:", projects && projects.length > 0 ? Object.keys(projects[0]) : "Aucun projet");
    
    if (projects && projects.length > 0) {
      console.log("\n📄 Projet exemple:");
      console.log(projects[0]);
    }
  }

  // Tenter d'insérer un projet avec description
  console.log("\n🧪 Test d'insertion avec description...");
  const { data: newProject, error: insertError } = await supabaseAdmin
    .from("projects")
    .insert({
      account_id: "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4",
      name: "Test Projet Vérification",
      description: "Test de la colonne description",
      stage: "prospection",
      created_by: "839d3ce6-6fbf-4541-952d-a999b193572f",
    })
    .select()
    .single();

  if (insertError) {
    console.error("❌ Erreur insertion:", insertError);
  } else {
    console.log("✅ Projet créé avec succès!");
    console.log("📄 Données:", newProject);
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
