import postgres from "postgres";

// Utiliser EXACTEMENT la même connexion que server/db.ts
const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

const connectionString = `postgresql://postgres.${projectRef}:${supabasePassword}@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`;

console.log("🔧 Ajout de la colonne description dans Supabase\n");
console.log("📡 Connexion:", connectionString.replace(/:([^:@]+)@/, ':***@'));

async function addDescriptionToSupabase() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
  });

  try {
    // 1. Vérifier les colonnes actuelles
    console.log("\n1️⃣ Colonnes actuelles:");
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    columns.forEach((col) => console.log(`  - ${col.column_name}`));

    const hasDescription = columns.some((col) => col.column_name === 'description');

    if (hasDescription) {
      console.log("\n✅ La colonne 'description' existe déjà!");
    } else {
      console.log("\n⚠️  Colonne 'description' manquante");
      console.log("➕ Ajout de la colonne...");
      
      await sql`ALTER TABLE public.projects ADD COLUMN description TEXT`;
      
      console.log("✅ Colonne ajoutée avec succès!");
    }

    // 2. Vérifier après modification
    console.log("\n2️⃣ Colonnes finales:");
    const finalColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    finalColumns.forEach((col) => console.log(`  - ${col.column_name}`));

    // 3. Test d'insertion
    console.log("\n3️⃣ Test d'insertion avec description...");
    const [testProject] = await sql`
      INSERT INTO public.projects (
        account_id,
        name,
        description,
        stage,
        tags,
        meta,
        created_by
      ) VALUES (
        'b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4',
        'Test Script Supabase',
        'Test de la colonne description dans Supabase',
        'prospection',
        ARRAY[]::text[],
        '{}'::jsonb,
        '839d3ce6-6fbf-4541-952d-a999b193572f'
      )
      RETURNING *
    `;
    
    console.log("✅ Projet créé avec succès!");
    console.log(`   ID: ${testProject.id}`);
    console.log(`   Description: ${testProject.description}`);

    await sql.end();
    console.log("\n✨ Terminé!");
    
  } catch (error: any) {
    console.error("\n❌ Erreur:", error.message);
    await sql.end();
    throw error;
  }
}

addDescriptionToSupabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
