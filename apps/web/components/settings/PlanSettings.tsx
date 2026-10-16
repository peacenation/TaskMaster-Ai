import Link from "next/link";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";
import { ArrowRightIcon, SparkleIcon } from "@/components/shell/icons";
import { settingsHref } from "./sections";

function initials(name: string, email: string): string {
  const parts = (name.trim() || email).split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Settings sidebar › Your account: who is signed in, and how.
export function AccountCard({
  name,
  email,
  googleLinked,
}: {
  name: string;
  email: string;
  googleLinked: boolean;
}) {
  return (
    <section className="settings-card settings-side-card" aria-labelledby="account-heading">
      <h2 id="account-heading">Your account</h2>
      <div className="settings-account">
        <span className="settings-avatar" aria-hidden="true">
          {initials(name, email)}
        </span>
        <span>
          <strong>{name || email}</strong>
          <span className="settings-status">
            <span className="settings-dot" aria-hidden="true" />
            {googleLinked ? "Google connected" : "Email and password"}
          </span>
        </span>
      </div>
      <Link className="settings-link" href={settingsHref("profile")}>
        Manage account <ArrowRightIcon size={16} />
      </Link>
    </section>
  );
}

// Settings sidebar › Your plan: what you're on, and the way to change it.
export function PlanSettings({
  plan,
  status,
  renewsAt,
  canBuy,
  hasBilling,
}: {
  plan: "free" | "pro";
  status: string | null;
  renewsAt: string | null;
  canBuy: boolean;
  hasBilling: boolean;
}) {
  return (
    <section className="settings-card settings-side-card" aria-labelledby="plan-heading">
      <div className="settings-side-head">
        <h2 id="plan-heading">Your plan</h2>
        <span className="settings-plan-badge">{plan === "pro" ? "Pro" : "Free"}</span>
      </div>
      <p className="settings-card-lede">
        {plan === "pro"
          ? "Everything TaskMasterAi does, every day."
          : "A clear start to every day."}
        {plan === "pro" && renewsAt && status !== "canceled" && ` Renews ${renewsAt}.`}
        {status === "past_due" && " Payment needs attention."}
      </p>
      <div className="settings-side-actions">
        {plan === "free" && canBuy && (
          <form action={startCheckout}>
            <button className="btn btn-primary btn-sm" type="submit">
              Upgrade to Pro
            </button>
          </form>
        )}
        {hasBilling && canBuy && (
          <form action={openBillingPortal}>
            <button className="btn btn-secondary btn-sm" type="submit">
              Manage billing
            </button>
          </form>
        )}
        <Link
          className={`btn btn-sm ${plan === "free" && canBuy ? "btn-secondary" : "btn-primary"}`}
          href="/pricing"
        >
          Compare plans
        </Link>
      </div>
    </section>
  );
}

export function SettingsTip({ title, body }: { title: string; body: string }) {
  return (
    <aside className="settings-tip">
      <SparkleIcon size={28} />
      <h2>{title}</h2>
      <p>{body}</p>
    </aside>
  );
}
