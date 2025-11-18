/**
 * Script pour configurer l'account_id de production
 * 
 * Ce script met à jour les métadonnées utilisateur Supabase pour utiliser
 * le même account_id que dev, permettant d'accéder aux données existantes
 * 
 * Usage: npx tsx scripts/fix-production-account-id.ts <email_utilisateur>
 */

import { supabaseAdmin } from '../server/lib/supabase';

// L'account_id utilisé en dev avec toutes les données existantes
const DEV_ACCOUNT_ID = 'b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4';

async function fixProductionAccountId() {
  const userEmail = process.argv[2];
  
  if (!userEmail) {
    console.error('❌ Erreur: Veuillez fournir l\'email de l\'utilisateur');
    console.log('\n📝 Usage: npx tsx scripts/fix-production-account-id.ts <email>');
    console.log('📝 Exemple: npx tsx scripts/fix-production-account-id.ts floflow87@planbase.com\n');
    process.exit(1);
  }

  console.log(`\n🔍 Recherche de l'utilisateur: ${userEmail}`);

  try {
    // 1. Chercher l'utilisateur par email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', listError.message);
      process.exit(1);
    }

    const user = users.users.find(u => u.email === userEmail);
    
    if (!user) {
      console.error(`❌ Utilisateur non trouvé: ${userEmail}`);
      console.log('\n📋 Utilisateurs disponibles:');
      users.users.forEach(u => {
        console.log(`   - ${u.email} (id: ${u.id})`);
      });
      process.exit(1);
    }

    console.log(`✅ Utilisateur trouvé: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Métadonnées actuelles:`, user.user_metadata);

    // 2. Vérifier l'account_id actuel
    const currentAccountId = user.user_metadata?.account_id;
    
    if (currentAccountId === DEV_ACCOUNT_ID) {
      console.log(`\n✅ L'utilisateur utilise déjà le bon account_id: ${DEV_ACCOUNT_ID}`);
      console.log('   Aucune action nécessaire.');
      process.exit(0);
    }

    console.log(`\n⚠️  Account_id actuel: ${currentAccountId || 'AUCUN'}`);
    console.log(`✅ Account_id cible (dev): ${DEV_ACCOUNT_ID}`);

    // 3. Mettre à jour les métadonnées
    console.log(`\n🔄 Mise à jour des métadonnées utilisateur...`);
    
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          account_id: DEV_ACCOUNT_ID,
          role: user.user_metadata?.role || 'owner',
        },
      }
    );

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Métadonnées mises à jour avec succès !');
    console.log('   Nouvelles métadonnées:', updatedUser?.user.user_metadata);

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Configuration terminée avec succès !');
    console.log(`${'='.repeat(60)}`);
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Déconnectez-vous de l\'application en production');
    console.log('   2. Reconnectez-vous');
    console.log('   3. Vous devriez maintenant voir toutes vos données existantes !');
    console.log('\n💡 Note: Les données créées avec l\'ancien account_id restent');
    console.log('   dans la base mais ne seront plus visibles (isolées par tenant).');
    console.log(`${'='.repeat(60)}\n`);

  } catch (error: any) {
    console.error('❌ Erreur inattendue:', error.message);
    process.exit(1);
  }
}

fixProductionAccountId();
