import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;

async function addDescriptionColumn() {
  console.log("🔧 Ajout direct de la colonne description via SQL brut...\n");
  
  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Vérifier si la colonne existe déjà
    const existingColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'projects'
    `;
    
    console.log("📋 Colonnes actuelles dans projects:");
    existingColumns.forEach((col) => {
      console.log(`  - ${col.column_name}`);
    });

    const hasDescription = existingColumns.some(col => col.column_name === 'description');
    
    if (!hasDescription) {
      console.log("\n⚠️  Colonne 'description' manquante");
      console.log("➕ Ajout de la colonne...");
      
      await sql`ALTER TABLE public.projects ADD COLUMN description TEXT`;
      
      console.log("✅ Colonne ajoutée avec succès!");
    } else {
      console.log("\n✅ La colonne 'description' existe déjà");
    }

    // 2. Vérifier à nouveau
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    
    console.log("\n📋 Colonnes finales:");
    finalColumns.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // 3. Notifier PostgREST (si possible)
    console.log("\n🔄 Tentative de notification PostgREST...");
    try {
      await sql`NOTIFY pgrst, 'reload schema'`;
      console.log("✅ Notification envoyée");
    } catch (notifyError) {
      console.log("⚠️  Notification non supportée (normal sur certaines configurations)");
    }

    await sql.end();
    console.log("\n✨ Terminé!");
    
  } catch (error) {
    console.error("❌ Erreur:", error);
    await sql.end();
    throw error;
  }
}

addDescriptionColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
