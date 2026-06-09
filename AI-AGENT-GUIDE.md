# CatchUp Platform — AI Agent Guide (Single Source of Truth)

**Purpose:** One file for everything. Copy **one session prompt** per new Cursor chat. Do not skip ahead.

**Last updated:** June 1, 2026

---

**STATUS NOTE (Jun 2, 2026):** Repo artifacts for Sessions 0–10 (code + SQL) exist, but the live Supabase database must be migrated and verified before treating features as deployed. `IMPLEMENTATION_COMPLETE.md`, `DEPLOYMENT-COMPLETE.md`, and `START-HERE.md` were updated to reflect this reality.


## Progress (you are here)

| Session | Status | Notes |
|---------|--------|-------|
| **0** Audit | ✅ Done | Baseline report approved |
| **1** Supabase schema | ✅ Done | Migrations reconciled; `verify-schema.sql`; `accept_bid` + agreements/milestones; storage + RLS patches |
| **2** App bug fixes | ✅ Done | `message`/`action_url`, contact fields, room filter, honest marketplace rating |
| **3** Agreements | ✅ Done | `AgreementSnapshot` on accept; `AgreementCard` in ProjectRoom; `useAgreement` |
| **4** Dual completion | ✅ Done | `DeliveryButton` → deliver → `CompletionConfirmationModal` → confirm → review |
| **5** Disputes | ✅ Done | `DisputeForm` + evidence upload; `DisputeThread`; legacy prompt removed |
| **6** Milestones | ✅ Done | `MilestoneChecklist` + `useMilestones`; hardcoded escrow tracker removed |
| **7** Appointments | ✅ Done | `ScheduleAppointment` + `useAppointmentScheduling` in ProjectRoom |
| **8** Client reputation | ✅ Done | `ClientReputationBadge` on marketplace; specialist rates client after completion |
| **9** Specialist reputation | ✅ Done | `SpecialistReputationCard` on marketplace, bids, ProfileHub; honest empty state |
| **10** PDF receipt | ✅ Done | `ReceiptPDF` + `useReceiptGeneration`; legacy print removed; saves to `completion_receipts` |
| **11** Notifications | ▶️ **Next** | Copy Session 11 prompt below |
| 12–19 | ⬜ Pending | — |

**Start the next chat with Session 11** (Part 4). Do not re-run Sessions 0–10 unless schema or wiring regressed.

---

## How to use this (3 steps)

1. **Read Part 1** once — know what is done vs what is still scaffolded.
2. **Copy the Global Engineering Preamble** (Part 4) at the top of every agent chat.
3. **Run sessions in order** (Part 4). One session = one fresh chat. Do not combine sessions.

---

# Part 1 — Project review (honest status)

## What works today (after Sessions 0–10)

| Feature | Status |
|---------|--------|
| Email/password auth + role selection | ✅ Works |
| Post tasks, submit bids, accept bid | ✅ Works |
| `accept_bid` → workspace room + **agreement** + **5 milestones** (RPC) | ✅ Works (Session 1/3) |
| Agreement snapshot modal + AgreementCard in ProjectRoom | ✅ Wired (Session 3) |
| Real-time workspace chat | ✅ Works |
| Dual completion (deliver → confirm → review) | ✅ Wired (Session 4) |
| Disputes (form, evidence, thread) | ✅ Wired (Session 5) |
| Milestone checklist (5 steps from DB) | ✅ Wired (Session 6) |
| Appointments (propose → confirm) | ✅ Wired (Session 7) |
| Client reputation badge + post-completion rating | ✅ Wired (Session 8) |
| Specialist reputation cards (marketplace, bids, profile) | ✅ Wired (Session 9) |
| PDF receipt download (`ReceiptPDF`, `completion_receipts`) | ✅ Wired (Session 10) |
| Notifications on deliver/confirm (subset) | ⚠️ Partial — full triggers in Session 11 |
| Contact card in ProjectRoom | ⚠️ Partial — polish in Session 13 |
| Notification bell UI | ⚠️ UI works; not all event triggers wired |

## What is scaffolded but NOT wired to UI

**All Phase 1–4 feature components are wired** (Sessions 3–10). Remaining work is polish and cross-cutting flows (Sessions 11–19):

