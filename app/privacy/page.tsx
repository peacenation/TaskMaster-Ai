import Link from "next/link";
import { aiOrganisingEnabled } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

// PRD v2 §1.11: "AI processing and connected services must be clearly
// disclosed." Public, so it can be read before signing up. Every statement
// here describes what the code does; change them together.

export default function PrivacyPage() {
  const aiOn = aiOrganisingEnabled();
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Privacy</p>
        <h1>What happens to what you write</h1>
      </header>

      <section aria-labelledby="ai-heading">
        <h2 id="ai-heading">AI organising</h2>
        <p>
          AI organising is currently <strong>{aiOn ? "on" : "off"}</strong> for this service.
        </p>
        <p>
          When it is on and you choose <strong>Organise it</strong>, the text of that Brain
          Dump, with today&apos;s date and your timezone, is sent to Anthropic&apos;s Claude
          API to suggest tasks. Nothing else from your account is sent. Each account can send a
          limited number per hour; after that, and whenever AI organising is off or
          unavailable, TaskMaster&apos;s built-in rules organise the text on our own server and
          say so on screen.
        </p>
        <p>
          Either way, suggestions are only a proposal: nothing becomes a task until you review
          and confirm it. Anthropic&apos;s handling of API data is described in its{" "}
          <a href="https://www.anthropic.com/legal/privacy" rel="noopener noreferrer">
            privacy policy
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="stored-heading">
        <h2 id="stored-heading">What is stored</h2>
        <ul>
          <li>
            Your name, email address, password (hashed, never readable), timezone and planning
            preferences.
          </li>
          <li>
            Your Brain Dumps, tasks, projects, goals, routines, plans, and the history of what
            you completed or postponed — that history is what reviews and insights are built
            from.
          </li>
          <li>
            For each signed-in session: when it expires, and the browser and IP address it
            started from, so a session can be recognised and ended.
          </li>
        </ul>
        <p>
          Your data is kept in a Postgres database where each account can only read its own
          rows. Error reports record which page failed and the type of error — never the
          content of your tasks or Brain Dumps.
        </p>
      </section>

      <section aria-labelledby="email-heading">
        <h2 id="email-heading">Email</h2>
        <p>
          Email is used only for sign-in links and password resets. Those messages contain a
          link and nothing about your tasks.
        </p>
      </section>

      <section aria-labelledby="cookies-heading">
        <h2 id="cookies-heading">Cookies</h2>
        <p>
          Two: one keeps you signed in, and one remembers your timezone so deadlines are read
          correctly. There are no analytics, advertising or tracking cookies.
        </p>
      </section>

      <section aria-labelledby="control-heading">
        <h2 id="control-heading">Your control</h2>
        <p>
          In <Link href="/settings">Settings</Link> you can download everything stored about
          you as a JSON file, or delete your account. Deleting removes your account and all of
          its data permanently.
        </p>
      </section>
    </div>
  );
}
