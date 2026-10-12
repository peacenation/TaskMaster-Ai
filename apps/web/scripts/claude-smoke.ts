import { config } from "dotenv";
import { createClaudeExtractor, hasClaudeCredentials } from "../lib/ai/client";
import { toProposal } from "../lib/ai/schema";
import {
  PRD_BRAIN_DUMP,
  PRD_CLOCK,
  PRD_TIME_ZONE,
} from "../lib/domain/__fixtures__/prd-worked-example";

config({ path: ".env.local", quiet: true });
async function main() {
  if (!hasClaudeCredentials()) {
    console.log(
      "Claude smoke test unavailable: no credentials configured. Heuristic capture remains available."
    );
    process.exitCode = 2;
    return;
  }
  const output = await createClaudeExtractor()({
    rawText: PRD_BRAIN_DUMP,
    now: PRD_CLOCK.now(),
    timeZone: PRD_TIME_ZONE,
  });
  const proposal = toProposal(output);
  const find = (word: string) =>
    proposal.items.find((item) => item.title.toLowerCase().includes(word));
  if (
    proposal.items.length !== 7 ||
    new Date(find("report")?.deadline?.at ?? "").toISOString() !==
      "2026-10-08T16:00:00.000Z" ||
    find("dentist")?.kind !== "task" ||
    find("garage")?.kind !== "project" ||
    find("gym")?.recurrence?.timesPerPeriod !== 3 ||
    find("business")?.kind !== "goal"
  ) {
    throw new Error("Claude output failed the PRD worked-example contract.");
  }
  console.log(
    "Live Claude extraction passed: seven validated, individually reviewable PRD items; dates and kinds correct."
  );
}
main().catch(() => {
  console.error("Live Claude extraction failed; no application data was written.");
  process.exitCode = 1;
});
