import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AiExtractionError, type AiExtractor } from "@/lib/ai/client";
import { fixedClock } from "@/lib/domain/clock";
import { extractWithFallback } from "./extract-with-fallback";

// Phase 5 exit criterion: "A malformed model response is rejected by Zod
// and falls back; it never reaches the database." The route stores
// `outcome.proposal` and nothing else, so proving a malformed response can
// never *become* the proposal proves it can never be stored.

const RAW = "Finish the quarterly report by Thursday, call Mum";
const options = { clock: fixedClock("2026-10-05T08:00:00Z"), timeZone: "Europe/London" };
const reject =
  (error: unknown): AiExtractor =>
  async () => {
    throw error;
  };

const validAiOutput = {
  items: [
    {
      kind: "task",
      title: "Finish the quarterly report",
      deadline: { at: "2026-10-08T17:00:00+01:00", confidence: 0.9, source: "by Thursday" },
      recurrence: null,
      estimatedMinutes: null,
      project: "Work",
    },
  ],
};

describe("extractWithFallback", () => {
  it("uses Claude's proposal when it's valid, labelled as AI", async () => {
    const outcome = await extractWithFallback(RAW, {
      ...options,
      ai: async () => validAiOutput,
    });
    expect(outcome.fallbackReason).toBeNull();
    expect(outcome.proposal.engine).toBe("ai");
    expect(outcome.proposal.items[0].title).toBe("Finish the quarterly report");
  });

  it("passes the clock's 'now' and the timezone to Claude", async () => {
    let seen: Parameters<AiExtractor>[0] | undefined;
    await extractWithFallback(RAW, {
      ...options,
      ai: async (request) => {
        seen = request;
        return validAiOutput;
      },
    });
    expect(seen).toMatchObject({ rawText: RAW, timeZone: "Europe/London" });
    expect(seen?.now.toISOString()).toBe("2026-10-05T08:00:00.000Z");
  });

  it("with AI switched off, runs the heuristic and says why", async () => {
    const outcome = await extractWithFallback(RAW, { ...options, ai: null });
    expect(outcome).toMatchObject({
      fallbackReason: "not_configured",
      proposal: { engine: "heuristic" },
    });
  });

  describe("malformed responses never become the proposal", () => {
    it.each([
      ["not even an object", "lol"],
      ["missing items", { things: [] }],
      ["an unknown kind", { items: [{ ...validAiOutput.items[0], kind: "chore" }] }],
      [
        "an impossible date",
        {
          items: [
            {
              ...validAiOutput.items[0],
              deadline: { at: "Thursday", confidence: 0.9, source: "x" },
            },
          ],
        },
      ],
      [
        "confidence above 1",
        {
          items: [
            {
              ...validAiOutput.items[0],
              deadline: { ...validAiOutput.items[0].deadline, confidence: 7 },
            },
          ],
        },
      ],
      ["an empty title", { items: [{ ...validAiOutput.items[0], title: "" }] }],
      [
        "a negative estimate",
        { items: [{ ...validAiOutput.items[0], estimatedMinutes: -5 }] },
      ],
    ])("%s", async (_label, output) => {
      const outcome = await extractWithFallback(RAW, { ...options, ai: async () => output });
      expect(outcome.fallbackReason).toBe("invalid_response");
      expect(outcome.proposal.engine).toBe("heuristic");
      expect(outcome.proposal.items.map((i) => i.title)).toEqual([
        "Finish the quarterly report",
        "Call Mum",
      ]);
    });
  });

  describe("every failure falls back to the heuristic, with the right reason", () => {
    it.each([
      ["timeout", new Anthropic.APIConnectionTimeoutError(), "timeout"],
      ["our own abort", new Anthropic.APIUserAbortError(), "timeout"],
      ["network", new Anthropic.APIConnectionError({ message: "ECONNRESET" }), "network"],
      [
        "rate limit",
        new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()),
        "rate_limited",
      ],
      [
        "bad key",
        new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers()),
        "not_configured",
      ],
      [
        // What the SDK actually throws with no credentials: a plain Error.
        // "Not set up" is detected *before* calling (hasClaudeCredentials),
        // so if this ever reaches the classifier it's an unexpected failure.
        "an untyped SDK error",
        new Error("Could not resolve authentication method."),
        "error",
      ],
      [
        "server error",
        new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers()),
        "error",
      ],
      ["refusal", new AiExtractionError("refused", "declined"), "refused"],
      ["something unexpected", new Error("boom"), "error"],
    ])("%s", async (_label, error, reason) => {
      const outcome = await extractWithFallback(RAW, { ...options, ai: reject(error) });
      expect(outcome.fallbackReason).toBe(reason);
      expect(outcome.proposal.engine).toBe("heuristic");
      expect(outcome.proposal.items).toHaveLength(2);
    });
  });
});
