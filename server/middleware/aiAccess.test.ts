/**
 * Tests for requireAiAccess middleware
 *
 * Covers:
 * A) Free-plan accounts → 403
 * B) Agency-plan accounts with active subscription → passes
 * C) Admin email bypass → passes regardless of plan
 * D) Missing accountId → 401
 * E) Cancelled/inactive subscriptions on agency plan → 403
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("../services/billingService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/billingService")>();
  return {
    ...actual,
    hasFeature: vi.fn(),
  };
});

import { db } from "../db";
import { hasFeature } from "../services/billingService";
import { requireAiAccess } from "./aiAccess";

function makeReq(accountId?: string): Request {
  return { accountId } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const mockDb = db as { execute: ReturnType<typeof vi.fn> };
const mockHasFeature = hasFeature as unknown as ReturnType<typeof vi.fn>;

describe("requireAiAccess middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("A) Missing accountId → 401", () => {
    it("returns 401 when accountId is undefined", async () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Non authentifié" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("B) Free-plan account → 403", () => {
    it("returns 403 for a freelance account with null status", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "user@example.com" },
      ]);
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-123");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "PLAN_REQUIRED",
          requiredPlan: "agency",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 for a starter account with active status", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "starter", subscription_status: "active", owner_email: "user@example.com" },
      ]);
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-starter");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 for an agency account with cancelled subscription", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "canceled", owner_email: "user@example.com" },
      ]);
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-canceled");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when account row is missing (defaults to freelance)", async () => {
      mockDb.execute.mockResolvedValue([]);
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-unknown");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("C) Agency-plan account → passes", () => {
    it("calls next() for an agency account with active subscription", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "active", owner_email: "owner@client.com" },
      ]);
      mockHasFeature.mockReturnValue(true);

      const req = makeReq("account-agency");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("calls next() for an agency account that is trialing", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "trialing", owner_email: "owner@client.com" },
      ]);
      mockHasFeature.mockReturnValue(true);

      const req = makeReq("account-trialing");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("calls next() for an agency account with past_due subscription", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "agency", subscription_status: "past_due", owner_email: "owner@client.com" },
      ]);
      mockHasFeature.mockReturnValue(true);

      const req = makeReq("account-past-due");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("D) Admin email bypass", () => {
    it("calls next() for floflow87@planbase.io regardless of plan", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "floflow87@planbase.io" },
      ]);

      const req = makeReq("account-admin");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(mockHasFeature).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("calls next() for demo@yopmail.com regardless of plan", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "demo@yopmail.com" },
      ]);

      const req = makeReq("account-demo");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(mockHasFeature).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("does NOT bypass for a non-admin email that resembles an admin email", async () => {
      mockDb.execute.mockResolvedValue([
        { plan: "freelance", subscription_status: null, owner_email: "floflow87+evil@planbase.io" },
      ]);
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-fake-admin");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("E) DB error → fails safe (403)", () => {
    it("returns 403 (not 500) when the DB query throws", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB connection failed"));
      mockHasFeature.mockReturnValue(false);

      const req = makeReq("account-db-error");
      const res = makeRes();
      const next = makeNext();

      await requireAiAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
