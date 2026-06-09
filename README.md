# CatchUp Platform

CatchUp is a local-services marketplace for clients and specialists. Clients post jobs, specialists submit proposals, accepted jobs move into a protected workspace, and the platform tracks agreements, appointments, delivery, disputes, notifications, receipts, and reputation.

The product direction is marketplace trust at local density: make it easy to find the right specialist, agree on scope, keep work documented, and resolve problems without leaving the platform.

## Current Stack

- React 19 single-page app
- Vite React single-page app
- Supabase Auth, Postgres, RLS, Realtime, Storage
- Supabase RPCs for sensitive workflow transitions
- Vitest and Testing Library
- Sentry packages are installed for production monitoring

## Core Product Areas

- Authentication and role onboarding
- Client task posting
- Specialist marketplace discovery
- Proposal/bid flow
- Accepted-work workspace rooms
- Workspace chat
- Agreement snapshots and milestones
- Appointment scheduling
- Delivery and completion confirmation
- Reviews and reputation
- Contact reveal audit trail
- Dispute filing, evidence, and admin resolution
- In-app notifications and preferences
- Platform insights and system telemetry

## Local Setup

Create a `.env` file in the project root:

```bash
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

Vite-compatible aliases are also supported:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

Run tests:

```bash
npm test
```

Build production assets:

```bash
npm run build
```

Run the standard local quality gate:

```bash
npm run scan:safety
npm run verify
```

When Supabase credentials are available, check the live database contracts:

```bash
npm run smoke:supabase
```

## Supabase Setup

Apply database changes through `supabase/migrations/` in timestamp order. The current workflow hardening migrations include:

```text
supabase/migrations/20260607162500_review_uniqueness_and_marketplace_reputation.sql
supabase/migrations/20260607163500_close_completed_workspace_messaging.sql
```

Important security model:

- Normal users can only choose `client` or `specialist`.
- Platform admins are stored in `public.app_admins`.
- Admin access is checked through `public.current_user_is_platform_admin()`.
- Public specialist reads must not expose private contact fields in frontend queries.
- Bid reads are limited to task owners, bidding specialists, and platform admins.
- Dispute and resolution writes should happen through validated RPCs or admin-only policies.

To grant an admin, insert their profile ID into `public.app_admins` using the Supabase service role or dashboard SQL editor.

## Engineering Priorities

Before serious public launch:

- Move to Next.js when server-rendered public marketplace pages become a priority.
- Add route-level pages for task details, specialist profiles, workspaces, and admin operations.
- Add payment/escrow integration before using payment language in production.
- Replace static telemetry with real health checks and error metrics.
- Add Sentry initialization and release/environment tagging.
- Expand tests around posting, bidding, bid acceptance, contact reveal, disputes, completion, and reviews.
- Add rate limiting and abuse detection for auth, bids, messages, and dispute evidence uploads.

## Production Checklist

- Supabase RLS enabled on every user table.
- No public `select('*')` for profiles, bids, messages, or dispute data.
- Admin role cannot be self-assigned from the browser.
- Contact details are only returned after accepted workspace/contact unlock.
- Workspace messages are readable only by participants.
- Realtime channels are removed on room change/unmount.
- Dispute evidence storage has participant-only upload/read policies.
- CI runs safety scan, tests, and production build before deploy.
- Monitoring captures auth errors, RPC failures, realtime disconnects, and dispute/payment events.

## Engineering Maturity

Read `ENGINEERING_MATURITY.md` before changing workspace, bid acceptance, completion, review, or chat behavior. It documents the production contracts, required RPCs, safety checks, and E2E testing roadmap.

## Deployment

The app currently builds to static assets:

```bash
npm run build
```

Deploy the generated `dist/` directory to your hosting provider. `vercel.json` handles SPA fallback routing and immutable Vite asset caching.

For a larger platform, prefer a Next.js deployment so public marketplace pages, profile pages, metadata, server-side checks, and protected admin routes can be handled more cleanly.
