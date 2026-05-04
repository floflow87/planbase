/**
 * Tests for alertService — threshold-based sustained-degradation detection
 *
 * Covers:
 * A) Threshold configuration (env var parsing + defaults)
 * B) No alert when count is below threshold
 * C) Alert fires when count reaches or exceeds threshold
 * D) Cooldown suppresses a second alert within the window
 * E) Cooldown expiry re-enables alerting
 * F) No alert when no channel is configured
 * G) DB error during threshold check is handled gracefully
 * H) Log insert is awaited before threshold check (ordering guarantee)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockCountSince = vi.hoisted(() => vi.fn<[Date], Promise<number>>());
const mockLogEvent = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockEmailSend = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockGetResendClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    client: { emails: { send: mockEmailSend } },
    fromEmail: "noreply@planbase.dev",
  })
);
const mockFetch = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));

vi.mock("../storage", () => ({
  storage: {
    logAiFallbackEvent: mockLogEvent,
    countAiFallbackEventsSince: mockCountSince,
  },
}));

vi.mock("./emailService", () => ({
  getResendClient: mockGetResendClient,
}));

globalThis.fetch = mockFetch as typeof globalThis.fetch;

// ── Import after mocks ────────────────────────────────────────────────────────

import { alertOllamaFallback, _test } from "./alertService";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush the microtask queue without relying on setTimeout (safe with fake clocks). */
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

function makeParams(overrides: Partial<{ promptType: string; errorMessage: string }> = {}) {
  return {
    promptType: overrides.promptType ?? "chat",
    timestamp: new Date(),
    errorMessage: overrides.errorMessage,
    fallbackSucceeded: true,
  };
}

/** Count how many times mockEmailSend was called with a "sustained degradation" subject. */
function countThresholdEmails(): number {
  return mockEmailSend.mock.calls.filter((call) => {
    const arg = call[0] as Record<string, unknown>;
    return typeof arg?.subject === "string" && arg.subject.includes("sustained degradation");
  }).length;
}

