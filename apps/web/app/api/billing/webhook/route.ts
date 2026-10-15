import { revalidatePath } from "next/cache";
import { StripeError, verifyWebhook } from "@/lib/billing/stripe";
import { planChangeFor } from "@/lib/billing/webhook";
import { withRepositories } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Stripe → plan changes. The only writer of a user's plan: nothing a
// signed-in user sends can change it. Configure the endpoint in Stripe
// (Developers → Webhooks) for checkout.session.completed and
// customer.subscription.created/updated/deleted.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Billing isn't configured." }, { status: 503 });
  let event;
  try {
    event = verifyWebhook(
      await request.text(),
      request.headers.get("stripe-signature"),
      secret
    );
  } catch (error) {
    const message = error instanceof StripeError ? error.message : "Invalid payload.";
    return Response.json({ error: message }, { status: 400 });
  }
  const change = planChangeFor(event);
  if (!change) return Response.json({ received: true });
  if (!change.userId) {
    // ADR-010: ids only. A subscription made outside Checkout has no user.
    console.warn(
      JSON.stringify({ event: "billing.unmatched", type: event.type, id: event.id })
    );
    return Response.json({ received: true });
  }
  const userId = change.userId;
  try {
    await withRepositories(userId, (repos) => repos.users.setPlan(change));
  } catch {
    // Stripe retries on a 5xx, so a transient database error isn't lost.
    return Response.json({ error: "Could not record the change." }, { status: 500 });
  }
  console.info(JSON.stringify({ event: "billing.plan", type: event.type, plan: change.plan }));
  revalidatePath("/", "layout");
  return Response.json({ received: true });
}
