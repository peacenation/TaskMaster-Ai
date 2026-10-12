import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AiExtractionError,
  createClaudeExtractor,
  EXTRACTION_MODEL,
  hasClaudeCredentials,
} from "./client";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";

// No network: a stand-in for client.beta.messages.parse records the
// request and returns canned responses. This checks the request we send
// and how each response is handled — not Claude's behaviour, which needs a
// live, paid call (see ADR-011).

type ParseArgs = [Record<string, unknown>, Record<string, unknown>];

function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn<(...args: ParseArgs) => Promise<Record<string, unknown>>>(
    async () => response
  );
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { client, parse };
}

const request = {
  rawText: "Call John tomorrow",
  now: new Date("2026-10-05T08:00:00Z"),
  timeZone: "Europe/London",
};

describe("createClaudeExtractor", () => {
  it("sends a cacheable stable prefix, keeps 'now' out of it, and asks for structured output", async () => {
    const { client, parse } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { items: [] },
    });
    await createClaudeExtractor(client)(request);

    const [params, options] = parse.mock.calls[0];
    expect(params).toMatchObject({
      model: EXTRACTION_MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      output_config: { effort: "low" },
    });
    // The volatile parts live in the user turn, so the system prefix can cache.
    expect(EXTRACTION_SYSTEM_PROMPT).not.toContain("2026-10-05T08:00:00");
    const messages = params.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain("2026-10-05T08:00:00.000Z");
    expect(messages[0].content).toContain("Europe/London");
    expect(messages[0].content).toContain("Call John tomorrow");
    expect(options).toMatchObject({ maxRetries: 0 });
  });

  it("returns the parsed output", async () => {
    const output = { items: [] };
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: output });
    await expect(createClaudeExtractor(client)(request)).resolves.toBe(output);
  });

  it.each([
    ["a refusal", { stop_reason: "refusal", parsed_output: null }, "refused"],
    [
      "truncated output",
      { stop_reason: "max_tokens", parsed_output: null },
      "invalid_response",
    ],
    [
      "output that failed the schema",
      { stop_reason: "end_turn", parsed_output: null },
      "invalid_response",
    ],
  ])("treats %s as a failure", async (_label, response, reason) => {
    const { client } = fakeClient(response);
    const attempt = createClaudeExtractor(client)(request);
    await expect(attempt).rejects.toBeInstanceOf(AiExtractionError);
    await expect(attempt).rejects.toMatchObject({ reason });
  });
});

describe("hasClaudeCredentials", () => {
  const noProfileHome = "/nonexistent-home-for-tests";

  it("is false with no credential source at all", () => {
    expect(hasClaudeCredentials({}, noProfileHome)).toBe(false);
  });

  it.each([
    ["an API key", { ANTHROPIC_API_KEY: "x" }],
    ["an auth token", { ANTHROPIC_AUTH_TOKEN: "x" }],
    ["a named profile", { ANTHROPIC_PROFILE: "work" }],
    ["workload identity federation", { ANTHROPIC_FEDERATION_RULE_ID: "x" }],
  ])("is true with %s", (_label, env) => {
    expect(hasClaudeCredentials(env, noProfileHome)).toBe(true);
  });

  it("is true with a default `ant auth login` profile on disk", () => {
    const home = mkdtempSync(join(tmpdir(), "tm-home-"));
    mkdirSync(join(home, ".config", "anthropic"), { recursive: true });
    expect(hasClaudeCredentials({}, home)).toBe(true);
  });
});
