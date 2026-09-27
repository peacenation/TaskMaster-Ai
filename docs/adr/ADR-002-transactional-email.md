# ADR-002 — Transactional email provider

- **Status:** Accepted
- **Date:** 2026-09-27
- **Deciders:** Product Owner, AI agent
- **Affects:** authentication email (Phase 8), notifications (Phase 3)
- **Related:** [ADR-000](ADR-000-scope-and-source-of-truth.md),
  [ADR-001](ADR-001-prototype-stack.md),
  [`../PRD_v2.md`](../PRD_v2.md) §1.9, §2.7, §4.1, §4.4
- **Supersedes:** nothing

---

## Context

TaskMaster sends email in two distinct places, at two different phases, and the
Product Owner asked whether **Amazon SES** should be used in preference to
**Resend** for email notification.

Before comparing providers, the two meanings of "email" in this product must be
separated, because they are different problems with different vendors and
conflating them is an easy and expensive mistake.

### Sending vs reading — the distinction that matters most

| Need | Example | Phase | Providers |
|---|---|---|---|
| **Send** transactional email | Magic links, password resets, notification emails | Phase 8 (auth), Phase 3 (notifications) | Amazon SES **or** Resend |
| **Read** a user's existing mailbox to detect commitments | "Find deadlines and requests in my inbox" | Phase 3, `PRD_v2.md` §4.1 P1 | **Gmail API / Microsoft Graph — neither SES nor Resend** |

**Amazon SES is not an email client.** It sends mail, and can receive mail via
inbound receipt, but it does not grant read access to a user's Gmail or Outlook
mailbox. Neither does Resend.

This matters because `PRD_v2.md` §4.1 lists **Email Integration** — "identify
possible commitments, deadlines, follow-ups, and requests" — as a Phase 3 P1
feature. That feature is about *reading* mail, and it is **not** satisfied by
choosing an email sending provider. It requires a separate OAuth integration
against the user's mail provider, and a separate decision.

Choosing SES over Resend therefore has **no effect** on the §4.1 Email
Integration feature. Recording that explicitly here so the two are not confused
later.

### The actual question: SES or Resend for sending

| | **Amazon SES** | **Resend** |
|---|---|---|
| Cost | ~$0.10 per 1,000 outbound emails | Free tier ~3,000/month, then per-email |
| Time to first production send | **Days to weeks** | Minutes |
| Onboarding | AWS account, IAM credentials, region selection, **production access request** | API key |
| Default state | **Sandbox** — can only send to verified addresses until production access is granted | Sends immediately |
| Account rejection risk | Material — new AWS accounts are frequently held for review | Low |
| Deliverability tooling | Excellent at volume: dedicated IPs, Virtual Deliverability Rate reputation dashboard | Good; deliberately simpler |
| Operational overhead | Region choice, credential rotation, CloudWatch integration, cost monitoring | Minimal |
| Developer experience | AWS SDK, SNS fan-out, IAM-scoped | Small clean API, first-class React Email support |
| Best fit | High volume, existing AWS footprint, enterprise deliverability requirements | Early stage, low volume, speed to first send |

*Pricing and free-tier figures should be verified against current vendor
pricing before budgeting; they change.*

---

## Decision

**D9 — Transactional email is sent through a provider interface. Resend is the
default. Amazon SES is preferred instead, and used instead, wherever an AWS
account already exists.**

**D10 — The provider is behind a single interface so the choice is swappable
without touching auth or notification code.**

**D11 — Email sending and email reading are separate concerns. Selecting a
sending provider does not deliver `PRD_v2.md` §4.1 Email Integration, which
requires a mailbox API integration and its own decision.**

### The interface

```ts
interface EmailProvider {
  send(message: {
    to: string
    subject: string
    html: string
    replyTo?: string
  }): Promise<void>
}
```

This mirrors the repository-interface decision already taken in
[ADR-000](ADR-000-scope-and-source-of-truth.md) D3 — infrastructure
dependencies sit behind a seam, so the domain and application layers never
import a vendor SDK. Migrating Resend → SES becomes one adapter file.

### The conditional rule, stated plainly

| Condition | Provider | Reason |
|---|---|---|
| **AWS account already exists** | **Amazon SES** | Already paid for and configured. Materially cheaper at volume. Superior deliverability tooling. No reason to add a second vendor |
| **No AWS account** | **Resend** | SES requires a production access request, defaults to sandbox mode, and carries real account-rejection risk. That is a schedule risk on a project whose current milestone is a single local page. Resend's free tier covers early usage at $0 |