- Full in-app notification triggers + bell deep links (Session 11)
- Notification preferences UI (Session 12)
- Contact reveal polish + audit log (Session 13)
- Marketplace sort, `activeRoom` nav fixes (Session 14)

**Already wired (do not re-implement):** agreements, dual completion, disputes, milestones, appointments, client + specialist reputation, PDF receipt, and all hooks/components listed in Sessions 3–10.

## Critical bugs

| Bug | Status | Notes |
|-----|--------|-------|
| Notification insert (`body`/`url`) | ✅ Fixed (S2) | `createNotification` uses `message`, `action_url` |
| Profile contact fields | ✅ Fixed (S2) | `phone_number`, `email_address` |
| Review rating column | ✅ Fixed (S1) | SQL/JS use `rating_score` |
| ProjectRoom rooms query | ✅ Fixed (S2) | Filter `client_id` OR `specialist_id` |
| Marketplace fake 5.0 | ✅ Fixed (S2) | Shows "New" when no reviews |
| `accept_bid` RPC | ✅ Fixed (S1) | Creates agreement + milestones |
| Dual dispute systems | ✅ Fixed (S5) | New disputes UI; legacy prompt removed |

## Supabase schema status

**Session 1 complete** — apply order documented in Part 6. Patch files added under `supabase/`:

| File | What it adds |
|------|----------------|
| `supabase/catchup-full-schema.sql` | Base MVP tables + `accept_bid` RPC |
| `supabase/phase-1-migrations.sql` | notifications, reputation, contact_access_log |
| `supabase/phase-2-3-4-migrations.sql` | agreements, disputes, milestones, appointments, client_reputation |
| `supabase/phase-2-3-4-patch-accept-bid.sql` | Extended `accept_bid` (agreement + milestones) |
| `supabase/verify-schema.sql` | Verification queries for SQL Editor |
| `supabase/storage-disputes-bucket.sql` | Disputes storage bucket (for Session 5) |
| `supabase/fix-*.sql` | RLS UUID, bids `updated_at`, rate-limit cast, etc. |

Re-run `verify-schema.sql` on live Supabase after any manual drift.

**Rule:** Database schema is the source of truth. App code must match schema. Every feature must be wired:

```
Table → RLS policies → RPC/trigger (if needed) → Realtime → supabaseService.js → hook → component
```

## Not started (post-MVP)

Payments/escrow, admin dashboard, email/SMS notifications, password reset, phone verification, social login, 2FA, full KYC, contact favorites, mobile app.

## Documentation warning

`IMPLEMENTATION_COMPLETE.md`, `DEPLOYMENT-COMPLETE.md`, and `START-HERE.md` **overstate completion**. Trust code and this file, not those docs.

---

# Part 2 — Global preamble (paste at top of EVERY chat)

**Canonical copy:** Use the **Global Engineering Preamble** in Part 4 (full progress, wired inventory, done criteria). Session prompts below still say `[Paste Global Engineering Preamble from Part 4]` — paste from **Part 4** instead.

Quick reference: Sessions **0–10 done** · **Session 11 next** (notifications) · Schema columns: `message`/`action_url`, `phone_number`/`email_address`, `rating_score` · Trust code, not `IMPLEMENTATION_COMPLETE.md`.

---

# Part 3 — Session order (run top to bottom)

| Session | Name | What it does |
|---------|------|----------------|
| **0** ✅ | Audit | Report only — no code |
| **1** ✅ | Supabase schema | Migrations, RLS, RPC, Storage, Realtime, verify SQL |
| **2** ✅ | App bug fixes | Column mismatches, ProjectRoom filter, notification fixes |
| **3** ✅ | Agreements | Contract snapshot on bid accept |
| **4** ✅ | Dual completion | Specialist deliver → client confirm → review |
| **5** ✅ | Disputes | DisputeForm, evidence upload, thread |
| **6** ✅ | Milestones | 5-step checklist from DB |
| **7** ✅ | Appointments | Schedule visit flow |
| **8** ✅ | Client reputation | Badge on jobs + rate client |
| **9** ✅ | Specialist reputation | Cards on marketplace + profile |
| **10** ✅ | PDF receipt | ReceiptPDF + useReceiptGeneration; completion_receipts |
| **11** ▶️ | Notifications | All in-app triggers + bell UX |
| **12** | Notification prefs | Settings UI in ProfileHub |
| **13** | Contact polish | Reveal flow + audit log |
| **14** | Marketplace & nav | Sort, activeRoom fix, deep links |
| **15** | Business rules | Validation, guards, one rating per task |
| **16** | Admin disputes | Optional — admin queue + resolve |
| **17** | Tests & Sentry | Build passes, smoke tests |
| **18** | E2E acceptance | Full flow test + fix blockers only |
| **19** | Docs cleanup | Make docs honest |

