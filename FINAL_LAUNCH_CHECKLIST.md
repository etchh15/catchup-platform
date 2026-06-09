# CatchUp Founder-Away Launch Checklist

Use this before any public beta push. Every item must be one of:

- `DONE`: implemented and verified.
- `OPERATOR`: assigned to the emergency operator.
- `DELAYED`: intentionally postponed until the founder returns.

## Product Scope

- `DONE` Cairo/Giza controlled beta only.
- `DONE` Categories limited to Cleaning, Tutoring, Beauty, Moving help, Simple repairs.
- `DONE` No emergency, medical, legal, high-risk, electrical-heavy, or plumbing-heavy services.
- `DONE` Public copy avoids an operational “all Egypt” promise.

## Payments

- `DONE` Public policy says payments are arranged directly during beta.
- `DONE` App does not claim escrow, refunds, payment guarantees, or platform-held funds.
- `OPERATOR` Operator knows CatchUp records agreements/completion but does not hold money.
- `DELAYED` Real payment processing waits until the founder returns.

## Trust And Verification

- `DONE` Unverified specialists are blocked from sending proposals.
- `OPERATOR` Verification queue must be reviewed within 48 hours.
- `OPERATOR` Specialists need real identity/profile evidence before approval.
- `DONE` Verification requests create admin alerts.
- `OPERATOR` Rejected or suspicious accounts are documented in admin notes/abuse events.

## Admin Operations

- `DONE` Only `etchh0@gmail.com` can be platform admin.
- `OPERATOR` Emergency operator receives instructions, not code/admin ownership.
- `OPERATOR` Operator knows the Operations page, pause switch, waitlist actions, verification actions, dispute queue, and alert outbox.
- `DONE` Admin alert outbox records disputes, verification requests, onboarding pauses, abuse events, and failed critical workflows.
- `DELAYED` Real email delivery requires configuring `RESEND_API_KEY` for the Supabase `admin-alert-email` Edge Function.

## Stop Conditions

Pause onboarding if any are true:

- `OPERATOR` More than 3 unresolved disputes.
- `OPERATOR` Any safety incident.
- `OPERATOR` Verification queue cannot be handled within 48 hours.
- `OPERATOR` Users are confused about payment responsibility.
- `OPERATOR` Abuse reports or rate-limit blocks rise quickly.

## Engineering

- `DONE` `npm run verify` must pass before deploy.
- `DONE` Supabase migrations are committed.
- `DONE` Sentry DSN/release/environment variables are wired in the app.
- `OPERATOR` Production monitoring proof requires one harmless test event in Sentry after deploy.
- `DONE` Public `/beta-policy` page loads.
- `DONE` Public `/launch-checklist` page loads.
- `DONE` Admin Operations page loads for the single admin account.

## Launch Message

Use controlled language:

CatchUp is opening a controlled Cairo/Giza beta for trusted local services. Clients can join freely; specialists apply for manual review.
