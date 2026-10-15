"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { billingEnabled } from "@/lib/billing/plans";
import { createCheckout, createPortal } from "@/lib/billing/stripe";
import { getCurrentProfile } from "@/lib/server/session";

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Upgrade: off to Stripe Checkout, back to Settings when done. */
export async function startCheckout(): Promise<void> {
  if (!billingEnabled()) redirect("/pricing");
  const { profile } = await getCurrentProfile();
  if (profile.plan === "pro") redirect("/settings");
  const url = await createCheckout({
    userId: profile.id,
    email: profile.email,
    customerId: profile.stripeCustomerId,
    origin: await origin(),
  });
  redirect(url);
}

/** Manage billing: card, invoices, cancellation — Stripe's portal. */
export async function openBillingPortal(): Promise<void> {
  const { profile } = await getCurrentProfile();
  if (!billingEnabled() || !profile.stripeCustomerId) redirect("/settings");
  redirect(await createPortal(profile.stripeCustomerId, await origin()));
}