**Optional later:** Session 20 (email notifications), Session 21 (payments plan), Session 22 (auth hardening).

---

# Part 4 — Session prompts (copy one per chat)

**How to start each chat:** Paste the **Global Engineering Preamble** below, then paste **one** session prompt from the sections that follow. One session = one chat. Do not skip ahead of Session 11 unless the guide says otherwise.

### Global Engineering Preamble (paste first, every chat)

```
You are a senior full-stack engineer on CatchUp Platform (React 19 + Supabase + PostgreSQL).
You integrate features end-to-end: schema → service → hook → UI. You do not ship UI-only scaffolding.

## Progress (as of June 1, 2026)

COMPLETED — Sessions 0–10 (do not re-implement unless regressed):
- S0: Audit baseline
- S1: Supabase schema, RLS, `accept_bid` RPC (agreement + 5 milestones), verify SQL, storage patches
- S2: Notification columns (`message`, `action_url`), profile contact fields, ProjectRoom room filter, honest ratings
- S3: Agreements — `AgreementSnapshot`, `AgreementCard`, `useAgreement`
- S4: Dual completion — `DeliveryButton`, `CompletionConfirmationModal`, `useCompletion`
- S5: Disputes — `DisputeForm`, `DisputeThread`, `useDispute`, evidence upload; legacy prompt removed
- S6: Milestones — `MilestoneChecklist`, `useMilestones` (DB-driven 5 steps)
- S7: Appointments — `ScheduleAppointment`, `useAppointmentScheduling`
- S8: Client reputation — `ClientReputationBadge`, `useClientReputation`, post-completion client rating
- S9: Specialist reputation — `SpecialistReputationCard`, `useSpecialistReputation` / `useSpecialistReputations` on marketplace, bids, ProfileHub
- S10: PDF receipt — `ReceiptPDF`, `useReceiptGeneration`; legacy print removed; `completion_receipts` persistence

NEXT SESSION: 11 — In-app notifications (all triggers + bell UX + deep links)

REMAINING (after S11): S12 notification prefs, S13 contact polish, S14 marketplace/nav, S15 business rules, S16 admin disputes (optional), S17 tests, S18 E2E, S19 docs honesty.

NOT STARTED (out of scope unless session says so): payments/escrow, admin dashboard, email/SMS, password reset, 2FA, full KYC.

## Already wired — reuse, do not duplicate

ProjectRoom: useAgreement, AgreementCard, useCompletion, DeliveryButton, CompletionConfirmationModal, useDispute, DisputeForm, DisputeThread, useMilestones, MilestoneChecklist, useAppointmentScheduling, ScheduleAppointment, useReceiptGeneration, ReceiptPDF.

Marketplace / ProfileHub: useClientReputation, ClientReputationBadge, useSpecialistReputation(s), SpecialistReputationCard.

Service layer: supabaseService.js (surgical edits only — never rewrite from scratch).

## Schema truth (app must match DB)

- notifications: `message`, `action_url` — NOT `body`, `url`
- profiles: `phone_number`, `email_address` — NOT `phone`, `email` unless migrated
- reviews: `rating_score` — NOT `rating`
- Apply order + patches: see Part 6 of AI-AGENT-GUIDE.md; run `supabase/verify-schema.sql` after drift

## Integration points

- src/components/ProjectRoom.jsx
- src/components/Marketplace.jsx
- src/components/ProfileHub.jsx
- src/services/supabaseService.js
- supabase/catchup-full-schema.sql
- supabase/phase-1-migrations.sql
- supabase/phase-2-3-4-migrations.sql
- supabase/verify-schema.sql
- supabase/ Folder.

## Supabase engineering mandate

- Database schema is source of truth; app code conforms to schema.
- Idempotent migrations; RLS on every user-facing table; SECURITY DEFINER RPCs with `SET search_path = public`; indexes on FKs.
- Full stack per feature: Table → RLS → RPC/trigger (if needed) → Realtime → supabaseService.js → hook → component.
- Do not mark a feature done if only React exists without verified Supabase layer.
- Storage buckets + policies are part of schema.
- After schema changes: provide verification SQL for Supabase SQL Editor (REMOTLY).

## Engineering rules

1. Read target files and existing imports BEFORE editing.
2. Reuse existing hooks/components — no parallel implementations.
3. Minimal diff; no unrelated refactors; no new markdown unless asked.
4. Do not implement payments, admin, or email/SMS unless this session explicitly requires it.
5. Trust runtime code and Supabase rows — NOT IMPLEMENTATION_COMPLETE.md / DEPLOYMENT-COMPLETE.md / START-HERE.md.

## Schema gate (UI sessions)

Before wiring UI: confirm table + RLS + Realtime exist. If missing, fix schema first, stop, and report — do not build orphan UI.

## Done criteria (required in every response)

- State session number and scope first.
- List files changed.
- Give manual verification steps (what to click + what row appears in Supabase).
- Run `npm run build` when JS changed; report pass/fail.
- End with: diff summary, verification SQL (if schema touched), and test checklist.

Start by stating this session number and scope, then execute.
```