The Product Owner's preference for SES is therefore **endorsed** — it is the
better provider at volume, and the right choice if AWS is already in place. The
only caveat is onboarding friction, which is a one-time cost and not a reason to
avoid SES permanently.

### D12 — No email is wired up in the current milestone

The single local page has no accounts and no notifications, so email is not
needed now. Wiring a provider, verifying a domain, and managing credentials
before there is anything to send would be work with no evidential value.

Email is introduced when authentication arrives, at which point this ADR should
be re-read and the conditional rule applied for the first time.

---

## Consequences

### Positive

- **No schedule risk from provider onboarding.** Resend reaches production
  sending in minutes. SES's production access review is not on the critical
  path.
- **Zero migration cost later.** The interface means the SES switch is one
  adapter, not a refactor of auth or notification code.
- **$0 during the current milestone.** Nothing to configure, no domain to
  verify, no credentials to rotate.
- **The §4.1 confusion is pre-empted.** Email Integration is recorded as
  requiring a mailbox API, not a sending provider.

### Negative / accepted

- **Two providers may be in play** if SES is adopted later while Resend remains
  configured. Mitigated by the interface, but it is a real possibility and the
  decision should be made deliberately at Phase 8 rather than drifting.
- **Resend's free tier is not a long-term plan.** It is a prototype allowance.
  Volume, deliverability and cost must be revisited before public launch.
- **Deliverability is deferred, not solved.** Neither provider is configured
  with domain authentication (SPF, DKIM, DMARC) until email is actually needed.
  That work exists and is not optional before launch.

### Neutral

- This ADR does not change the target architecture in
  [ADR-000](ADR-000-scope-and-source-of-truth.md).
- No email decision constrains the current single local page milestone
  ([ADR-001](ADR-001-prototype-stack.md)).

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **SES unconditionally** | The better provider at volume, but the production access request and account-rejection risk put an external approval process on the critical path for a project with no email yet |
| **Resend permanently** | Free tier is a prototype allowance, not a production plan. Leaves the cheaper option unused if AWS is already in place. Revisit at Phase 8 |
| **Hand-rolled SMTP** | Deliverability, retries, bounce handling and reputation management are not worth building. Both named providers solve this |
| **Amazon SNS for email** | Ties transactional product email to an AWS-only path and forfeits provider choice, for no benefit at this stage |
| **No provider — defer the decision entirely** | Rejected. Deferring the *wiring* is correct (D12); deferring the *decision* leaves Phase 8 to make it under time pressure, which is how vendor choices get made badly |

---

## Revisit if

- Volume grows materially, or notification send volume becomes a real cost —
  re-evaluate SES on unit economics
- An AWS account is created for other reasons — apply the conditional rule and
  switch to SES
- Deliverability problems appear (spam folder placement, bounces) — this is
  usually a domain-authentication or reputation problem, not a provider problem;
  diagnose before switching providers
- The §4.1 Email Integration feature is scoped — that requires a **separate**
  decision about Gmail API / Microsoft Graph OAuth, token storage and sync, per
  §4.2 and §4.4. This ADR does not cover it
- Regulatory requirements (GDPR, regional data residency) make a specific
  provider non-viable

---

## Verification

- [ ] No email provider is configured, imported or contacted in the current
      single local page milestone
- [ ] No email vendor SDK appears in any import outside a provider adapter
- [ ] At Phase 8: exactly one provider adapter implements `EmailProvider`
- [ ] At Phase 8: the conditional rule in this ADR is applied deliberately and
      the outcome recorded here
- [ ] Before public launch: SPF, DKIM and DMARC configured for the sending
      domain
- [ ] `PRD_v2.md` §4.1 Email Integration is never described as satisfied by a
      sending provider

## References

- `docs/PRD_v2.md` §1.9 (technical requirements), §2.7 (technical details),
  §3.1 P2 (accountability check-ins), §4.1 (Email Integration P1, Smart
  Notifications P1), §4.2 (integration principles), §4.4 (technical details)
- `docs/adr/ADR-000-scope-and-source-of-truth.md` D3, D8
- `docs/adr/ADR-001-prototype-stack.md` (no auth, therefore no email, in the
  current milestone)
- `docs/IMPLEMENTATION_PLAN.md` §2 (architecture summary)
