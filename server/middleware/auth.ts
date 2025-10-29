// Authentication & Multi-tenant middleware
import type { Request, Response, NextFunction } from "express";
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
 * ⚠️ CRITICAL SECURITY WARNING - DEVELOPMENT ONLY ⚠️
 * 
 * This header-based authentication is NOT production-ready and has critical vulnerabilities:
 * 
 * SECURITY RISKS:
 * - No JWT validation or signature verification
 * - Anyone who knows an accountId can access all account data
 * - No session management or expiration
 * - Vulnerable to replay attacks
 * 
 * REQUIRED FOR PRODUCTION:
 * 1. Integrate Supabase Auth with JWT verification
 * 2. Validate JWT signatures and extract claims (accountId, userId, role)
 * 3. Implement session management with expiration
 * 4. Add refresh token rotation
 * 5. Implement rate limiting per user/IP
 * 6. Add audit logging for all authentication attempts
 * 
 * CURRENT IMPLEMENTATION (Development/Testing Only):
 * Accepts x-account-id and x-user-id headers for convenience in testing
 * 
 * Usage in client:
 * headers: { "x-account-id": "account-uuid", "x-user-id": "user-uuid" }
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract account_id and user_id from headers
    const accountId = req.headers["x-account-id"] as string;
    const userId = req.headers["x-user-id"] as string;

    if (!accountId) {
      return res.status(401).json({ 
        error: "Unauthorized - Missing account_id",
        hint: "Include 'x-account-id' header with your account UUID" 
      });
    }

    // Verify account exists
    const account = await storage.getAccount(accountId);
    if (!account) {
      return res.status(403).json({ 
        error: "Forbidden - Invalid account_id",
        hint: "The provided account does not exist" 
      });
    }

    // If userId provided, verify it belongs to the account
    if (userId) {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ 
          error: "Forbidden - Invalid user_id" 
        });
      }
      
      if (user.accountId !== accountId) {
        return res.status(403).json({ 
          error: "Forbidden - User does not belong to this account" 
        });
      }

      req.userId = userId;
      req.userRole = user.role as "owner" | "collaborator" | "client_viewer";
    }

    // Attach account context to request
    req.accountId = accountId;

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
