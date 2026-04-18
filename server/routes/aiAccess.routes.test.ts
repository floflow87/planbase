/**
 * Route-level integration tests for AI access control
 *
 * Two complementary layers of tests:
 *
 * LAYER 1 — HTTP integration tests (supertest)
 *   Uses the actual production routers to verify that the access-control
 *   middleware correctly gates free-plan vs. agency-plan accounts, and
 *   that admin email bypass works.
 *
 *   Covers:
 *     - All /api/ai/* endpoints (chat, search-context, project-analysis,
 *       generate-ticket, extract-actions, summarize, improve, recommendations)
 *     - /api/notes/:id/extract-actions  (now in aiNested router)
 *     - /api/clients/:id/suggest-actions (now in aiNested router)
 *
 * LAYER 2 — Route registration audit (source inspection)
 *   Reads the actual server/routes/aiNested.ts source and asserts that
 *   `requireAiAccess` is present at the router level. This catches wiring
 *   regressions (e.g. someone removing the middleware) that supertest alone
 *   would not catch.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { readFileSync } from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Hoist the mock for the DB execute so we can control it per-test
// ─────────────────────────────────────────────────────────────────────────────
const mockDbExecute = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
  db: { execute: mockDbExecute },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.accountId = (req.headers["x-account-id"] as string) ?? "test-account";
    req.userId = "test-user";
    req.userRole = "owner";
    next();
  },
  requireOrgMember: (_req: Request, _res: Response, next: NextFunction) => next(),
  requirePermission:
    (..._args: unknown[]) =>
    (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  requireRole:
    (..._args: unknown[]) =>
    (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireOrgAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../services/aiOrchestrator", () => ({
  runAi: vi.fn().mockResolvedValue({ text: "AI response", provider: "ollama" }),
}));

vi.mock("../services/aiContextBuilder", () => ({
  buildProjectContext: vi.fn().mockResolvedValue(null),
  buildNoteContext: vi.fn().mockResolvedValue(null),
  buildDocumentContext: vi.fn().mockResolvedValue(null),
  buildClientContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/embeddingService", () => ({
  searchSimilarNotes: vi.fn().mockResolvedValue([]),
  generateEmbedding: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/aiService", () => ({
  callAi: vi.fn().mockResolvedValue("AI response"),
  extractTextFromProseMirror: vi.fn().mockReturnValue("text"),
}));

vi.mock("../lib/openai", () => ({
  extractActions: vi.fn().mockResolvedValue([]),
  suggestNextActions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../storage", () => ({
  storage: {
    getNote: vi.fn().mockResolvedValue({
      id: "note-1",
      content: "note content",
      accountId: "test-account",
    }),
    getClient: vi.fn().mockResolvedValue({
      id: "client-1",
      name: "Acme",
      accountId: "test-account",
    }),
    getNotesByAccount: vi.fn().mockResolvedValue([]),
    getProjectsByAccountId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@shared/schema", () => ({
  backlogs: {},
  projects: {},
  notes: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports that depend on mocked modules
// ─────────────────────────────────────────────────────────────────────────────
import { runAi } from "../services/aiOrchestrator";
import aiRouter from "./ai";
import aiNestedRouter from "./aiNested";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: billing row factories
// ─────────────────────────────────────────────────────────────────────────────
function freeAccountRow() {
  return [{ plan: "freelance", subscription_status: null, owner_email: "user@example.com" }];
}

function agencyAccountRow(email = "owner@client.com") {
  return [{ plan: "agency", subscription_status: "active", owner_email: email }];
}

function adminAccountRow(email: string) {
  return [{ plan: "freelance", subscription_status: null, owner_email: email }];
}

function canceledAgencyRow() {
  return [{ plan: "agency", subscription_status: "canceled", owner_email: "user@example.com" }];
}

function incompleteAgencyRow() {
  return [{ plan: "agency", subscription_status: "incomplete", owner_email: "user@example.com" }];
}

// ─────────────────────────────────────────────────────────────────────────────
// App builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds an app that mounts the actual production AI sub-router.
 * Tests here exercise the real requireAiAccess middleware via the real router.
 */
function buildAiApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRouter);
  return app;
}

/**
 * Builds an app that mounts the actual aiNested sub-router.
 * This covers /api/notes/:id/extract-actions and /api/clients/:id/suggest-actions,
 * both protected by the router-level requireAiAccess middleware in aiNested.ts.
 */
function buildNestedAiApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", aiNestedRouter);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — HTTP integration tests for /api/ai/* routes
// ─────────────────────────────────────────────────────────────────────────────

describe("AI route access control — /api/ai/* endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const aiRoutes: Array<{ path: string; body: Record<string, unknown> }> = [
    { path: "/api/ai/chat", body: { message: "hello" } },
    { path: "/api/ai/search-context", body: { query: "test" } },
    { path: "/api/ai/project-analysis", body: { project: { name: "My Project" } } },
    { path: "/api/ai/generate-ticket", body: { content: "Implement login", title: "Login" } },
    { path: "/api/ai/extract-actions", body: { content: "Meeting notes" } },
    { path: "/api/ai/summarize", body: { content: "Some text", type: "note" } },
    { path: "/api/ai/improve", body: { content: "Some text", type: "note" } },
    { path: "/api/ai/recommendations", body: { content: "Some text", type: "note" } },
  ];

  for (const route of aiRoutes) {
    describe(`POST ${route.path}`, () => {
      it("returns 403 PLAN_REQUIRED for a free-plan account", async () => {
        mockDbExecute.mockResolvedValue(freeAccountRow());

        const res = await request(buildAiApp())
          .post(route.path)
          .set("x-account-id", "free-account")
          .send(route.body);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("PLAN_REQUIRED");
        expect(res.body.requiredPlan).toBe("agency");
      });

      it("allows access for an agency-plan account with active subscription", async () => {
        mockDbExecute.mockResolvedValue(agencyAccountRow());

        const res = await request(buildAiApp())
          .post(route.path)
          .set("x-account-id", "agency-account")
          .send(route.body);

        expect(res.status).not.toBe(403);
      });

      it("allows access for floflow87@planbase.io regardless of plan", async () => {
        mockDbExecute.mockResolvedValue(adminAccountRow("floflow87@planbase.io"));

        const res = await request(buildAiApp())
          .post(route.path)
          .set("x-account-id", "admin-account")
          .send(route.body);

        expect(res.status).not.toBe(403);
      });

      it("allows access for demo@yopmail.com regardless of plan", async () => {
        mockDbExecute.mockResolvedValue(adminAccountRow("demo@yopmail.com"));

        const res = await request(buildAiApp())
          .post(route.path)
          .set("x-account-id", "demo-account")
          .send(route.body);

        expect(res.status).not.toBe(403);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — HTTP integration tests for /api/notes/:id/extract-actions
// ─────────────────────────────────────────────────────────────────────────────

describe("AI route access control — /api/notes/:id/extract-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 PLAN_REQUIRED for a free-plan account", async () => {
    mockDbExecute.mockResolvedValue(freeAccountRow());

    const res = await request(buildNestedAiApp())
      .post("/api/notes/note-1/extract-actions")
      .set("x-account-id", "free-account")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PLAN_REQUIRED");
  });

  it("allows access for an agency-plan account with active subscription", async () => {
    mockDbExecute.mockResolvedValue(agencyAccountRow());

    const res = await request(buildNestedAiApp())
      .post("/api/notes/note-1/extract-actions")
      .set("x-account-id", "test-account")
      .send({});

    expect(res.status).not.toBe(403);
  });

  it("allows access for floflow87@planbase.io admin email", async () => {
    mockDbExecute.mockResolvedValue(adminAccountRow("floflow87@planbase.io"));

    const res = await request(buildNestedAiApp())
      .post("/api/notes/note-1/extract-actions")
      .set("x-account-id", "test-account")
      .send({});

    expect(res.status).not.toBe(403);
  });

  it("returns 403 for an agency account with a cancelled subscription", async () => {
    mockDbExecute.mockResolvedValue(canceledAgencyRow());

    const res = await request(buildNestedAiApp())
      .post("/api/notes/note-1/extract-actions")
      .set("x-account-id", "canceled-account")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PLAN_REQUIRED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — HTTP integration tests for /api/clients/:id/suggest-actions
// ─────────────────────────────────────────────────────────────────────────────

describe("AI route access control — /api/clients/:id/suggest-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 PLAN_REQUIRED for a free-plan account", async () => {
    mockDbExecute.mockResolvedValue(freeAccountRow());

    const res = await request(buildNestedAiApp())
      .post("/api/clients/client-1/suggest-actions")
      .set("x-account-id", "free-account")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PLAN_REQUIRED");
  });

  it("allows access for an agency-plan account with active subscription", async () => {
    mockDbExecute.mockResolvedValue(agencyAccountRow());

    const res = await request(buildNestedAiApp())
      .post("/api/clients/client-1/suggest-actions")
      .set("x-account-id", "agency-account")
      .send({});

    expect(res.status).not.toBe(403);
  });

  it("allows access for demo@yopmail.com admin email", async () => {
    mockDbExecute.mockResolvedValue(adminAccountRow("demo@yopmail.com"));

    const res = await request(buildNestedAiApp())
      .post("/api/clients/client-1/suggest-actions")
      .set("x-account-id", "demo-account")
      .send({});

    expect(res.status).not.toBe(403);
  });

  it("returns 403 for an agency account with an incomplete subscription", async () => {
    mockDbExecute.mockResolvedValue(incompleteAgencyRow());

    const res = await request(buildNestedAiApp())
      .post("/api/clients/client-1/suggest-actions")
      .set("x-account-id", "incomplete-account")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PLAN_REQUIRED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Route registration audit: verify aiNested.ts wiring
//
// Reads the actual server/routes/aiNested.ts source to assert that
// requireAiAccess is applied at the router level. This complements the
// HTTP tests by catching regressions (e.g. someone removing the middleware).
// ─────────────────────────────────────────────────────────────────────────────

describe("Route registration audit — aiNested.ts wiring for special AI routes", () => {
  const aiNestedSrc = readFileSync(
    path.resolve(__dirname, "./aiNested.ts"),
    "utf-8"
  );

  it("aiNested.ts imports requireAiAccess", () => {
    expect(aiNestedSrc).toContain("requireAiAccess");
  });

  it("aiNested.ts applies requireAiAccess at the router level via router.use()", () => {
    const pattern = /router\.use\([^)]*requireAiAccess/s;
    expect(
      pattern.test(aiNestedSrc),
      "Expected requireAiAccess to be applied at the router level via router.use() in aiNested.ts"
    ).toBe(true);
  });

  it("aiNested.ts defines the /notes/:id/extract-actions route", () => {
    expect(aiNestedSrc).toContain('"/notes/:id/extract-actions"');
  });

  it("aiNested.ts defines the /clients/:id/suggest-actions route", () => {
    expect(aiNestedSrc).toContain('"/clients/:id/suggest-actions"');
  });

  it("/api/ai/* sub-router is mounted with requireAiAccess enforced inside the router in ai.ts", () => {
    const aiRouterSrc = readFileSync(
      path.resolve(__dirname, "./ai.ts"),
      "utf-8"
    );
    expect(aiRouterSrc).toContain("requireAiAccess");
    const indexSrc = readFileSync(
      path.resolve(__dirname, "../index.ts"),
      "utf-8"
    );
    expect(indexSrc).toContain('"/api/ai"');
    expect(indexSrc).toContain("aiRouter");
  });

  it("server/routes.ts no longer imports requireAiAccess", () => {
    const routesSrc = readFileSync(
      path.resolve(__dirname, "../routes.ts"),
      "utf-8"
    );
    expect(routesSrc).not.toContain("requireAiAccess");
  });
});