/** Count how many times mockFetch was called with the sustained-degradation webhook payload. */
function countThresholdWebhooks(): number {
  return (mockFetch as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => {
    const opts = call[1] as RequestInit | undefined;
    if (!opts?.body) return false;
    try {
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      return body.event === "ai_provider_sustained_degradation";
    } catch {
      return false;
    }
  }).length;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("alertService — threshold-based degradation detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset ALL module-level state between tests
    _test.resetAllState();
    // Default env: email channel configured, no webhook
    process.env.ALERT_EMAIL = "team@example.com";
    delete process.env.ALERT_WEBHOOK_URL;
    // Default: count stays below threshold
    mockCountSince.mockResolvedValue(0);
  });

  afterEach(() => {
    // Ensure any dedup window timers left over don't bleed into the next test
    _test.resetAllState();
    vi.useRealTimers();
  });

  // ── A) Configuration defaults ─────────────────────────────────────────────

  describe("A) Threshold configuration", () => {
    it("exposes THRESHOLD_COUNT as a positive integer", () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      expect(THRESHOLD_COUNT).toBeGreaterThanOrEqual(1);
    });

    it("exposes THRESHOLD_WINDOW_MINUTES as a positive integer", () => {
      const { THRESHOLD_WINDOW_MINUTES } = _test.getThresholdConfig();
      expect(THRESHOLD_WINDOW_MINUTES).toBeGreaterThanOrEqual(1);
    });

    it("exposes THRESHOLD_COOLDOWN_MINUTES as a positive integer", () => {
      const { THRESHOLD_COOLDOWN_MINUTES } = _test.getThresholdConfig();
      expect(THRESHOLD_COOLDOWN_MINUTES).toBeGreaterThanOrEqual(1);
    });
  });

  // ── B) No alert when count is below threshold ─────────────────────────────

  describe("B) No threshold alert when count is below threshold", () => {
    it("does not send a threshold email when recent count < threshold", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT - 1);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(countThresholdEmails()).toBe(0);
    });

    it("does not send a threshold webhook when recent count < threshold", async () => {
      process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alert";
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT - 1);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(countThresholdWebhooks()).toBe(0);
    });

    it("does NOT record a threshold alert timestamp when below threshold", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT - 1);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(_test.getLastThresholdAlertAt()).toBeNull();
    });
  });

  // ── C) Alert fires at / above threshold ──────────────────────────────────

  describe("C) Threshold alert fires when count reaches or exceeds threshold", () => {
    it("sends a threshold email when count equals threshold", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(countThresholdEmails()).toBe(1);
    });

    it("sends a threshold email when count exceeds threshold", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT + 5);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(countThresholdEmails()).toBe(1);
    });

    it("includes the actual fallback count in the email subject", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      const count = THRESHOLD_COUNT + 7;
      mockCountSince.mockResolvedValue(count);

      await alertOllamaFallback(makeParams());
      await flush();

      const subjectCall = mockEmailSend.mock.calls.find((call) => {
        const arg = call[0] as Record<string, unknown>;
        return typeof arg?.subject === "string" && arg.subject.includes("sustained degradation");
      });
      const subject = (subjectCall?.[0] as Record<string, unknown>)?.subject as string;
      expect(subject).toContain(String(count));
    });

    it("sends a threshold webhook with event=ai_provider_sustained_degradation", async () => {
      process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alert";
      delete process.env.ALERT_EMAIL;
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(countThresholdWebhooks()).toBeGreaterThanOrEqual(1);
    });

    it("records the timestamp of the threshold alert", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT);

      expect(_test.getLastThresholdAlertAt()).toBeNull();
      await alertOllamaFallback(makeParams());
      await flush();

      expect(_test.getLastThresholdAlertAt()).toBeInstanceOf(Date);
    });
  });

  // ── D) Cooldown suppresses duplicate alerts ───────────────────────────────

  describe("D) Cooldown suppresses a second threshold alert within the window", () => {
    it("fires only one threshold email for two consecutive fallbacks above threshold", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT);

      // First fallback → crosses threshold → alert fires
      await alertOllamaFallback(makeParams());
      await flush();
      expect(countThresholdEmails()).toBe(1);

      // Second fallback — still above threshold but inside cooldown → suppressed
      await alertOllamaFallback(makeParams());
      await flush();
      expect(countThresholdEmails()).toBe(1); // still only 1
    });
  });

  // ── E) Cooldown expiry re-enables alerting ────────────────────────────────

  describe("E) Cooldown expiry re-enables alerting", () => {
    it("sends a second threshold alert after the cooldown period has elapsed", async () => {
      const { THRESHOLD_COUNT, THRESHOLD_COOLDOWN_MINUTES } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT);

      // Use fake system clock to control Date.now()
      vi.useFakeTimers();

      // First alert
      await alertOllamaFallback(makeParams());
      await flush();
      expect(countThresholdEmails()).toBe(1);

      // Advance the clock past the cooldown window
      vi.advanceTimersByTime(THRESHOLD_COOLDOWN_MINUTES * 60 * 1000 + 1000);

      // Second alert after cooldown expiry
      await alertOllamaFallback(makeParams());
      await flush();
      expect(countThresholdEmails()).toBe(2);

      vi.useRealTimers();
    }, 15000);
  });

  // ── F) No alert when no channel is configured ─────────────────────────────

  describe("F) No alert when no channel is configured", () => {
    it("skips the DB count query when neither email nor webhook is set", async () => {
      delete process.env.ALERT_EMAIL;
      delete process.env.ALERT_WEBHOOK_URL;

      const { THRESHOLD_COUNT } = _test.getThresholdConfig();
      mockCountSince.mockResolvedValue(THRESHOLD_COUNT + 100);

      await alertOllamaFallback(makeParams());
      await flush();

      expect(mockCountSince).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // ── G) DB error is handled gracefully ────────────────────────────────────

  describe("G) DB error during threshold check is handled gracefully", () => {
    it("does not throw when countAiFallbackEventsSince rejects", async () => {
      mockCountSince.mockRejectedValue(new Error("DB connection lost"));

      await expect(alertOllamaFallback(makeParams())).resolves.not.toThrow();
      await flush();
    });

    it("does not record a threshold alert timestamp when DB query fails", async () => {
      mockCountSince.mockRejectedValue(new Error("DB connection lost"));

      await alertOllamaFallback(makeParams());
      await flush();

      expect(_test.getLastThresholdAlertAt()).toBeNull();
    });
  });

  // ── H) Ordering guarantee: log insert completes before threshold check ────

  describe("H) Log insert completes before threshold count query", () => {
    it("always calls logAiFallbackEvent before countAiFallbackEventsSince", async () => {
      const callOrder: string[] = [];
      mockLogEvent.mockImplementation(async () => {
        callOrder.push("log");
        return {};
      });
      mockCountSince.mockImplementation(async () => {
        callOrder.push("count");
        return 0;
      });

      await alertOllamaFallback(makeParams());
      await flush();

      const logIdx = callOrder.indexOf("log");
      const countIdx = callOrder.indexOf("count");
      expect(logIdx).toBeGreaterThanOrEqual(0);
      expect(countIdx).toBeGreaterThanOrEqual(0);
      expect(logIdx).toBeLessThan(countIdx);
    });
  });

  // ── I) Concurrent fallback burst detects threshold crossing ───────────────

  describe("I) Concurrent fallback burst reliably detects threshold crossing", () => {
    it("fires a threshold alert even when fallbacks arrive while a check is in-flight", async () => {
      const { THRESHOLD_COUNT } = _test.getThresholdConfig();

      // First count call returns below threshold (in-flight check during burst).
      // The queued rerun sees count at threshold — simulating events persisted
      // between the two DB queries.
      let callN = 0;
      mockCountSince.mockImplementation(async () => {
        callN++;
        return callN === 1 ? THRESHOLD_COUNT - 1 : THRESHOLD_COUNT;
      });

      // Fire two concurrent fallbacks — the second one sets thresholdCheckPending=true.
      await Promise.all([
        alertOllamaFallback(makeParams()),
        alertOllamaFallback(makeParams()),
      ]);
      // Extra flush rounds to let the queued rerun complete.
      for (let i = 0; i < 30; i++) await Promise.resolve();

      expect(countThresholdEmails()).toBe(1);
    });
  });
});
