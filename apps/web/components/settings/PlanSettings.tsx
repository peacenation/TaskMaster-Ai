import Link from "next/link";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";

// Settings › Plan: what you're on, and the way to change it.
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
    <section aria-labelledby="plan-heading">
      <h2 id="plan-heading">Plan</h2>
      <p>
        You’re on <strong>{plan === "pro" ? "Pro" : "Free"}</strong>
        {plan === "pro" && renewsAt && status !== "canceled" && ` · renews ${renewsAt}`}
        {status === "past_due" && " · payment needs attention"}
      </p>
      <div className="button-row">
        {plan === "free" && canBuy && (
          <form action={startCheckout}>
            <button className="btn btn-primary" type="submit">
              Upgrade to Pro
            </button>
          </form>
        )}
        {hasBilling && canBuy && (
          <form action={openBillingPortal}>
            <button className="btn btn-secondary" type="submit">
              Manage billing
            </button>
          </form>
        )}
        <Link className="btn btn-secondary" href="/pricing">
          Compare plans
        </Link>
      </div>
    </section>
  );
}
