// Test /api/google/status endpoint
import { storage } from "../server/storage";
import { getGoogleClientId, getGoogleClientSecret } from "../server/storage";

async function testGoogleStatus() {
  try {
    console.log("🔍 Testing /api/google/status logic...\n");
    
    const accountId = "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4";
    const userId = "839d3ce6-6fbf-4541-952d-a999b193572f";
    
    // Simulate what the route does
    console.log("1️⃣ Getting Google token...");
    const token = await storage.getGoogleTokenByUserId(accountId, userId);
    console.log("  Token exists:", !!token);
    if (token) {
      console.log("  Email:", token.email);
    }
    
    console.log("\n2️⃣ Getting account...");
    const account = await storage.getAccount(accountId);
    console.log("  Account exists:", !!account);
    if (account) {
      console.log("  Name:", account.name);
      console.log("  Settings:", JSON.stringify(account.settings));
    }
    
    console.log("\n3️⃣ Testing helpers...");
    const clientId = getGoogleClientId(account);
    const clientSecret = getGoogleClientSecret(account);
    console.log("  clientId:", clientId ? `✅ ${clientId.substring(0, 20)}...` : "❌ undefined");
    console.log("  clientSecret:", clientSecret ? `✅ ${clientSecret.substring(0, 10)}...` : "❌ undefined");
    
    console.log("\n4️⃣ Building response...");
    const response = {
      connected: !!token,
      email: token?.email || null,
      configured: !!(clientId && clientSecret),
    };
    console.log("  Response:", JSON.stringify(response, null, 2));
    
    console.log("\n✅ Test completed!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testGoogleStatus();
