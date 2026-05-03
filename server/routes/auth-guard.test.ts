/**
 * Auth-guard integration tests — notes / projects / clients / tasks
 *
 * Mounts the real production routes (via registerRoutes) with only the heavy
 * I/O dependencies mocked.  The requireAuth middleware runs from its actual
 * source; no stubs or synthetic apps are used.
 *
 * Why this proves 401 behaviour on real routes:
 *   requireAuth (server/middleware/auth.ts) checks for an
 *   "Authorization: Bearer <token>" header before making any external call.
 *   A request without that header short-circuits at line 35 and returns 401
 *   immediately — without touching Supabase or storage.  We therefore only
 *   need to mock the modules that routes.ts imports so the file can be loaded;
 *   no handler logic runs in these tests.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import type { Express } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// Mock every heavy I/O dependency that routes.ts (and its transitive imports)
// require.  The real requireAuth / requireOrgMember are NOT mocked.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid" } }),
    },
  },
}));

const storageMock = {
  getAccount: vi.fn().mockResolvedValue(null),
  getUserById: vi.fn().mockResolvedValue(null),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getAppUserByUserId: vi.fn().mockResolvedValue(null),
  createAccount: vi.fn().mockResolvedValue({ id: "acct-1" }),
  createAppUser: vi.fn().mockResolvedValue({ id: "user-1" }),
  getNotesByAccount: vi.fn().mockResolvedValue([]),
  getNote: vi.fn().mockResolvedValue(null),
  getProjectsByAccountId: vi.fn().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue(null),
  getClientsByAccountId: vi.fn().mockResolvedValue([]),
  getClient: vi.fn().mockResolvedValue(null),
  getTasksByAccountId: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue(null),
};

vi.mock("../storage", () => ({
  storage: storageMock,
  getGoogleClientId: vi.fn().mockReturnValue(""),
  getGoogleClientSecret: vi.fn().mockReturnValue(""),
}));

vi.mock("../db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
        leftJoin: vi.fn(() => ({ where: vi.fn(() => []) })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  },
}));

vi.mock("../services/permissionService", () => ({
  permissionService: {
    getUserPermissions: vi.fn().mockResolvedValue([]),
    hasPermission: vi.fn().mockResolvedValue(true),
    resolvePermissions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../middleware/demo-helper", () => ({
  getDemoCredentials: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/configService", () => ({
  configService: {
    resolveConfig: vi.fn().mockResolvedValue({}),
    getConfig: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: vi.fn(() => ({ setCredentials: vi.fn(), generateAuthUrl: vi.fn(() => "") })) },
    gmail: vi.fn(() => ({ users: { messages: { list: vi.fn(), get: vi.fn() } } })),
  },
}));

vi.mock("../services/aiService", () => ({
  callAi: vi.fn().mockResolvedValue(""),
  extractTextFromProseMirror: vi.fn().mockReturnValue(""),
}));

vi.mock("../services/aiOrchestrator", () => ({
  runAi: vi.fn().mockResolvedValue({ text: "" }),
}));

vi.mock("../services/billingService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/billingService")>();
  return { ...actual, hasFeature: vi.fn().mockReturnValue(false) };
});

vi.mock("../services/alertService", () => ({
  sendAlerts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/openai", () => ({
  extractActions: vi.fn().mockResolvedValue([]),
  suggestNextActions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../routes/ai", () => {
  const { Router } = require("express");
  const r = Router();
  r.post("*", (_req: express.Request, res: express.Response) => res.sendStatus(200));
  return { default: r };
});

vi.mock("../routes/billing", () => {
  const { Router } = require("express");
  const r = Router();
  r.all("*", (_req: express.Request, res: express.Response) => res.sendStatus(200));
  return { default: r };
});

vi.mock("../routes/aiNested", () => {
  const { Router } = require("express");
  const r = Router();
  r.all("*", (_req: express.Request, res: express.Response) => res.sendStatus(200));
  return { default: r };
});

vi.mock("../index", () => ({}));

// ─────────────────────────────────────────────────────────────────────────────
// Build the test app once (expensive — registerRoutes registers ~500 routes)
// ─────────────────────────────────────────────────────────────────────────────

let app: Express;

beforeAll(async () => {
  const { registerRoutes } = await import("../routes");
  app = express();
  app.use(express.json());
  await registerRoutes(app);
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime 401 tests — real routes, no Authorization header
// ─────────────────────────────────────────────────────────────────────────────

const unauthCases: Array<{ resource: string; method: string; path: string }> = [
  { resource: "notes",    method: "get",  path: "/api/notes" },
  { resource: "notes",    method: "post", path: "/api/notes" },
  { resource: "projects", method: "get",  path: "/api/projects" },
  { resource: "projects", method: "post", path: "/api/projects" },
  { resource: "clients",  method: "get",  path: "/api/clients" },
  { resource: "clients",  method: "post", path: "/api/clients" },
  { resource: "tasks",    method: "get",  path: "/api/tasks" },
  { resource: "tasks",    method: "post", path: "/api/tasks" },
];

describe("Auth-guard — unauthenticated requests on real routes return 401", () => {
  for (const { resource, method, path } of unauthCases) {
    it(`${method.toUpperCase()} ${path} (${resource}) → 401 when Authorization header is absent`, async () => {
      const res = await (request(app) as Record<string, Function>)[method](path).send({});
      expect(res.status).toBe(401);
    });
  }
});
