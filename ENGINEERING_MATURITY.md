# CatchUp Engineering Maturity Playbook

This document is the production baseline for CatchUp. It exists so a new engineer can understand what must stay true before changing marketplace workflows.

## Production Contract

- The canonical production app is `https://catchup-platform.vercel.app/`.
- Sensitive marketplace state transitions must run through Supabase RPCs.
- The browser must not directly finalize reviews, close rooms, insert completed-room messages, or recalculate reputation.
- Public tasks do not expire just because no one accepted them. Individual specialist proposals have a 24 hour client response window and then become expired history.
- Public marketplace reads should use narrow column lists and explicit profile enrichment. Do not depend on implicit PostgREST relationship names unless a migration and smoke test prove the relationship exists.
- Completed workspaces are closed rooms. Chat, direct-contact reveal, and location sharing must remain unavailable after completion.
- Same client and same specialist can work together again on a different task. Reviews can repeat across tasks, but each task has one review per direction.

## Required RPCs

The frontend treats these database functions as required production contracts:

- `accept_bid`
- `expire_stale_bid_requests`
- `send_workspace_message`
- `confirm_task_work_completed`
- `submit_task_review`
- `rate_client_after_completion`
- `create_app_notification`

If one is missing, the UI should show a clear error instead of using a direct table-write fallback.

## Local Onboarding

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` or `.env` with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Start the app:

```bash
npm run dev
```

4. Run the standard quality gate before pushing:

```bash
npm run scan:safety
npm run verify
```

5. When Supabase credentials are available, run:

```bash
npm run smoke:supabase
```

## Safety Checks

The app should not introduce browser-side code execution or shell execution surfaces. Before production deploys, keep this command clean:

```bash
npm run scan:safety
```

The current scan blocks these source patterns:

- `child_process`
- `dangerouslySetInnerHTML`
- `new Function`
- `eval(`

## Testing Roadmap

Current tests cover service contracts and critical UI states. Before a wider launch, add E2E tests for:

- client posts task
- specialist submits bid
- client accepts bid
- workspace opens for both participants
- private chat works only for participants
- specialist marks delivered
- client confirms and reviews specialist
- specialist reviews client
- completed workspace blocks chat/contact/location sharing
- Browse only shows open/in-progress marketplace inventory, not stale completed work

## File Size And Ownership

`src/services/supabaseService.js`, `src/components/Marketplace.jsx`, and `src/components/ProjectRoom.jsx` are large and should be split carefully over time.

Recommended next split:

- `services/tasksService.js`
- `services/bidsService.js`
- `services/workspaceService.js`
- `services/reviewsService.js`
- `components/marketplace/*`
- `components/workspace/*`

Do not split them during urgent production fixes unless tests are expanded at the same time.

## Deployment Rule

Deploy only to the linked CatchUp Vercel project. Do not create new Vercel projects for this app. Production verification should confirm:

- Vite build passes
- canonical URL returns HTTP 200
- current deployment serves the latest asset hash
- Supabase smoke contracts pass for the linked database
