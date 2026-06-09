# CatchUp Founder-Away Launch Checklist

Use this before any public beta push.

## Product Scope

- [ ] Cairo/Giza only.
- [ ] Categories limited to Cleaning, Tutoring, Beauty, Moving help, Simple repairs.
- [ ] No emergency, medical, legal, high-risk, electrical-heavy, or plumbing-heavy services.
- [ ] Public copy does not advertise all Egypt.

## Payments

- [ ] Public policy says payments are arranged directly during beta.
- [ ] App does not claim escrow, refunds, payment guarantees, or platform-held funds.
- [ ] Operators know CatchUp records agreements and completion, but does not hold money.

## Trust And Verification

- [ ] No unverified specialist can send proposals.
- [ ] Verification queue is reviewed within 48 hours.
- [ ] Specialists have real identity/profile evidence before approval.
- [ ] Rejected or suspicious accounts are documented.

## Admin Operations

- [ ] Emergency operator has admin access.
- [ ] Operator knows the Operations page.
- [ ] Operator knows the onboarding pause switch.
- [ ] Operator knows how to mark waitlist users contacted/invited.
- [ ] Operator knows how to verify/reject specialists.

## Stop Conditions

Pause onboarding if any are true:

- [ ] More than 3 unresolved disputes.
- [ ] Any safety incident.
- [ ] Verification queue cannot be handled within 48 hours.
- [ ] Users are confused about payment responsibility.
- [ ] Abuse reports rise quickly.

## Engineering

- [ ] `npm run verify` passes.
- [ ] Supabase migrations are pushed.
- [ ] Sentry DSN/release/environment variables are configured.
- [ ] Public `/beta-policy` page loads.
- [ ] Public `/launch-checklist` page loads.
- [ ] Admin Operations page loads for an admin account.

## Launch Message

Use controlled language:

CatchUp is opening a controlled Cairo/Giza beta for trusted local services. Clients can join freely; specialists apply for manual review.
