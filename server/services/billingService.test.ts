/**
 * Tests for billingService feature gating
 *
 * Covers:
 * A) hasFeature returns false for free/starter plans
 * B) hasFeature returns true only for agency plan with active status
 * C) isSubscriptionActive status checks
 * D) ai_assistant feature is correctly gated to agency plan
 */

import { describe, it, expect } from "vitest";
import { hasFeature, isSubscriptionActive } from "./billingService";

describe("billingService", () => {
  describe("A) hasFeature — free / starter plans cannot access ai_assistant", () => {
    it("returns false for freelance plan with null status", () => {
      expect(hasFeature("freelance", null, "ai_assistant")).toBe(false);
    });

    it("returns false for freelance plan with active status", () => {
      expect(hasFeature("freelance", "active", "ai_assistant")).toBe(false);
    });

    it("returns false for starter plan with active status (normalised to freelance)", () => {
      expect(hasFeature("starter", "active", "ai_assistant")).toBe(false);
    });

    it("returns false for null plan with active status", () => {
      expect(hasFeature(null, "active", "ai_assistant")).toBe(false);
    });

    it("returns false for undefined plan with active status", () => {
      expect(hasFeature(undefined, "active", "ai_assistant")).toBe(false);
    });
  });

  describe("B) hasFeature — agency plan", () => {
    it("returns true for agency plan with active subscription", () => {
      expect(hasFeature("agency", "active", "ai_assistant")).toBe(true);
    });

    it("returns true for agency plan with trialing subscription", () => {
      expect(hasFeature("agency", "trialing", "ai_assistant")).toBe(true);
    });

    it("returns true for agency plan with past_due subscription", () => {
      expect(hasFeature("agency", "past_due", "ai_assistant")).toBe(true);
    });

    it("returns false for agency plan with canceled subscription", () => {
      expect(hasFeature("agency", "canceled", "ai_assistant")).toBe(false);
    });

    it("returns false for agency plan with incomplete subscription", () => {
      expect(hasFeature("agency", "incomplete", "ai_assistant")).toBe(false);
    });

    it("returns false for agency plan with incomplete_expired subscription", () => {
      expect(hasFeature("agency", "incomplete_expired", "ai_assistant")).toBe(false);
    });

    it("returns false for agency plan with unpaid subscription", () => {
      expect(hasFeature("agency", "unpaid", "ai_assistant")).toBe(false);
    });

    it("returns false for agency plan with null subscription status", () => {
      expect(hasFeature("agency", null, "ai_assistant")).toBe(false);
    });
  });

  describe("C) isSubscriptionActive", () => {
    it("returns true for active", () => {
      expect(isSubscriptionActive("active")).toBe(true);
    });

    it("returns true for trialing", () => {
      expect(isSubscriptionActive("trialing")).toBe(true);
    });

    it("returns true for past_due", () => {
      expect(isSubscriptionActive("past_due")).toBe(true);
    });

    it("returns false for canceled", () => {
      expect(isSubscriptionActive("canceled")).toBe(false);
    });

    it("returns false for incomplete", () => {
      expect(isSubscriptionActive("incomplete")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isSubscriptionActive(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isSubscriptionActive(undefined)).toBe(false);
    });
  });

  describe("D) ai_assistant is gated to agency plan only", () => {
    const allPlans = ["freelance", "agency", "starter", null, undefined] as const;
    const activeStatuses = ["active", "trialing", "past_due"] as const;

    for (const plan of allPlans) {
      for (const status of activeStatuses) {
        const shouldPass = plan === "agency";
        it(`hasFeature(${String(plan)}, ${status}, 'ai_assistant') → ${shouldPass}`, () => {
          expect(hasFeature(plan, status, "ai_assistant")).toBe(shouldPass);
        });
      }
    }
  });
});
