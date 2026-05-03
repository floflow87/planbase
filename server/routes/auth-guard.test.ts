/**
 * Auth-guard integration tests — notes / projects / clients / tasks
 *
 * Strategy (two complementary layers):
 *
 * LAYER 1 — Supertest runtime tests
 *   Builds a minimal Express app that mounts the real requireAuth +
 *   requireOrgMember middleware chain in front of thin stub handlers.
 *   Confirms that unauthenticated requests (no Authorization header) receive
 *   401 for a representative endpoint from each resource group.
 *   This proves the middleware actually runs and rejects at runtime — a static
 *   token-scan cannot catch a broken or no-op requireAuth implementation.
 *
 * LAYER 2 — Static source audit
 *   Reads server/routes.ts source and asserts every registered route line for
 *   the four resource groups contains "requireAuth" and "requireOrgMember".
 *   Catches regressions where a developer accidentally removes a middleware
 *   argument from a line without the test suite noticing at runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { readFileSync } from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks for requireAuth's two dependencies
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } }),
    },
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getUserByEmail: vi.fn().mockResolvedValue(null),
    getAccount: vi.fn().mockResolvedValue(null),
    getUserById: vi.fn().mockResolvedValue(null),
    getAppUserByUserId: vi.fn().mockResolvedValue(null),
    createAccount: vi.fn().mockResolvedValue({ id: "acct-1" }),
    createAppUser: vi.fn().mockResolvedValue({ id: "user-1" }),
  },
}));

vi.mock("../services/permissionService", () => ({
  permissionService: {
    getUserPermissions: vi.fn().mockResolvedValue([]),
    hasPermission: vi.fn().mockResolvedValue(true),
  },
}));

import { requireAuth, requireOrgMember } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Express app that mounts requireAuth + requireOrgMember
 * in front of a 200 OK stub handler at the given path.
 */
function buildProtectedApp(method: "get" | "post" | "put" | "patch" | "delete", routePath: string) {
  const app = express();
  app.use(express.json());

  const stub = (_req: Request, res: Response) => res.status(200).json({ ok: true });

  app[method](routePath, requireAuth, requireOrgMember, stub);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Runtime 401 checks (no Authorization header)
// ─────────────────────────────────────────────────────────────────────────────

const representativeRoutes: Array<{
  resource: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
}> = [
  { resource: "notes",    method: "get",  path: "/api/notes" },
  { resource: "notes",    method: "post", path: "/api/notes" },
  { resource: "projects", method: "get",  path: "/api/projects" },
  { resource: "projects", method: "post", path: "/api/projects" },
  { resource: "clients",  method: "get",  path: "/api/clients" },
  { resource: "clients",  method: "post", path: "/api/clients" },
  { resource: "tasks",    method: "get",  path: "/api/tasks" },
  { resource: "tasks",    method: "post", path: "/api/tasks" },
];

describe("Auth-guard — unauthenticated requests return 401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const { resource, method, path: routePath } of representativeRoutes) {
    it(`${method.toUpperCase()} ${routePath} (${resource}) returns 401 with no Authorization header`, async () => {
      const app = buildProtectedApp(method, routePath);
      const res = await (request(app) as any)[method](routePath).send({});

      expect(res.status).toBe(401);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Static audit: every production route line has requireAuth
// ─────────────────────────────────────────────────────────────────────────────

const routesSrc = readFileSync(path.resolve(__dirname, "../routes.ts"), "utf-8");
const routeLines = routesSrc.split("\n");

function routeLinesFor(prefix: string): string[] {
  const routeMethodPattern = /^\s*app\.(get|post|put|patch|delete)\(/;
  return routeLines.filter(
    (line) => routeMethodPattern.test(line) && line.includes(`"${prefix}`)
  );
}

const RESOURCES = [
  { name: "notes",    prefix: "/api/notes" },
  { name: "projects", prefix: "/api/projects" },
  { name: "clients",  prefix: "/api/clients" },
  { name: "tasks",    prefix: "/api/tasks" },
] as const;

describe("Auth-guard static audit — server/routes.ts", () => {
  for (const { name, prefix } of RESOURCES) {
    describe(`${name} routes (${prefix})`, () => {
      const matched = routeLinesFor(prefix);

      it(`detects at least one ${name} route registration (sanity check)`, () => {
        expect(matched.length).toBeGreaterThan(0);
      });

      it(`every ${name} route line in routes.ts includes requireAuth`, () => {
        const unprotected = matched.filter((line) => !line.includes("requireAuth"));
        expect(
          unprotected,
          `Found ${name} routes WITHOUT requireAuth:\n${unprotected.join("\n")}`
        ).toHaveLength(0);
      });

      it(`every ${name} route line in routes.ts includes requireOrgMember`, () => {
        const unguarded = matched.filter((line) => !line.includes("requireOrgMember"));
        expect(
          unguarded,
          `Found ${name} routes WITHOUT requireOrgMember:\n${unguarded.join("\n")}`
        ).toHaveLength(0);
      });
    });
  }

  describe("Overall routes.ts wiring", () => {
    it("imports requireAuth from the auth middleware", () => {
      expect(routesSrc).toContain('from "./middleware/auth"');
      expect(routesSrc).toContain("requireAuth");
    });

    it("imports requireOrgMember from the auth middleware", () => {
      expect(routesSrc).toContain("requireOrgMember");
    });
  });
});
