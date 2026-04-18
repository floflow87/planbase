/**
 * Tests for aiOrchestrator.runAi
 *
 * Covers:
 * A) Provider resolution (openai / ollama / auto)
 * B) Ollama → OpenAI fallback when Ollama is unavailable (ECONNREFUSED)
 * C) OpenAI error classification
 * D) Successful Ollama call
 * E) Successful OpenAI call
 * F) No fallback for non-connection errors from Ollama
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => {
  function OpenAI() {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }
  return { default: OpenAI };
});

vi.mock("./aiService", () => ({
  callAi: vi.fn(),
  extractTextFromProseMirror: vi.fn(),
}));

vi.mock("./aiPrompts", () => ({
  aiPrompts: {
    chat: vi.fn().mockReturnValue("System: You are a helpful assistant."),
    summarize: vi.fn().mockReturnValue("System: Summarize the following."),
    extractActions: vi.fn().mockReturnValue("System: Extract actions."),
    classifyDocument: vi.fn().mockReturnValue("System: Classify document."),
    suggestCrmActions: vi.fn().mockReturnValue("System: Suggest CRM actions."),
    projectAnalysis: vi.fn().mockReturnValue("System: Analyze project."),
    improve: vi.fn().mockReturnValue("System: Improve the text."),
    recommendations: vi.fn().mockReturnValue("System: Give recommendations."),
    generateTicket: vi.fn().mockReturnValue("System: Generate a ticket."),
  },
}));

import { runAi } from "./aiOrchestrator";
import { callAi } from "./aiService";

const mockCallAi = callAi as ReturnType<typeof vi.fn>;

describe("aiOrchestrator.runAi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("A) Provider resolution", () => {
    it("uses openai when provider='openai' is requested explicitly", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "OpenAI response" } }],
      });

      const result = await runAi({
        type: "improve",
        context: { content: "fix this text" },
        provider: "openai",
      });

      expect(result.provider).toBe("openai");
      expect(result.text).toBe("OpenAI response");
      expect(mockCallAi).not.toHaveBeenCalled();
    });

    it("uses ollama when provider='ollama' is requested explicitly", async () => {
      mockCallAi.mockResolvedValue("Ollama response");

      const result = await runAi({
        type: "chat",
        context: { content: "hello" },
        provider: "ollama",
      });

      expect(result.provider).toBe("ollama");
      expect(result.text).toBe("Ollama response");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("uses ollama for type='chat' in auto mode", async () => {
      mockCallAi.mockResolvedValue("Ollama chat response");

      const result = await runAi({
        type: "chat",
        context: { content: "hello" },
        provider: "auto",
      });

      expect(result.provider).toBe("ollama");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("uses openai for structured types (extractActions) in auto mode", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ actions: ["Do X", "Do Y"] }) } }],
      });

      const result = await runAi({
        type: "extractActions",
        context: { content: "Meeting notes about X and Y" },
        provider: "auto",
      });

      expect(result.provider).toBe("openai");
      expect(mockCallAi).not.toHaveBeenCalled();
    });
  });

  describe("B) Ollama → OpenAI fallback", () => {
    it("falls back to OpenAI when Ollama is unavailable (ECONNREFUSED)", async () => {
      mockCallAi.mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:11434"));
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "OpenAI fallback response" } }],
      });

      const result = await runAi({
        type: "chat",
        context: { content: "hello" },
        provider: "ollama",
      });

      expect(mockCallAi).toHaveBeenCalledOnce();
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(result.provider).toBe("openai");
      expect(result.text).toBe("OpenAI fallback response");
    });

    it("falls back to OpenAI on ECONNRESET", async () => {
      mockCallAi.mockRejectedValue(new Error("ECONNRESET"));
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Fallback after reset" } }],
      });

      const result = await runAi({
        type: "chat",
        context: { content: "test" },
        provider: "ollama",
      });

      expect(result.provider).toBe("openai");
      expect(result.text).toBe("Fallback after reset");
    });

    it("falls back to OpenAI when Ollama error message contains 'Impossible de se connecter à Ollama'", async () => {
      mockCallAi.mockRejectedValue(new Error("Impossible de se connecter à Ollama"));
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "OpenAI took over" } }],
      });

      const result = await runAi({
        type: "chat",
        context: { content: "test" },
        provider: "ollama",
      });

      expect(result.provider).toBe("openai");
    });

    it("throws a classified error when BOTH Ollama and OpenAI fallback fail", async () => {
      mockCallAi.mockRejectedValue(new Error("ECONNREFUSED"));
      mockCreate.mockRejectedValue(new Error("quota exceeded: 429"));

      await expect(
        runAi({
          type: "chat",
          context: { content: "test" },
          provider: "ollama",
        })
      ).rejects.toThrow("Quota OpenAI dépassé");
    });
  });

  describe("C) OpenAI error classification", () => {
    it("throws quota error when OpenAI returns 429", async () => {
      mockCreate.mockRejectedValue(new Error("429 rate limit quota exceeded"));

      await expect(
        runAi({
          type: "improve",
          context: { content: "text" },
          provider: "openai",
        })
      ).rejects.toThrow("Quota OpenAI dépassé");
    });

    it("throws timeout error when OpenAI returns a timeout", async () => {
      mockCreate.mockRejectedValue(new Error("timeout: ETIMEDOUT"));

      await expect(
        runAi({
          type: "improve",
          context: { content: "text" },
          provider: "openai",
        })
      ).rejects.toThrow("Délai d'attente dépassé");
    });

    it("throws model unavailable error when OpenAI returns 404 model error", async () => {
      mockCreate.mockRejectedValue(new Error("model not found 404"));

      await expect(
        runAi({
          type: "improve",
          context: { content: "text" },
          provider: "openai",
        })
      ).rejects.toThrow("Modèle OpenAI indisponible");
    });

    it("throws a generic error for unknown OpenAI errors", async () => {
      mockCreate.mockRejectedValue(new Error("Something unexpected happened"));

      await expect(
        runAi({
          type: "improve",
          context: { content: "text" },
          provider: "openai",
        })
      ).rejects.toThrow("Erreur OpenAI");
    });
  });

  describe("D) Successful Ollama call", () => {
    it("returns text and provider=ollama on success", async () => {
      mockCallAi.mockResolvedValue("Generated Ollama text");

      const result = await runAi({
        type: "chat",
        context: { content: "Ask something" },
        provider: "ollama",
      });

      expect(result.provider).toBe("ollama");
      expect(result.text).toBe("Generated Ollama text");
      expect(result.data).toBeUndefined();
    });
  });

  describe("E) Successful OpenAI call with structured types", () => {
    it("returns parsed actions for extractActions type", async () => {
      const mockActions = ["Action A", "Action B", "Action C"];
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ actions: mockActions }) } }],
      });

      const result = await runAi({
        type: "extractActions",
        context: { content: "Some meeting notes" },
        provider: "openai",
      });

      expect(result.provider).toBe("openai");
      expect(result.data).toEqual({ actions: mockActions });
    });

    it("returns parsed suggestions for suggestCrmActions type", async () => {
      const mockSuggestions = ["Follow up with client", "Send proposal"];
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ suggestions: mockSuggestions }) } }],
      });

      const result = await runAi({
        type: "suggestCrmActions",
        context: { content: "Client hasn't responded" },
        provider: "openai",
      });

      expect(result.provider).toBe("openai");
      expect(result.data).toEqual({ suggestions: mockSuggestions });
    });

    it("returns summary text for summarize type", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ summary: "This is a summary." }) } }],
      });

      const result = await runAi({
        type: "summarize",
        context: { content: "Long text to summarize..." },
        provider: "openai",
      });

      expect(result.provider).toBe("openai");
      expect(result.text).toBe("This is a summary.");
    });
  });

  describe("F) Non-connection Ollama errors are NOT retried with OpenAI", () => {
    it("throws immediately for Ollama timeout without calling OpenAI", async () => {
      mockCallAi.mockRejectedValue(new Error("Délai d'attente de 60 secondes dépassé"));

      await expect(
        runAi({
          type: "chat",
          context: { content: "test" },
          provider: "ollama",
        })
      ).rejects.toThrow("Délai d'attente dépassé");

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
