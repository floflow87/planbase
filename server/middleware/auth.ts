// Authentication & Multi-tenant middleware with Supabase JWT validation
import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { storage } from "../storage";

// Extend Express Request to include authenticated user context
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
      userId?: string;
      userRole?: "owner" | "collaborator" | "client_viewer";
    }
  }
}

/**
 * Production-ready authentication middleware using Supabase JWT validation
 * 
 * This middleware:
 * 1. Extracts JWT from Authorization header
 * 2. Validates JWT signature using Supabase
 * 3. Extracts accountId, userId, and role from user metadata
 * 4. Verifies the user exists in the database
 * 5. Attaches auth context to req object for downstream use
 * 
 * Usage in client:
 * headers: { "Authorization": "Bearer <supabase-jwt-token>" }
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract Supabase JWT from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: "Unauthorized - Missing or invalid Authorization header",
        hint: "Include 'Authorization: Bearer <token>' header" 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      // Log full error details for debugging
      console.error("JWT validation error:", JSON.stringify(error, null, 2));
      console.error("Token prefix:", token.substring(0, 20) + "...");
      return res.status(401).json({ 
        error: "Unauthorized - Invalid or expired token",
        hint: "Please log in again" 
      });
    }

    // Extract accountId from user metadata
    let accountId = user.user_metadata?.account_id;
    const role = user.user_metadata?.role;
    let dbUser: any;

    // Auto-provision: Create account and/or user if they don't exist
    const userEmail = user.email || `user-${user.id}@planbase.local`;
    
    console.log('🔍 AUTH DEBUG:', {
      userId: user.id,
      email: userEmail,
      accountId,
      role,
      metadata: user.user_metadata
    });
    
    if (!accountId) {
      // No account_id in metadata - create a new account for this user
      console.log(`Creating new account for first-time user: ${userEmail}`);
      const newAccount = await storage.createAccount({
        name: userEmail.split('@')[0] + "'s Account",
        ownerUserId: user.id, // Supabase Auth user ID
      });
      accountId = newAccount.id;

      // Update Supabase user metadata with the new account_id
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          account_id: accountId,
          role: 'owner',
        },
      });
    }

    // Verify/create account
    let account = await storage.getAccount(accountId);
    if (!account) {
      console.log(`Account ${accountId} not found, creating it...`);
      account = await storage.createAccount({
        name: userEmail.split('@')[0] + "'s Account",
        ownerUserId: user.id,
      });
      
      // Update local variable and Supabase metadata with the new account ID
      accountId = account.id;
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          account_id: accountId,
          role: role || 'owner',
        },
      });
    }

    // Find or create the corresponding app_user in the database
    const dbUsers = await storage.getUsersByAccountId(accountId);
    dbUser = dbUsers.find((u: any) => u.email === userEmail);

    if (!dbUser) {
      console.log(`Creating app_user record for: ${userEmail}`);
      // Generate a new UUID for the app_user
      const { randomUUID } = await import('crypto');
      dbUser = await storage.createUser({
        id: randomUUID(),
        accountId: accountId,
        email: userEmail,
        firstName: user.user_metadata?.firstName || userEmail.split('@')[0],
        lastName: user.user_metadata?.lastName || '',
        role: role || 'owner',
        gender: user.user_metadata?.gender || null,
        position: user.user_metadata?.position || null,
        avatarUrl: user.user_metadata?.avatarUrl || null,
      });

      // Update account ownerUserId with the app_user ID if this is the owner
      if (role === 'owner' || !role) {
        await storage.updateAccount(accountId, { ownerUserId: dbUser.id });
      }
    }

    // Attach authentication context to request
    req.accountId = accountId;
    req.userId = dbUser.id;
    req.userRole = (role || dbUser.role) as "owner" | "collaborator" | "client_viewer";

    console.log('✅ AUTH SUCCESS:', {
      userId: req.userId,
      email: userEmail,
      accountId: req.accountId,
      role: req.userRole
    });

    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed", details: error.message });
  }
}

/**
 * Require specific roles (owner or collaborator)
 * Must be used AFTER requireAuth middleware
 */
export function requireRole(...allowedRoles: Array<"owner" | "collaborator" | "client_viewer">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({ 
        error: "Unauthorized - User role not set",
        hint: "Include 'x-user-id' header to identify your role" 
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: `Forbidden - Requires one of: ${allowedRoles.join(", ")}`,
        yourRole: req.userRole 
      });
    }

    next();
  };
}

/**
 * Optional auth - sets context if headers present, but doesn't require them
 * Useful for public/semi-public endpoints
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const accountId = req.headers["x-account-id"] as string;
  const userId = req.headers["x-user-id"] as string;

  if (accountId) {
    try {
      const account = await storage.getAccount(accountId);
      if (account) {
        req.accountId = accountId;
      }

      if (userId) {
        const user = await storage.getUser(userId);
        if (user && user.accountId === accountId) {
          req.userId = userId;
          req.userRole = user.role as "owner" | "collaborator" | "client_viewer";
        }
      }
    } catch (error) {
      // Silently fail for optional auth
      console.warn("Optional auth failed:", error);
    }
  }

  next();
}
