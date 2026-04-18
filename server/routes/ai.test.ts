import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

vi.mock("../db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })),
  },
}));

vi.mock("../services/billingService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/billingService")>();
  return {
    ...actual,
    hasFeature: vi.fn(),
  };
});

vi.mock("../middleware/auth", () => ({
  requireAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.accountId = (req.headers["x-account-id"] as string) ?? undefined;
    next();
  }),
}));

vi.mock("../services/aiOrchestrator", () => ({
  runAi: vi.fn().mockResolvedValue({ text: "ok" }),
}));

vi.mock("../services/aiContextBuilder", () => ({
  buildProjectContext: vi.fn().mockResolvedValue(null),
  buildNoteContext: vi.fn().mockResolvedValue(null),
  buildDocumentContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/embeddingService", () => ({
  searchSimilarNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock("../storage", () => ({
  storage: {
    getNote: vi.fn().mockResolvedValue(null),
    getProjectsByAccountId: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from "../db";
import { hasFeature } from "../services/billingService";
import aiRouter from "./ai";

const mockDb = db as { execute: ReturnType<typeof vi.fn> };
const mockHasFeature = hasFeature as unknown as ReturnType<typeof vi.fn>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRouter);
  return app;
}

describe("AI router — route-level access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("A) Free-plan users → 403 on all representative endpoints", () => {
    beforeEach(() => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "user@example.com" },
      ]);
      mockHasFeature.mockReturnValue(false);
    });

    const representativeEndpoints = [
      { path: "/api/ai/chat", body: { message: "hello" } },
      { path: "/api/ai/search-context", body: { query: "test" } },
      { path: "/api/ai/project-analysis", body: { project: { name: "Proj" } } },
      { path: "/api/ai/generate-ticket", body: { title: "Fix bug" } },
      { path: "/api/ai/summarize", body: { content: "some text" } },
      { path: "/api/ai/improve", body: { content: "some text" } },
      { path: "/api/ai/recommendations", body: { content: "some text" } },
    ];

    for (const { path, body } of representativeEndpoints) {
      it(`returns 403 for a freelance account on POST ${path}`, async () => {
        const app = buildApp();
        const res = await request(app)
          .post(path)
          .set("x-account-id", "account-free")
          .send(body);

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          error: "PLAN_REQUIRED",
          requiredPlan: "agency",
        });
      });
    }

    it("returns 403 for a starter-plan account", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "starter", subscription_status: "active", owner_email: "starter@example.com" },
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .set("x-account-id", "account-free")
        .send({ message: "hello" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("PLAN_REQUIRED");
    });

    it("returns 403 for an agency account with a cancelled subscription", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "canceled", owner_email: "ex@example.com" },
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .set("x-account-id", "account-free")
        .send({ message: "hello" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("PLAN_REQUIRED");
    });
  });

  describe("B) Agency-plan users → pass the access gate", () => {
    beforeEach(() => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "active", owner_email: "agency@example.com" },
      ]);
      mockHasFeature.mockReturnValue(true);
    });

    it("returns 200 with a response body for an agency account on POST /api/ai/chat", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .set("x-account-id", "account-agency")
        .send({ message: "hello" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ response: "ok", sources: [] });
    });

    it("does NOT return 403 for a trialing agency account", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "trialing", owner_email: "trial@example.com" },
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .set("x-account-id", "account-agency")
        .send({ message: "hello" });

      expect(res.status).not.toBe(403);
    });

    it("does NOT return 403 for the admin bypass email regardless of plan", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "floflow87@planbase.io" },
      ]);

      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .set("x-account-id", "account-agency")
        .send({ message: "hello" });

      expect(res.status).not.toBe(403);
      expect(mockHasFeature).not.toHaveBeenCalled();
    });
  });

  describe("C) Unauthenticated requests (no accountId) → 401", () => {
    it("returns 401 when no accountId header is present", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/ai/chat")
        .send({ message: "hello" });

      expect(res.status).toBe(401);
    });
  });
});
