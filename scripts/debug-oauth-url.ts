// Debug: Display the exact OAuth URL being generated
import { storage, getGoogleClientId, getGoogleClientSecret } from "../server/storage";
import { createOAuth2Client, getAuthUrl } from "../server/lib/google-calendar";

async function debugOAuthUrl() {
  try {
    const accountId = "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4";
    const userId = "839d3ce6-6fbf-4541-952d-a999b193572f";
    
    const account = await storage.getAccount(accountId);
    const clientId = getGoogleClientId(account);
    const clientSecret = getGoogleClientSecret(account);
    
    if (!clientId || !clientSecret) {
      console.error("❌ No credentials found");
      process.exit(1);
    }
    
    // Replicate exact logic from routes.ts
    const redirectUri = `${process.env.REPLIT_DEV_DOMAIN || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`}/api/google/auth/callback`;
    
    const oauth2Client = createOAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
    });
    
    const state = JSON.stringify({ accountId, userId });
    const authUrl = getAuthUrl(oauth2Client, state);
    
    console.log("\n🔍 OAuth Configuration Debug\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📋 Redirect URI used by your app:");
    console.log(`   ${redirectUri}`);
    console.log("\n🔗 Full OAuth URL generated:");
    console.log(`   ${authUrl.substring(0, 200)}...`);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✅ ACTION REQUIRED:");
    console.log("1. Go to: https://console.cloud.google.com/apis/credentials");
    console.log("2. Click on your OAuth Client ID");
    console.log("3. In 'Authorized redirect URIs', make sure you have EXACTLY:");
    console.log(`\n   ${redirectUri}`);
    console.log("\n4. NO trailing slash");
    console.log("5. Must start with https://");
    console.log("6. Click SAVE and wait 30 seconds\n");
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

debugOAuthUrl();
