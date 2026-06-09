# CatchUp Controlled Beta Operator Playbook

Use this playbook while the founder is away. The goal is to keep the beta calm, limited, and trustworthy.

## Beta Scope

- Markets: Cairo and Giza only.
- Categories: Cleaning, Tutoring, Beauty, Moving help, Simple repairs.
- Payments: off-platform during beta. CatchUp records agreed amount and completion state, but does not hold funds.
- Specialists: manual review required before proposals.

## Daily Check

Open the admin System page and review:

- Open disputes
- Stale open jobs
- Verification queue
- Abuse reports
- Unpaid accepted work
- Beta waitlist count

If any number looks unusual, pause onboarding until the case is understood.

## Pause Onboarding

Use the admin Operations page emergency switch when the beta needs to slow down.

Pause onboarding if:

- The verification queue cannot be reviewed within 48 hours
- More than 3 disputes are unresolved
- A safety incident is reported
- Waitlist demand is growing faster than the operator can handle
- Users are confused about payment responsibility

When paused:

- New waitlist submissions stop
- New account creation stops
- Specialist proposals stop
- Existing users can still sign in and complete active workspaces

Always write a clear pause reason so users and operators understand what happened.

## Specialist Verification

Approve a specialist only when their profile has enough trust evidence:

- Real full name or business name
- Service category inside beta scope
- Cairo/Giza service area
- Phone/contact details available privately
- Document or portfolio evidence reviewed
- No obvious duplicate, spam, or fake identity signals

Set `profiles.verification_status` to `verified` and `is_verified` to `true`.

Reject or hold when:

- Category is outside beta scope
- Identity is unclear
- Portfolio/document evidence is weak
- User behavior looks spammy or unsafe

## Dispute Response

For any dispute:

1. Read the workspace room, task, agreement, messages, and evidence.
2. Do not promise refunds or payment recovery during beta.
3. Preserve records.
4. Mark abusive behavior in `abuse_events`.
5. If safety risk appears, restrict the account manually and stop the workspace.

## Abuse Events

Create an abuse event for:

- Harassment
- Fake identity
- Spam bids or fake jobs
- Payment threats
- Off-platform pressure before acceptance
- Repeated cancellations/no-shows

Use severity:

- `low`: suspicious but not urgent
- `medium`: needs review
- `high`: restrict or pause user
- `critical`: immediate shutdown/escalation

## Public Messaging

Use this line for social posts:

CatchUp is opening a controlled Cairo/Giza beta for trusted local services. Clients can join freely; specialists apply for manual review.

Do not advertise all Egypt, instant payments, guaranteed outcomes, or emergency services.

Public pages:

- `/beta-policy` explains payment, verification, dispute, and safety rules.
- `/launch-checklist` shows the founder-away readiness checklist.

## Stop Conditions

Pause public onboarding if:

- More than 3 unresolved disputes are open
- Any safety incident happens
- Abuse reports increase quickly
- The admin operator cannot review new specialists within 48 hours
- Users misunderstand payment responsibility

The safest move is to slow down. Growth can wait; trust cannot.
