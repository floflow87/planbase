// Test Google OAuth helper functions
import { db } from "../server/db";
import { accounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getGoogleClientId, getGoogleClientSecret } from "../server/storage";

async function testHelpers() {
  try {
    console.log("🔍 Testing Google OAuth helper functions...\n");
    
    // Fetch account from database
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, "b79f7c03-9ca0-4a0f-a4ec-c203110a1ac4"));
    
    if (!account) {
      console.error("❌ Account not found");
      process.exit(1);
    }
    
    console.log("📋 Account from DB:");
    console.log("  ID:", account.id);
    console.log("  Name:", account.name);
    console.log("  Settings type:", typeof account.settings);
    console.log("  Settings value:", JSON.stringify(account.settings, null, 2));
    
    console.log("\n🧪 Testing helper functions:");
    const clientId = getGoogleClientId(account);
    const clientSecret = getGoogleClientSecret(account);
    
    console.log("  getGoogleClientId():", clientId ? `✅ ${clientId.substring(0, 20)}...` : "❌ undefined");
    console.log("  getGoogleClientSecret():", clientSecret ? `✅ ${clientSecret.substring(0, 10)}...` : "❌ undefined");
    
    console.log("\n🎯 Expected result:");
    console.log("  Both should return ✅ with values");
    
    process.exit(clientId && clientSecret ? 0 : 1);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testHelpers();
