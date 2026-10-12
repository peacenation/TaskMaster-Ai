"use client";

import { useState } from "react";
import { saveBrainDump } from "@/app/actions/capture";
import { Button, Field, Textarea } from "@/components/ui";
import { organiseBrainDump, type OrganiseResult } from "@/lib/capture/organise";
import { systemClock } from "@/lib/domain/clock";
import { extract } from "@/lib/domain/extract";
import { ExtractionReview } from "./ExtractionReview";

// Brain Dump composer → organise → review (PRD §2.4 User Flow 1). The
// text is saved before extraction is requested; if the network fails at
// any point the user still gets a reviewable proposal and keeps their
// words (lib/capture/organise.ts).

const EXTRACTION_TIMEOUT_MS = 40_000;

export function BrainDumpFlow({ existingProjects }: { existingProjects: string[] }) {
  const [rawText, setRawText] = useState("");
  const [organising, setOrganising] = useState(false);
  const [result, setResult] = useState<OrganiseResult | null>(null);

  async function organise() {
    setOrganising(true);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const organised = await organiseBrainDump(rawText, {
      saveDump: saveBrainDump,
      requestExtraction: async (brainDumpId) => {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brainDumpId }),
          signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`extract ${response.status}`);
        return response.json();
      },
      extractLocally: (text) => extract(text, { clock: systemClock, timeZone }),
    });
    setResult(organised);
    setOrganising(false);
  }

  if (result) {
    return (
      <>
        {result.dumpId === null && (
          <p className="notice notice-danger" role="alert">
            Your Brain Dump couldn&apos;t be saved yet — it will be saved along with your items
            when you press Save.
          </p>
        )}
        <ExtractionReview
          dumpId={result.dumpId}
          rawText={rawText}
          proposal={result.proposal}
          fallbackReason={result.fallbackReason}
          existingProjects={existingProjects}
        />
      </>
    );
  }

  return (
    <section id="capture">
      <h2>What&apos;s taking up space in your head right now?</h2>
      <p className="section-note">
        Add work, personal tasks, deadlines, things you&apos;ve been putting off, projects, or
        anything else you need to get done. Don&apos;t organise it first.
      </p>
      <Field label="Brain Dump" htmlFor="braindump">
        <Textarea
          id="braindump"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={8}
          placeholder={
            "I need to finish the quarterly report by Thursday, book the dentist, call Mum, go to the gym three times this week…"
          }
        />
      </Field>
      <div className="button-row">
        <Button onClick={organise} disabled={organising || rawText.trim().length === 0}>
          {organising ? "Organising…" : "Organise it"}
        </Button>
      </div>
    </section>
  );
}
