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
    // Extract JWT from Authorization header
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
      console.error("JWT validation error:", error?.message);
      return res.status(401).json({ 
        error: "Unauthorized - Invalid or expired token",
        hint: "Please log in again" 
      });
    }

    // Extract accountId from user metadata
    const accountId = user.user_metadata?.account_id;
    const role = user.user_metadata?.role;

    if (!accountId) {
      return res.status(403).json({ 
        error: "Forbidden - Missing account_id in user metadata",
        hint: "User account not properly configured" 
      });
    }

    // Verify account exists
    const account = await storage.getAccount(accountId);
    if (!account) {
      return res.status(403).json({ 
        error: "Forbidden - Account not found",
        hint: "The account associated with this user does not exist" 
      });
    }

    // Find the corresponding app_user in the database
    const dbUsers = await storage.getUsersByAccountId(accountId);
    const dbUser = dbUsers.find((u: any) => u.email === user.email);

    if (!dbUser) {
      console.error(`Database user not found for email: ${user.email}`);
      return res.status(403).json({ 
        error: "Forbidden - User not found in database",
        hint: "User account not properly synchronized" 
      });
    }

    // Attach authentication context to request
    req.accountId = accountId;
    req.userId = dbUser.id;
    req.userRole = (role || dbUser.role) as "owner" | "collaborator" | "client_viewer";

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
