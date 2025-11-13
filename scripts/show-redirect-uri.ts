// Display the OAuth redirect URI to add in Google Cloud Console
console.log("\n🔗 OAuth Redirect URI Configuration\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const domain = process.env.REPLIT_DEV_DOMAIN || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
const redirectUri = domain.startsWith('http') ? `${domain}/api/google/auth/callback` : `https://${domain}/api/google/auth/callback`;

console.log("\n📋 Add this EXACT URI to Google Cloud Console:\n");
console.log(`   ${redirectUri}`);
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

console.log("\n📝 Steps to configure Google OAuth:\n");
console.log("1. Go to: https://console.cloud.google.com/apis/credentials");
console.log("2. Select your OAuth 2.0 Client ID");
console.log("3. Under 'Authorized redirect URIs', click 'ADD URI'");
console.log("4. Paste the URI above");
console.log("5. Click 'SAVE'\n");
