import { describe, expect, it, vi } from "vitest";
import { fixedClock } from "@/lib/domain/clock";
import { extract } from "@/lib/domain/extract";
import type { ExtractionProposal } from "@/lib/domain/proposal";
import { FALLBACK_MESSAGES, organiseBrainDump, type OrganiseDeps } from "./organise";

// Phase 5 exit criterion: "Killing the network mid-request preserves the
// raw dump and offers the heuristic path — verified by test, not by
// inspection." These drive the real browser-side flow with the network
// failing at each point it can fail.

const RAW = "Call John tomorrow at 2pm, book the dentist";
const clock = fixedClock("2026-10-05T08:00:00Z");
const extractLocally = (text: string) => extract(text, { clock, timeZone: "Europe/London" });
const aiProposal: ExtractionProposal = {
  engine: "ai",
  items: [
    {
      kind: "task",
      title: "Call John",
      deadline: null,
      recurrence: null,
      estimatedMinutes: null,
      project: null,
    },
  ],
};
const networkDown = () => Promise.reject(new TypeError("Failed to fetch"));

function deps(overrides: Partial<OrganiseDeps>): OrganiseDeps {
  return {
    saveDump: vi.fn(async () => ({ id: "dump-1" })),
    requestExtraction: vi.fn(async () => ({ proposal: aiProposal, fallbackReason: null })),
    extractLocally: vi.fn(extractLocally),
    ...overrides,
  };
}

describe("organiseBrainDump", () => {
  it("saves the raw text before asking for extraction", async () => {
    const order: string[] = [];
    const d = deps({
      saveDump: vi.fn(async () => {
        order.push("save");
        return { id: "dump-1" };
      }),
      requestExtraction: vi.fn(async () => {
        order.push("extract");
        return { proposal: aiProposal, fallbackReason: null };
      }),
    });
    await organiseBrainDump(RAW, d);
    expect(order).toEqual(["save", "extract"]);
    expect(d.saveDump).toHaveBeenCalledWith(RAW);
  });

  it("uses the server's proposal when everything works", async () => {
    const result = await organiseBrainDump(RAW, deps({}));
    expect(result).toEqual({ dumpId: "dump-1", proposal: aiProposal, fallbackReason: null });
  });

  it("passes through the server's own fallback reason", async () => {
    const heuristic = extractLocally(RAW);
    const result = await organiseBrainDump(
      RAW,
      deps({
        requestExtraction: async () => ({
          proposal: heuristic,
          fallbackReason: "rate_limited",
        }),
      })
    );
    expect(result.fallbackReason).toBe("rate_limited");
  });

  it("network dies after the save: the dump is kept and the heuristic runs locally", async () => {
    const d = deps({ requestExtraction: vi.fn(networkDown) });
    const result = await organiseBrainDump(RAW, d);
    expect(result.dumpId).toBe("dump-1");
    expect(result.fallbackReason).toBe("offline");
    expect(result.proposal.engine).toBe("heuristic");
    expect(result.proposal.items.map((i) => i.title)).toEqual([
      "Call John",
      "Book the dentist",
    ]);
    expect(d.extractLocally).toHaveBeenCalledWith(RAW);
  });

  it("network dies before the save: nothing is lost — the text is still offered for review, flagged unsaved", async () => {
    const d = deps({ saveDump: vi.fn(networkDown), requestExtraction: vi.fn() });
    const result = await organiseBrainDump(RAW, d);
    expect(result.dumpId).toBeNull();
    expect(result.fallbackReason).toBe("offline");
    expect(result.proposal.items).toHaveLength(2);
    expect(d.requestExtraction).not.toHaveBeenCalled();
  });

  it("a timeout behaves like any other dropped request", async () => {
    const d = deps({
      requestExtraction: () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    });
    expect((await organiseBrainDump(RAW, d)).fallbackReason).toBe("offline");
  });

  it("has a user-facing message for every fallback reason", () => {
    for (const message of Object.values(FALLBACK_MESSAGES))
      expect(message.length).toBeGreaterThan(10);
  });
});
