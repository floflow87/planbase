/**
 * Script pour vérifier la configuration Supabase en production
 * Usage: npx tsx scripts/check-production-config.ts
 */

const requiredSecrets = {
  backend: [
    'SUPABASE_URL',
    'SUPABASE_DB_PASSWORD',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  frontend: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ],
};

console.log('🔍 Vérification de la configuration Supabase\n');

let allGood = true;

// Vérifier les secrets backend
console.log('📡 Backend Secrets:');
for (const secret of requiredSecrets.backend) {
  const exists = !!process.env[secret];
  const icon = exists ? '✅' : '❌';
  console.log(`  ${icon} ${secret}: ${exists ? 'Configuré' : 'MANQUANT'}`);
  
  if (exists && secret === 'SUPABASE_URL') {
    const url = process.env[secret]!;
    const projectRef = url.replace('https://', '').replace('.supabase.co', '');
    console.log(`      → Projet: ${projectRef}`);
    
    if (projectRef !== 'gfftezyrhsxtaeceuszd') {
      console.log(`      ⚠️  ATTENTION: Devrait être 'gfftezyrhsxtaeceuszd'`);
      allGood = false;
    }
  }
  
  if (!exists) allGood = false;
}

console.log('\n🌐 Frontend Secrets:');
for (const secret of requiredSecrets.frontend) {
  const exists = !!process.env[secret];
  const icon = exists ? '✅' : '❌';
  console.log(`  ${icon} ${secret}: ${exists ? 'Configuré' : 'MANQUANT'}`);
  
  if (exists && secret === 'VITE_SUPABASE_URL') {
    const url = process.env[secret]!;
    const projectRef = url.replace('https://', '').replace('.supabase.co', '');
    console.log(`      → Projet: ${projectRef}`);
    
    if (projectRef !== 'gfftezyrhsxtaeceuszd') {
      console.log(`      ⚠️  ATTENTION: Devrait être 'gfftezyrhsxtaeceuszd'`);
      allGood = false;
    }
  }
  
  if (!exists) allGood = false;
}

console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ Tous les secrets sont correctement configurés !');
  console.log('✅ Le projet Supabase est: gfftezyrhsxtaeceuszd');
  console.log('\n💡 Si la production est vide, vérifiez que:');
  console.log('   1. Ces mêmes secrets sont configurés dans le déploiement');
  console.log('   2. Le déploiement a bien redémarré après configuration');
  console.log('   3. Les logs de production montrent: "Connecting to Supabase (project: gfftezyrhsxtaeceuszd)"');
} else {
  console.log('❌ Certains secrets sont manquants ou incorrects');
  console.log('\n📝 Actions requises:');
  console.log('   1. Ajoutez les secrets manquants dans Replit Secrets (🔐)');
  console.log('   2. Corrigez les URLs pour pointer vers gfftezyrhsxtaeceuszd');
  console.log('   3. Redéployez l\'application');
}
console.log('='.repeat(60) + '\n');

process.exit(allGood ? 0 : 1);
