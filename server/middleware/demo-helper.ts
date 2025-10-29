// Demo account helper for testing
import { storage } from "../storage";
import { db } from "../db";
import { accounts } from "@shared/schema";

/**
 * Get the demo account ID for testing
 * Returns the first account found (Demo Startup from seed)
 */
export async function getDemoAccountId(): Promise<string | null> {
  try {
    // Find the demo account by name
    const allAccounts = await db.select().from(accounts).limit(1);
    return allAccounts[0]?.id || null;
  } catch (error) {
    console.error("Error getting demo account:", error);
    return null;
  }
}

/**
 * Get demo credentials for easy testing
 */
export async function getDemoCredentials() {
  const accountId = await getDemoAccountId();
  if (!accountId) {
    return null;
  }

  const users = await storage.getUsersByAccountId(accountId);
  const owner = users.find(u => u.role === "owner");
  const collaborator = users.find(u => u.role === "collaborator");

  return {
    accountId,
    owner: owner ? { id: owner.id, email: owner.email, role: owner.role } : null,
    collaborator: collaborator ? { id: collaborator.id, email: collaborator.email, role: collaborator.role } : null,
  };
}