---

---

## Session 0 — Audit (no code)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 0 — Audit & Baseline ONLY

GOAL: Honest report. Write NO code unless I approve after reading the report.

TASKS:
1. Map every src/hooks/* and new src/components/* → imported somewhere? (yes/no)
2. List orphaned files (exist, never imported)
3. List dual systems (old dispute vs disputes table; old receipt vs ReceiptPDF)
4. Compare the three SQL files — conflicts, apply order, missing Realtime/Storage
5. Build wiring matrix:

| Feature | SQL table | RLS | Realtime | Service fn | Hook | UI wired |
(list all 10 REQUIREMENTS features)

6. List critical bugs from Part 1 of AI-AGENT-GUIDE.md — confirm in code

OUTPUT:
- Executive summary (5 bullets)
- Orphaned files list
- Wiring matrix with ✅/❌
- Recommended session order confirmation
- STOP — wait for my approval before Session 1
```

---

## Session 1 — Supabase schema (database first)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 1 — Supabase Schema Wiring (database first, minimal JS)

GOAL: Full Supabase layer correct before UI integration. Supabase doc style.

TASKS:

A. RECONCILE SQL FILES
- Compare catchup-full-schema.sql vs phase-1-migrations.sql vs phase-2-3-4-migrations.sql
- Fix conflicts (column names, types, duplicate definitions)
- Document ONE apply order
- Prefer idempotent SQL (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)

B. APPLY / PRODUCE MIGRATIONS
- Ensure phase-1 tables exist: notifications, notification_preferences, notification_delivery, specialist_metrics, specialist_reputation, contact_access_log, workspace_rooms.contact_revealed_at
- Ensure phase-2-3-4 tables exist: agreements, agreement_milestones, appointments, disputes, dispute_responses, dispute_resolutions, completion_log, completion_receipts, client_reputation, specialist_client_ratings, tasks work_delivered/confirmed columns
- Create supabase/storage-disputes-bucket.sql if missing (bucket + RLS)

C. FIX SQL BUGS
- calculate_specialist_reputation(): use rating_score not rating
- create_notification() DB function: align columns with notifications table
- COMMENT ON TABLE for new tables (Supabase doc style)

D. EXTEND accept_bid RPC (new migration patch file)
- On accept: create agreements row + 5 agreement_milestones + auto-complete milestone 1
- Return agreement_id in JSON response
- SECURITY DEFINER, SET search_path = public, GRANT to authenticated

E. RLS POLICIES
- Verify/fix policies on all new tables
- Participants-only: agreements, milestones, appointments, disputes, completion_log
- Own-notifications-only: notifications
- Public read where needed: specialist_reputation

F. REALTIME
- Add new tables to supabase_realtime publication
- Match filters used in hooks (task_id, recipient_id, room_id)

G. VERIFICATION
- Create supabase/verify-schema.sql:
  - List expected tables
  - Sample checks per critical table
  - accept_bid smoke test notes

H. MINIMAL APP ALIGNMENT
- Update acceptBid() in supabaseService.js if RPC return shape changes
- Do NOT wire ProjectRoom UI in this session

OUTPUT:
- Files created/modified
- Apply order checklist (step 1, 2, 3…)
- Wiring matrix BEFORE → AFTER for SQL layer
- verify-schema.sql content
- SQL Editor queries I run to confirm success
```

---

## Session 2 — App bug fixes

```
[Paste Global Engineering Preamble from Part 4]

SESSION 2 — Critical App Bug Fixes

PREREQUISITE: Session 1 schema applied OR verify-schema.sql passes.

SCOPE: supabaseService.js, useContactVisibility.js, ProjectRoom.jsx (query only), Marketplace.jsx (rating display only). NO new feature wiring.

TASKS:
1. Fix createNotification() — use message, action_url. Fix ALL call sites.
2. Fix markWorkDelivered() notification args (title, message, action_url, taskId).
3. Fix useWorkspaceContact — phone_number, email_address. Normalize for ContactCard.
4. Fix fetchSpecialistContact() same fields.
5. Fix JS reputation code using wrong column names.
6. Fix ProjectRoom — filter workspace_rooms to current user only.
7. Remove fake 5.0 rating default in Marketplace — honest empty state.

DONE WHEN:
- npm run build passes
- Manual: notification insert works (check Supabase table)
- Manual: contact fields show when room active
- Manual: ProjectRoom shows only my rooms

Show git diff + 5-step test checklist.
```

---

## Session 3 — Agreements (#1)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 3 — Agreement / Contract Snapshot

SCHEMA GATE: agreements table + RLS + accept_bid creates agreement — confirm first.

FILES: Marketplace.jsx, ProjectRoom.jsx, useAgreement.js, AgreementCard.jsx, AgreementSnapshot.jsx

TASKS:
- On bid accept: show AgreementSnapshot modal
- Show AgreementCard in ProjectRoom header
- useAgreement(taskId) for fetch + realtime
- Specialist can update expected_delivery_date
- Use RPC-created agreement OR fetchOrCreateAgreement — not both

DO NOT: milestones UI, completion, disputes, receipt.

DONE WHEN: Accept bid → modal → agreement visible in ProjectRoom → row in agreements table.
```

---

## Session 4 — Dual completion (#5)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 4 — Dual Completion Confirmation

SCHEMA GATE: tasks work_delivered_* and confirmed_by_client_* columns + completion_log table.

FILES: ProjectRoom.jsx, useCompletion.js, DeliveryButton.jsx, CompletionConfirmationModal.jsx

TASKS:
- Specialist: DeliveryButton → markWorkDelivered()
- Client: sees status → confirmWorkCompleted() → then review modal
- Replace old client-only instant complete flow
- Notifications on deliver + confirm
- Update workspace_rooms + tasks status
- Log to completion_log

DONE WHEN: Deliver → notify client → confirm → review → DB timestamps populated.
```

---

## Session 5 — Disputes (#6)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 5 — Dispute Evidence & Thread

SCHEMA GATE: disputes table + dispute_responses + disputes Storage bucket + RLS.

FILES: ProjectRoom.jsx, DisputeForm.jsx, DisputeThread.jsx, useDispute.js, useDisputeEvidence.js

TASKS:
- REMOVE legacy handleInitiateDispute prompt()
- DisputeForm: category + text + up to 5 images → Storage → disputes table
- DisputeThread for responses
- Notify other party on file + response
- Show status in room list + header

DO NOT: admin resolution UI.

DONE WHEN: File dispute with images → thread response → rows in disputes + dispute_responses.
```

---

## Session 6 — Milestones (#2)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 6 — Milestone Checklist

SCHEMA GATE: agreement_milestones table + milestones created on accept.

FILES: ProjectRoom.jsx, MilestoneChecklist.jsx, useMilestones.js

TASKS:
- REMOVE hardcoded "Escrow Locked" tracker in ProjectRoom
- Wire MilestoneChecklist + useMilestones(agreementId)
- M1: auto on agreement | M2: on appointment confirm | M3: specialist work started | M4: client inspected | M5: completion

DONE WHEN: 5 milestones from DB, manual advances persist.
```

---

## Session 7 — Appointments (#3)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 7 — Scheduled Visit / Appointment

SCHEMA GATE: appointments table + RLS.

FILES: ProjectRoom.jsx, ScheduleAppointment.jsx, useAppointmentScheduling.js

TASKS:
- Specialist proposes date + address + notes
- Client confirms or counter-proposes
- Status flow: pending → confirmed → completed
- Countdown when confirmed
- On confirm: complete milestone 2 (if Session 6 done)

DONE WHEN: Propose → confirm → appointments row exists.
```

---

## Session 8 — Client reputation (#8)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 8 — Client Reputation

SCHEMA GATE: client_reputation + specialist_client_ratings tables.

FILES: Marketplace.jsx, ClientReputationBadge.jsx, useClientReputation.js, completion flow

TASKS:
- ClientReputationBadge on job cards (specialist view)
- After completion: specialist rates client (minimal UI)
- rateClient() + calculateClientReputation()
- Honest empty state for new clients

DONE WHEN: Badge on listing + rating updates client_reputation row.
```

---

## Session 9 — Specialist reputation (#7)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 9 — Specialist Reputation

SCHEMA GATE: specialist_reputation + specialist_metrics + calculate_specialist_reputation() fixed.

FILES: Marketplace.jsx, SpecialistReputationCard.jsx, useSpecialistReputation.js, ProfileHub.jsx

TASKS:
- Replace stub metrics with SpecialistReputationCard
- Compact on lists, full on ProfileHub
- On bid cards before client accepts
- calculateSpecialistReputation() after review complete
- Track response time on first bid
- No fake 5.0 defaults

DONE WHEN: New specialist shows honest empty state; updates after completed job.
```

---

## Session 10 — PDF receipt (#10)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 10 — PDF Receipt Export

SCHEMA GATE: completion_receipts table.

FILES: ProjectRoom.jsx, ReceiptPDF.jsx, useReceiptGeneration.js

TASKS:
- REMOVE legacy handleExportReceipt print window
- ReceiptPDF + useReceiptGeneration (jspdf + html2canvas)
- Show after dual completion
- Include: agreement, parties, milestones, review, dispute if any
- Save to completion_receipts with agreement_id

DONE WHEN: Download catchup-agreement-{id}.pdf with real data.
```

---

## Session 11 — Notifications (#9)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 11 — In-App Notifications (triggers + UX)

TASKS:
Add createNotification (fixed) on:
- Bid submitted → client
- Bid accepted → specialist
- Workspace message → other party
- Work delivered → client
- Work confirmed → specialist
- Dispute filed / response → other party
- Review submitted → specialist

UX:
- Click notification → messages tab + correct room (fix App.js activeRoom)
- Mark read on click
- Realtime bell update

DO NOT: email/SMS, preferences UI.

DONE WHEN: Each event creates notifications row + bell updates live.
```

---

## Session 12 — Notification preferences

```
[Paste Global Engineering Preamble from Part 4]

SESSION 12 — Notification Preferences UI

FILES: NotificationPreferences.jsx (create), ProfileHub.jsx

TASKS:
- Toggle in-app + email prefs per event type
- fetchNotificationPreferences / updateNotificationPreferences
- Default row on first access

DONE WHEN: Toggles persist across refresh.
```

---

## Session 13 — Contact unlock polish (#4)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 13 — Contact Unlock Polish

FILES: ContactCard.jsx, useContactVisibility.js, ProjectRoom.jsx, SpecialistAvatar.jsx

TASKS:
- Clear reveal UX after bid acceptance
- Locked state before acceptance
- contact_access_log + contact_revealed_at on reveal
- tel/mailto/wa.me + copy work on mobile
- RLS blocks contact before acceptance

DONE WHEN: Post-accept contact works; pre-accept locked only.
```

---

## Session 14 — Marketplace & navigation

```
[Paste Global Engineering Preamble from Part 4]

SESSION 14 — Marketplace & Navigation Polish

FILES: Marketplace.jsx, ProfileHub.jsx, App.js, Navigation.jsx

TASKS:
- Sort specialists by rating + verified
- Fix App.js activeRoom (currently always null) — pass room on bid accept
- Messages tab opens correct room
- ProfileHub shows reputation summaries
- Unread indicators where possible

DONE WHEN: Accept bid → lands in correct room without manual pick.
```

---

## Session 15 — Business rules

```
[Paste Global Engineering Preamble from Part 4]

SESSION 15 — Business Rules & Data Integrity

TASKS:
- Block specialist bidding on own task
- Block task edits after bid accepted
- Cancellation for open tasks only
- Review only after dual completion
- One specialist→client rating per task
- Single reputation recalc path after review

OUTPUT: List each rule + where enforced (UI / service / RLS).
```

---

## Session 16 — Admin disputes (optional)

```
[Paste Global Engineering Preamble from Part 4]

SESSION 16 — Admin Dispute Resolution (optional)

TASKS:
- is_admin or admin role on profiles + RLS
- Admin dispute queue component
- resolveDispute() → dispute_resolutions + notify parties
- Basic metrics in AnalyticsLedger

DONE WHEN: Admin resolves one test dispute end-to-end.
```

---

## Session 17 — Tests & observability

```
[Paste Global Engineering Preamble from Part 4]

SESSION 17 — Tests & Observability

TASKS:
- Replace placeholder App.test.js
- npm run build clean
- Wire Sentry if @sentry/react configured
- Mobile responsive check on ProjectRoom

DONE WHEN: npm test + npm run build pass.
```

---

## Session 18 — E2E acceptance

```
[Paste Global Engineering Preamble from Part 4]

SESSION 18 — End-to-End Acceptance (fix blockers only, no new features)

RUN CHECKLIST:
1. Client posts task → specialist bids → client notified
2. Client accepts → agreement modal → milestones in DB → specialist notified
3. Appointment propose → confirm → milestone 2 complete
4. Contact details work
5. Specialist delivers → client notified
6. Client confirms → review → specialist notified
7. Reputation updates both sides
8. PDF receipt downloads
9. Dispute with images → thread → response
10. Notification bell + deep link works
11. Schema: every E2E feature has table row + RLS allows it
12. accept_bid creates agreement + milestones atomically
13. Realtime fires on notification insert
14. Storage upload under disputes bucket RLS

OUTPUT: Pass/fail table + fixes for failures only. Honest status — not "production ready."
```

---

## Session 19 — Docs cleanup

```
[Paste Global Engineering Preamble from Part 4]

SESSION 19 — Documentation Honesty Pass

TASKS:
- Update IMPLEMENTATION_COMPLETE.md, DEPLOYMENT-COMPLETE.md, START-HERE.md to match wired reality
- Align DEPLOY.md with migration apply order from Session 1
- Or add STATUS section to this AI-AGENT-GUIDE.md

DO NOT inflate completion claims.
```

---

# Part 5 — Agent tips (short)

1. **One session = one fresh chat** — agents lose context when you mix phases.
2. **Database before UI** — Session 1 before Sessions 3–10.
3. **Trust diff + Supabase table rows**, not markdown that says "complete."
4. **Use @ references** — `@ProjectRoom.jsx @supabaseService.js @phase-1-migrations.sql`
5. **End every session with:** "Show diff, verification SQL, and what I click to test."
6. **Do not let agent rewrite** `supabaseService.js` from scratch — surgical edits only.
7. **Create `.cursor/rules/catchup.md`** with schema truth from Part 2 preamble (optional but recommended).

---

# Part 6 — SQL apply order (reference)

Run in Supabase SQL Editor in this order (Session 1 — **already applied** on your project):

1. `supabase/catchup-full-schema.sql` — if fresh project only
2. `supabase/phase-1-migrations.sql`
3. `supabase/phase-2-3-4-migrations.sql`
4. `supabase/phase-2-3-4-patch-accept-bid.sql`
5. `supabase/storage-disputes-bucket.sql`
6. Fix patches as needed: `fix-rls-uuid-comparison.sql`, `fix-accept-bid-uuid-types.sql`, `fix-bids-updated-at.sql`, `fix-task-rate-limit-cast.sql`
7. Run `supabase/verify-schema.sql`

If base schema already applied, skip step 1 and run 2 → 7 only.

**New environments:** use `scripts/supabase-link.sh` if configured, then the same order.

---

# Part 7 — Success definition

The platform matches **REQUIREMENTS.md** when:

- All 10 features work as **clickable user flows**, not just files in `src/components/`
- Supabase wiring matrix is ✅ through Service + Hook + UI
- E2E Session 18 checklist passes
- Docs no longer claim features that are not wired

**Target after Sessions 0–18:** ~80% of documented roadmap integrated and tested. *(Sessions 0–10 complete as of June 1, 2026.)*

---

*Start here: **Session 11 — Notifications** in a new Cursor Agent chat (Sessions 0–10 complete).*
