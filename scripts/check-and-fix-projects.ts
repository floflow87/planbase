import { supabaseAdmin } from "../server/lib/supabase";

async function fixProjectsTable() {
  console.log("🔍 Vérification de la table projects...\n");

  // 1. Vérifier les colonnes existantes
  const { data: columns, error: columnsError } = await supabaseAdmin
    .from("information_schema.columns")
    .select("column_name, data_type")
    .eq("table_name", "projects")
    .eq("table_schema", "public");

  if (columnsError) {
    console.error("❌ Erreur lecture colonnes:", columnsError);
  } else {
    console.log("📋 Colonnes actuelles de projects:");
    columns?.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
  }

  // 2. Vérifier si description existe
  const hasDescription = columns?.some((col: any) => col.column_name === "description");
  
  if (!hasDescription) {
    console.log("\n⚠️  Colonne 'description' manquante !");
    console.log("🔧 Ajout de la colonne description...");
    
    // Ajouter la colonne description
    const { error: alterError } = await supabaseAdmin.rpc("exec_sql", {
      query: `ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;`
    });

    if (alterError) {
      console.error("❌ Erreur ajout colonne:", alterError);
      
      // Fallback : essayer via SQL direct
      console.log("🔄 Tentative alternative...");
      try {
        const response = await fetch(
          `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              query: `ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;`,
            }),
          }
        );
        
        if (response.ok) {
          console.log("✅ Colonne description ajoutée avec succès !");
        } else {
          const errorData = await response.text();
          console.error("❌ Échec:", errorData);
        }
      } catch (fetchError) {
        console.error("❌ Erreur fetch:", fetchError);
      }
    } else {
      console.log("✅ Colonne description ajoutée avec succès !");
    }
  } else {
    console.log("\n✅ La colonne description existe déjà.");
  }

  // 3. Vérifier à nouveau après modification
  const { data: finalColumns } = await supabaseAdmin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_name", "projects")
    .eq("table_schema", "public");

  console.log("\n📋 Colonnes finales:");
  finalColumns?.forEach((col: any) => {
    console.log(`  - ${col.column_name}`);
  });
}

fixProjectsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
