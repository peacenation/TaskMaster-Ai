import Link from "next/link";
import { finishOnboarding } from "@/app/actions/account";
import { aiOrganisingEnabled } from "@/lib/ai/client";
import { Button } from "@/components/ui";
import { BrainDumpFlow } from "@/components/capture/BrainDumpFlow";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function BrainDumpPage() {
  const userId = await getCurrentUserId();
  const projects = await withRepositories(userId, (repos) => repos.projects.list());
  return (
    <div className="wrap wrap-wide">
      <header className="hero">
        <p className="eyebrow">Brain Dump</p>
        <h1>Empty your head</h1>
        <p>
          Everything you write is saved before it&apos;s organised, so nothing you type is
          lost.
        </p>
        <p className="field-hint">
          {aiOrganisingEnabled()
            ? "Organising sends this text to Anthropic's Claude to suggest tasks. "
            : "Organising runs on TaskMaster's own server; no AI service is used. "}
          <Link href="/privacy">How your data is handled</Link>
        </p>
      </header>
      <BrainDumpFlow existingProjects={projects.map((p) => p.name)} />
      <form action={finishOnboarding}>
        <Button variant="secondary" type="submit">
          Go to Today
        </Button>
      </form>
    </div>
  );
}
