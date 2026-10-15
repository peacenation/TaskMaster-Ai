import Link from "next/link";
import { startCheckout } from "@/app/actions/billing";
import { billingEnabled, PLAN_FEATURES, proPriceLabel } from "@/lib/billing/plans";
import { withRepositories } from "@/lib/repo";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Free and Pro (PRD §5.1). Public, so it can be read before signing up.
export default async function PricingPage() {
  const session = await getSession();
  const plan = session
    ? ((await withRepositories(session.user.id, (repos) => repos.users.profile()))?.plan ??
      "free")
    : null;
  const canBuy = billingEnabled();
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Plans</p>
        <h1>Free shows the value. Pro does more of it for you.</h1>
        <p>Everything you need to plan your day is free. Pro adds capacity, not walls.</p>
      </header>
      <div className="pricing-grid">
        <section className="dash-card pricing-card" aria-labelledby="free-heading">
          <h2 id="free-heading">Free</h2>
          <p className="pricing-price">£0</p>
          <ul>
            {PLAN_FEATURES.free.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {plan === null ? (
            <Link className="btn btn-secondary" href="/signup">
              Start free
            </Link>
          ) : plan === "free" ? (
            <p className="field-hint">Your current plan.</p>
          ) : null}
        </section>
        <section
          className="dash-card pricing-card pricing-card-pro"
          aria-labelledby="pro-heading"
        >
          <h2 id="pro-heading">Pro</h2>
          <p className="pricing-price">{proPriceLabel()}</p>
          <ul>
            {PLAN_FEATURES.pro.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {plan === "pro" ? (
            <p className="field-hint">Your current plan.</p>
          ) : !canBuy ? (
            <p className="field-hint">Coming soon. Every account has Pro limits until then.</p>
          ) : plan === null ? (
            <Link className="btn btn-primary" href="/signup">
              Start free, upgrade any time
            </Link>
          ) : (
            <form action={startCheckout}>
              <button className="btn btn-primary" type="submit">
                Upgrade to Pro
              </button>
            </form>
          )}
        </section>
      </div>
      <p className="field-hint">
        Cancel any time from Settings. Cancelling never deletes your tasks or plans.
      </p>
    </div>
  );
}
