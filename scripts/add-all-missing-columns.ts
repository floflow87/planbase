import postgres from "postgres";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`;

console.log("🔧 Ajout de TOUTES les colonnes manquantes dans Supabase\n");

async function addAllMissingColumns() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
  });

  try {
    // Colonnes à ajouter (selon shared/schema.ts ligne 155-161)
    const columnsToAdd = [
      { name: 'description', type: 'TEXT' },
      { name: 'category', type: 'TEXT' },
      { name: 'start_date', type: 'DATE' },
      { name: 'end_date', type: 'DATE' },
      { name: 'signature_date', type: 'DATE' },
    ];

    // 1. Vérifier les colonnes actuelles
    const existingColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
    `;
    const existingNames = new Set(existingColumns.map((c) => c.column_name));

    console.log("📋 Colonnes existantes:", Array.from(existingNames).join(', '));
    console.log();

    // 2. Ajouter les colonnes manquantes
    for (const col of columnsToAdd) {
      if (existingNames.has(col.name)) {
        console.log(`✅ ${col.name} - existe déjà`);
      } else {
        console.log(`➕ ${col.name} - ajout en cours...`);
        await sql.unsafe(`ALTER TABLE public.projects ADD COLUMN ${col.name} ${col.type}`);
        console.log(`   ✅ ${col.name} ajoutée`);
      }
    }

    // 3. Vérification finale
    console.log("\n📊 Colonnes finales:");
    const finalColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    finalColumns.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    await sql.end();
    console.log("\n✨ Toutes les colonnes ont été ajoutées avec succès!");
    
  } catch (error: any) {
    console.error("\n❌ Erreur:", error.message);
    await sql.end();
    throw error;
  }
}

addAllMissingColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
