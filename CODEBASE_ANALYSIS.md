# CatchUp Platform - Comprehensive Codebase Analysis

**Date:** May 28, 2026  
**Status:** MVP implementation with core marketplace features  
**Tech Stack:** React 19.2 + Supabase + PostgreSQL

---

## 1. Current Data Models & Database Schema

### Core Entity Relationships

```
profiles (id, role, email, full_name, ...)
├── clients (id → profiles.id)
├── specialists (id → profiles.id)
├── tasks (user_id → profiles.id, specialist_id → profiles.id)
│   ├── bids (task_id, specialist_id → profiles.id)
│   ├── workspace_rooms (task_id, client_id, specialist_id)
│   │   ├── workspace_messages (room_id, sender_id)
│   │   └── reviews (room_id, task_id, client_id, specialist_id)
│   └── messages (task_id, sender_id, receiver_id) [legacy]
```

### Main Tables & Fields

#### **profiles**
- **Type:** User master record
- **Key Fields:**
  - `role` enum: 'client' | 'specialist'
  - `email`, `full_name`, `phone_number`, `email_address`
  - `bio`, `professional_title`, `job_title`
  - `category` (service category), `district_tag` (location filter)
  - `hourly_rate` numeric, `is_verified` boolean
  - `portfolio_images[]` (array), `avatar_url`
  - `created_at`, `updated_at` timestamps

#### **tasks** (Job postings)
- **Key Fields:**
  - `user_id` (client who posted)
  - `title`, `description`, `budget` numeric
  - `category`, `district_tag` (filtering keys)
  - `specialist_id` (assigned after bid acceptance)
  - `status` enum: open | active | completed | archived | expired
  - `created_at`, `updated_at`

#### **bids** (Specialist proposals)
- **Key Fields:**
  - `task_id`, `specialist_id`
  - `amount` numeric, `note` text (proposal)
  - `status` enum: pending | accepted | rejected
  - **Unique Constraint:** One bid per specialist per task
  - `created_at`, `updated_at`

#### **workspace_rooms** (Active contracts)
- **Purpose:** Represents an accepted bid → active project
- **Key Fields:**
  - `task_id`, `client_id`, `specialist_id`
  - `status` enum: active | disputed | completed
  - `dispute_initiated_by` uuid, `dispute_reason` text
  - **Unique Constraint:** One room per task+participants
  - `created_at`, `updated_at`

#### **workspace_messages** (Chat for active projects)
- **Key Fields:**
  - `room_id` (links to workspace_rooms)
  - `sender_id`, `message_text`
  - `created_at`
- **Note:** Real-time enabled; drives all in-project communication

#### **reviews** (Post-completion ratings)
- **Key Fields:**
  - `room_id`, `task_id`, `client_id`, `specialist_id`
  - `rating_score` integer, `feedback_text`
  - `created_at`
- **Trigger:** Created by client when finalizing project

#### **clients** & **specialists** (Role-specific tables)
- Minimal use; mostly for FK references to profiles
- `clients`: `full_name`, `city_district`
- `specialists`: `business_name`, `profession_category`, `is_verified`

#### **messages** (Legacy)
- Task-level messages (unused in current flow)
- Fields: `task_id`, `sender_id`, `receiver_id`, `text`

### Row-Level Security (RLS) Policies

| Table | Public Read | Authenticated Actions |
|-------|------------|----------------------|
| `profiles` | Specialists only | Create/update own |
| `tasks` | All | Create/update/delete own |
| `bids` | All | Specialists submit own; task owner can update |
| `workspace_rooms` | None | Only room participants (client/specialist) |
| `workspace_messages` | None | Only room participants can read/write |
| `reviews` | None | Client writes; both parties read own |

### Key Database Functions

**`accept_bid(p_task_id, p_bid_id)`** (Atomic transaction)
- Validates caller owns the task
- Atomically:
  - Accepts specified bid → status = 'accepted'
  - Rejects all other bids → status = 'rejected'
  - Updates task: status = 'active', specialist_id assigned
  - Creates workspace_room (or returns existing)
- Returns: JSON with task_id, bid_id, client_id, specialist_id, room_id, amount
- Security: Only authenticated users; checks task ownership

### Realtime Subscriptions Configured
Tables published to Supabase Realtime:
- `profiles`, `tasks`, `bids`, `messages`, `workspace_rooms`, `workspace_messages`

---

## 2. Bid/Agreement Lifecycle Features

### Complete Workflow

```
PHASE 1: DISCOVERY
├─ Client creates task (title, budget, description, category, district)
└─ Task status: "open"

PHASE 2: BIDDING
├─ Specialists browse tasks (filtered by district/category)
├─ Specialists submit bids (proposal text + price)
└─ Bid status: "pending"

PHASE 3: SELECTION
├─ Client reviews bids in Marketplace tab
├─ Client clicks "Accept Bid" 
├─ RPC accept_bid() triggers:
│  ├─ Bid status: pending → accepted
│  ├─ Other bids: pending → rejected
│  ├─ Task status: open → active
│  ├─ specialist_id assigned to task
│  └─ workspace_room created (status: active)
└─ System loads ProjectRoom tab

PHASE 4: EXECUTION
├─ Client & specialist communicate in ProjectRoom (real-time messages)
├─ Workspace status: "active"
└─ Either party can initiate dispute:
   ├─ Click "File Dispute" button
   ├─ Provide dispute_reason
   ├─ Set workspace status: disputed
   └─ [Admin would review; not yet implemented]

PHASE 5: COMPLETION
├─ Client clicks "Complete & Review"
├─ Client submits rating_score (1-5?) + feedback_text
├─ Review record inserted into reviews table
├─ Task status: active → completed
├─ Workspace status: active → completed
├─ System generates printable receipt/invoice
└─ Page reloads

PHASE 6: POST-COMPLETION
├─ Review visible to both parties
├─ Rating stored (but no aggregation yet)
└─ [Platform admin could generate reports]
```

### Status Enums Tracked
- **Tasks:** open → active → (disputed) → completed
- **Bids:** pending → (accepted | rejected)
- **Workspace:** active → (disputed) → completed
- **Reviews:** Created post-completion only

### Atomic Operations
- Bid acceptance is handled via database RPC to ensure no race conditions
- Workspace room creation is idempotent (ON CONFLICT DO NOTHING)

### Current Gaps
- ❌ No payment collection before acceptance
- ❌ No escrow mechanics (mentioned in receipt but not coded)
- ❌ No dispute resolution workflow (filed but not reviewed)
- ❌ No partial/milestone-based payments
- ❌ No contract finalization documents
- ❌ No task modification after acceptance
- ❌ No completion deadline tracking

---

## 3. Notification System

### Current State: **NOT IMPLEMENTED**

**What Exists:**
- Toast notifications (in-app, temporary, client-side only)
- Error alerts (browser `alert()` popups)

**What's Missing:**
- ❌ Email notifications (task updates, bid received, messages, dispute filed, review posted)
- ❌ Push notifications (in-app or mobile)
- ❌ SMS alerts
- ❌ Notification preferences (user can choose which events to receive)
- ❌ Notification history/inbox
- ❌ Batch notification digests
- ❌ Unread indicator for messages (beyond bid count)

**Where Notifications Should Exist:**
1. **For Clients:**
   - New bid received on posted task
   - Bid status changed (accepted/rejected)
   - Message from specialist
   - Dispute filed by specialist
   - Project completion/review submitted

2. **For Specialists:**
   - New matching task posted
   - Bid status changed
   - Message from client
   - Task accepted
   - Dispute filed by client
   - Project completion/review submitted

**Implementation Strategy Needed:**
- Database: `notifications` table
- Queue: Background job processor (e.g., Supabase Functions, or external)
- Channels: Email template system + SMS provider (Twilio/Africa's Talking) + in-app inbox
- Real-time: Supabase Realtime for in-app notifications

---

## 4. User Reputation/Profile System

### Current State: **MINIMAL IMPLEMENTATION**

**What Exists:**
- `reviews` table stores rating_score + feedback_text
- Specialists have `is_verified` boolean flag
- Profiles have `portfolio_images[]`, `professional_title`, `hourly_rate`
- Contact fields: `phone_number`, `email_address`

**What's Missing:**
- ❌ **No Reputation Aggregation:** Reviews are stored but never summed or averaged
- ❌ **No Specialist Ranking:** Can't query "top-rated specialists in category X"
- ❌ **No Client Reputation:** No tracking of client reliability (do they pay? leave reviews?)
- ❌ **No Trust Score:** Can't calculate aggregate score from reviews + other signals
- ❌ **No Badges/Credentials:** No way to mark expertise, certifications, or experience levels
- ❌ **No Historical Trending:** Can't see if reputation improving/declining
- ❌ **No Response Time Metrics:** Not tracking how fast specialists bid or reply
- ❌ **No Completion Rate:** Not tracking % of bids that convert to completed tasks

**Database Gaps:**
- No `specialist_metrics` table with aggregates
- No `reputation_history` table for trending
- No `certifications` table
- No `availability` tracking

**UI/UX Gaps:**
- Specialists list shows no ratings/reviews
- No "top specialists" ranking
- No specialist search by rating
- No client rating visible to specialists before bidding
- No verification badge in UI
- ProfileHub shows profile but no reputation stats

**Recommended Implementation:**
1. Add `specialist_stats` table (computed: avg_rating, completion_rate, response_time, total_reviews)
2. Create view or RPC to aggregate reviews for specialist
3. Add reputation card to specialist search results
4. Show "Client rating" in bid history
5. Track created_at timestamps to calculate response times
6. Add background job to update stats daily/weekly

---

## 5. Contact Management Between Clients & Specialists

### Current State: **BASIC/UNSTRUCTURED**

**What Exists:**
- Workspace rooms force direct connection (task_id + client_id + specialist_id)
- Specialists list shows all verified specialists
- `fetchSpecialistContact()` returns: `full_name`, `phone_number`, `email`, `email_address`
- Bid notes allow messaging during bidding phase

**What's Missing:**
- ❌ **No Explicit Contact List:** No "my contacts" view for either party
- ❌ **No Contact History:** Can't see past interactions outside current workspace
- ❌ **No Direct Messaging:** No way to message without a task
- ❌ **No Saved Contacts:** Can't bookmark/favorite specialists for future
- ❌ **No Bulk Export:** No way to export contact list (CSV/PDF)
- ❌ **No Availability/Scheduling:** No way to check specialist availability before posting
- ❌ **No Service Area Definition:** Specialists can't define service radius; only district-based
- ❌ **No Repeat Customer Tracking:** Can't identify returning clients
- ❌ **No Referral System:** No way to refer specialist to other clients
- ❌ **No Trust Indicators:** No "repeat customer" or "verified buyer" badges

**Current Messaging Pattern:**
1. **Bidding Phase:** Client posts task; specialist submits bid with note
2. **Active Phase:** Only communicate via workspace_messages once bid accepted
3. **Post-Completion:** No further contact (except review)

**Contact Touch Points:**
- Marketplace tab: View specialist list (district-filtered)
- Bid submission: Add proposal note (one-way)
- Workspace: Two-way messaging (real-time)
- Receipt export: Shows specialist amount (no contact listed)

**Recommended Implementation:**
1. Add `contacts` table (user_id, contact_id, relationship, added_at, notes)
2. Show "Add to Contacts" button on specialist profiles & after bid acceptance
3. Create "My Contacts" tab/view
4. Add direct messaging feature (optional task requirement)
5. Track interaction count (how many projects completed together)
6. Add "Repeat Customer" badge for 3+ completed projects

---

## 6. Dispute Handling System

### Current State: **PARTIALLY IMPLEMENTED**

**What Exists:**
- `workspace_rooms` has columns: `dispute_initiated_by`, `dispute_reason`, `status`
- Dispute status: Can change from "active" → "disputed"
- Functionality: Client/specialist can click "File Dispute" in ProjectRoom
  - Prompts for dispute reason
  - Updates `dispute_initiated_by` to current user.id
  - Updates `dispute_reason` to user-provided text
  - Updates `status` to "disputed"
  - Shows alert: "⚖️ Dispute case officially opened. Escrow funds locked; an administrator will review this chat stream."

**What's Missing:**
- ❌ **No Admin Panel:** No way for admins to view disputes and make decisions
- ❌ **No Dispute History Table:** `workspace_rooms` only tracks current status (overwrites on re-dispute)
- ❌ **No Evidence Upload:** Can't attach files or screenshots to support dispute
- ❌ **No Adjudication Workflow:** No defined process for reaching resolution
- ❌ **No Escalation Levels:** No appeal process after admin decision
- ❌ **No Escrow Implementation:** Receipt mentions "escrow locked" but no actual mechanics
- ❌ **No Fund Distribution Logic:** Can't split/refund/award based on dispute outcome
- ❌ **No Dispute Metrics:** Can't report on dispute rate, resolution time, or common causes
- ❌ **No Automatic Mediation:** No suggested remedies or auto-resolution attempts
- ❌ **No Communication After Dispute:** Chat might be frozen but not explicitly blocked
- ❌ **No Time Tracking:** Can't see how long dispute has been open

**Current Flow:**
```
Dispute Filed
├─ Room status: active → disputed
├─ disputed_initiated_by: User A
├─ dispute_reason: "Work not completed as specified"
└─ [No further action possible; requires manual admin intervention]
```

**Database Issues:**
- `dispute_reason` is TEXT, can be overwritten by re-disputing
- No timestamp for when dispute was filed
- No tracking of previous dispute attempts
- No "evidence" or "attachment" fields

**UI Issues:**
- Receipt export says "Escrow funds locked" but not actually locked
- No dispute status visible in workspace room list
- No indication to other party that dispute is filed
- No way to view open disputes or their status

**Recommended Implementation:**
1. Create `disputes` table:
   - `id, workspace_room_id, filed_by, reason, status, created_at, resolved_at, resolution`
2. Create `dispute_messages` table for admin notes
3. Create admin panel with dispute queue
4. Add evidence upload (file storage)
5. Implement escrow hold (payment integration required)
6. Add mediation attempts (auto-suggest compromises)
7. Track dispute metrics (causes, resolution times)

---

## 7. Authentication & User Roles

### Current State: **FULLY IMPLEMENTED**

**Authentication:**
- **Provider:** Supabase Auth (email + password)
- **Flow:**
  1. AuthGateway component: User signs up or signs in
  2. Supabase creates auth.users record + JWT token
  3. Stored in browser session (Supabase SDK handles)
  4. useAuth() hook subscribes to auth state changes
  5. Automatic logout when token expires

**Components:**
- `AuthGateway`: Sign up/in form
- `useAuth()` hook: Maintains user & loading state

**User Roles:**
- **client:** Posts tasks, reviews bids, accepts specialists, initiates disputes, leaves reviews
- **specialist:** Bids on tasks, communicates in workspaces, can dispute, receives reviews

**Role Management:**
- Set on first login (IdentitySelection component)
- Can be switched later via ProfileHub → "Switch to [role]" button
- `updateUserRole()` updates `profiles.role` column
- Switching is instant (no re-authentication)

**Dual-Role Support:**
- User can switch roles at any time
- Both roles share same profile record
- Can be client + specialist simultaneously
- Useful for specialists who also post tasks, and clients who also bid

**Authorization (RLS):**
- All table access controlled via Row-Level Security policies
- Policies check `auth.uid()::text` against stored IDs
- No role-based policies yet (all users see all public data)
- Workspace rooms restrict to participants only

**Session Management:**
- Supabase SDK handles token refresh automatically
- Sign out clears session
- Page refresh restores session from storage

**What Exists:**
- ✅ Email/password auth
- ✅ Account creation & profile setup
- ✅ Session persistence
- ✅ Automatic token refresh
- ✅ Dual-role support
- ✅ Role switching
- ✅ Sign out

**What's Missing:**
- ❌ Social login (Google, Facebook)
- ❌ Email verification (users can sign up with unverified emails)
- ❌ Password reset flow
- ❌ Two-factor authentication
- ❌ Phone verification
- ❌ Admin role (for dispute resolution, platform management)
- ❌ Moderator role (for content moderation)
- ❌ Permission-based access (only JWT-level roles)
- ❌ Session timeout/auto-logout
- ❌ Account deactivation/deletion
- ❌ Login attempt limiting (brute force protection)
- ❌ Password strength requirements visible to user

**Code Location:**
- Auth setup: [supabaseClient.js](supabaseClient.js)
- Auth hook: [src/hooks/useAuth.js](src/hooks/useAuth.js)
- Auth UI: [src/components/AuthGateway.jsx](src/components/AuthGateway.jsx)
- Role management: [src/hooks/useProfile.js](src/hooks/useProfile.js), [ProfileHub.jsx](src/components/ProfileHub.jsx)

---

## 8. Component Architecture Overview

### Main App Shell
```
App (ToastProvider wrapper)
└─ CatchUpApp
   ├─ useAuth() → {user, loading, signOut}
   ├─ useProfile(user) → {profile, role, setupRole, switchRole}
   ├─ useMarketplaceData() → {tasks, bids, specialists, syncData}
   ├─ useRealtimeSubscriptions(syncData, syncData)
   └─ Route: activeTab state
      ├─ "marketplace" → Marketplace (browse tasks, post tasks, submit bids)
      ├─ "messages" → ProjectRoom (workspace communication)
      ├─ "analytics" → AnalyticsLedger (platform metrics)
      ├─ "telemetry" → SystemTelemetry (health checks)
      └─ "profile" → ProfileHub (profile viewing & role switching)
```

### Key Components

| Component | Purpose | Key Props | Key State |
|-----------|---------|-----------|-----------|
| **AuthGateway** | Sign up/in form | `onAuthSuccess` | isSignUp, email, password, loading, error |
| **IdentitySelection** | Role choice (client/specialist) | `onSelectComplete`, `isLoading` | — |
| **Marketplace** | Main feed: tasks, bids, specialists | `user`, `role`, `tasks`, `bids`, `specialists`, `districtFilter` | subView (jobs/specialists), search, bidAmounts/Notes, showCreate |
| **ProjectRoom** | Active workspace: messaging, dispute, review | `user`, `activeRoom` | rooms, activeRoom, messages, specialistProfile, showReviewModal, ratingScore |
| **ProfileHub** | User profile & role switching | `user`, `role`, `syncPlatformEngineData` | profile, loading |
| **AnalyticsLedger** | Platform metrics dashboard | `tasks`, `bids` | — (all via props) |
| **SystemTelemetry** | Health checks & event logs | — | — (hardcoded checks) |
| **Navigation** | Tab bar & controls | `user`, `role`, `activeTab`, `unreadCount` | — |
| **Toast** | Notification provider & hook | — | toast messages queue |
| **ErrorBoundary** | Error catch wrapper | — | — |

### Data Flow
```
User Action (e.g., submit bid)
  → Component state update
  → Supabase API call via supabaseService
  → Table insert/update
  → Realtime subscription triggers
  → useMarketplaceData.syncData() called
  → State updates all components
```

---

## 9. Service Layer Architecture

### supabaseService.js - Core Functions

**User & Auth:**
- `fetchUserProfile(userId)` → profile object
- `createUserProfile(userId, role, email, fullName)` → creates profiles + client/specialist record
- `fetchUserRole(userId)` → role string
- `updateUserRole(userId, newRole)` → updates role

**Tasks:**
- `fetchTasks(filters)` → filtered task array
- `fetchAllActiveTasks()` → tasks not archived/expired
- `createTask(taskData)` → inserts new task
- `updateTask(taskId, updates)` → updates task fields

**Bids:**
- `fetchAllBids()` → all bids with specialist joins
- `fetchBidsForTask(taskId)` → bids for specific task
- `submitBid(bidData)` → inserts bid
- `updateBidStatus(bidId, status)` → updates bid status
- `acceptBid(taskId, bidId)` → calls accept_bid() RPC, returns {gross, fee, net}

**Specialists:**
- `fetchSpecialists(filters)` → specialists with district filtering

**Workspace Rooms:**
- `fetchWorkspaceRoomsForUser(userId)` → rooms where user is client or specialist
- `fetchWorkspaceRoom(roomId)` → single room with task details
- `updateWorkspaceRoomStatus(roomId, status, disputeData)` → updates status ± dispute fields

**Workspace Messages:**
- `fetchWorkspaceMessages(roomId)` → message history
- `sendWorkspaceMessage(roomId, senderId, messageText)` → inserts message

**Reviews:**
- `submitReview(reviewData)` → inserts review record
- `fetchSpecialistContact(specialistId)` → phone, email, email_address

**Realtime:**
- `subscribeToTasks(callback)` → listens to task changes
- `subscribeToBids(callback)` → listens to bid changes
- `subscribeToWorkspaceMessages(roomId, callback)` → listens to messages in room

### Library Functions

**chat.js:**
- Realtime chat subscription & message handling
- Maps message rows to UI format

**specialists.js:**
- Specialist profile mapping & display helpers
- `fetchRegisteredSpecialists()`, `saveUserProfile()`

---

## 10. Business Logic & Rules

### Constraints & Validations

| Rule | Where Enforced | Status |
|------|----------------|--------|
| One bid per specialist per task | Database UNIQUE constraint | ✅ |
| One workspace room per task+participants | Database UNIQUE constraint | ✅ |
| Only task owner can accept bids | accept_bid() RPC + RLS | ✅ |
| Only specialist can submit bid | RLS policy | ✅ |
| Only room participants can message | RLS policy | ✅ |
| Only client can file review | RLS policy | ✅ |
| Task must exist to accept bid | RPC validation | ✅ |
| Bid must exist for task | RPC validation | ✅ |
| Specialist can only update own bid | RLS policy | ✅ |
| Dispute reason required | UI validation only | ⚠️ (client-side) |
| Review rating required | UI validation only | ⚠️ (client-side) |

### Business Rules (Not Enforced)
- ❌ Specialist can't bid on own task
- ❌ Minimum bid amount
- ❌ Maximum bid amount per specialist
- ❌ Task description length limits
- ❌ Proposal length limits
- ❌ Dispute must be filed within N days of acceptance
- ❌ Review must be filed within N days of completion
- ❌ Can't modify task after bid accepted
- ❌ Can't cancel task (only delete if open)
- ❌ Minimum specialist rating to bid
- ❌ Client review requirement

---

## 11. Summary: Implemented vs. Missing

### ✅ What's Built

**Core MVP Features:**
1. User authentication (email/password)
2. Dual-role system (client/specialist)
3. Task posting by clients
4. Bid submission by specialists
5. Bid acceptance → workspace creation
6. Real-time workspace messaging
7. Dispute filing (status change, reason recorded)
8. Review & rating submission
9. Specialist browsing (district/category filtered)
10. Real-time updates (tasks, bids, messages)
11. Profile management & role switching
12. Platform metrics dashboard
13. System health telemetry
14. Digital receipt generation (printable)

**Technical:**
- Supabase auth with RLS
- Real-time Realtime subscriptions
- Atomic bid acceptance (RPC)
- Toast notification system
- Error boundary
- Tab-based routing

### ❌ Critical Gaps

**Business Logic:**
1. **Notifications** - No email, SMS, push, or in-app inbox
2. **Reputation** - Reviews stored but no aggregation or scoring
3. **Payment/Escrow** - No payment processing, no escrow mechanics
4. **Dispute Resolution** - Disputes filed but no admin review process
5. **Contact Management** - No contact list, favorites, or history
6. **Verification** - `is_verified` flag exists but no verification process
7. **Scheduling** - No availability/scheduling system
8. **Search** - Only basic filtering; no full-text search or sorting

**Features:**
1. Email verification & password reset
2. Admin dashboard & role
3. Compliance & audit logs
4. Identity verification process
5. Insurance/background checks
6. Analytics & reporting exports
7. Fraud detection
8. Featured listings / promotional tools
9. Certifications/qualifications system
10. Refund/cancellation mechanics

**Safety & Compliance:**
1. No account deactivation/deletion
2. No data retention policies
3. No GDPR consent management
4. No compliance audit logs
5. No brute-force protection

---

## 12. File Structure Reference

```
src/
├── App.js (main router & state coordinator)
├── App.css (styling)
├── supabaseClient.js (Supabase client init)
├── components/
│   ├── AuthGateway.jsx (login/signup form)
│   ├── IdentitySelection.jsx (role choice)
│   ├── Marketplace.jsx (main feed - tasks, bids, specialists)
│   ├── ProjectRoom.jsx (workspace: messages, dispute, review)
│   ├── ProfileHub.jsx (profile & role switch)
│   ├── Navigation.jsx (tab bar)
│   ├── AnalyticsLedger.jsx (metrics dashboard)
│   ├── SystemTelemetry.jsx (health checks)
│   ├── Toast.jsx (notification provider)
│   ├── Modal.jsx (generic modal)
│   ├── SpecialistAvatar.jsx (avatar rendering)
│   ├── FeedEmptyState.jsx (empty state UI)
│   └── ErrorBoundary.jsx (error catch)
├── hooks/
│   ├── useAuth.js (auth state management)
│   ├── useProfile.js (profile & role management)
│   ├── useMarketplaceData.js (tasks, bids, specialists sync)
│   ├── useRealtimeSubscriptions.js (realtime listeners)
│   └── useWorkspaceRoom.js (workspace management)
├── services/
│   └── supabaseService.js (all Supabase API calls)
├── lib/
│   ├── chat.js (chat utilities & subscriptions)
│   └── specialists.js (specialist profile helpers)
└── utils/
    └── statusHelpers.js (formatting & enums)

supabase/
├── catchup-full-schema.sql (DDL + RLS + RPC)
└── setup-realtime-and-specialists.sql (realtime publications)

public/
├── index.html
├── manifest.json
└── robots.txt

build/ (compiled output)
```

---

## 13. Development Recommendations

### Immediate Priorities (MVP → Production)
1. **Email Notifications** - Bid updates, messages, disputes
2. **Payment Integration** - Stripe/Fawry for escrow
3. **Dispute Resolution** - Admin panel + adjudication
4. **Identity Verification** - KYC process for trust
5. **Reputation Aggregation** - Compute & display ratings

### Medium-Term (First Quarter)
1. Email verification & password reset
2. Specialist verification process
3. Direct messaging (optional task)
4. Contact management / favorites
5. Enhanced search & sorting
6. Admin dashboard

### Long-Term (Scaling)
1. Mobile app (React Native)
2. Advanced analytics & reporting
3. AI-powered matching
4. Subscription tiers / premium features
5. Referral / affiliate program
6. Compliance certifications (ISO, etc.)

---

## Appendix: Key Files to Know

| File | Purpose | Key Exports |
|------|---------|------------|
| [supabaseClient.js](supabaseClient.js) | Supabase initialization | `supabase` client |
| [supabaseService.js](src/services/supabaseService.js) | All DB operations | 20+ functions |
| [useAuth.js](src/hooks/useAuth.js) | Auth state | `{user, loading, signOut}` |
| [useProfile.js](src/hooks/useProfile.js) | Profile state | `{profile, role, setupRole, switchRole}` |
| [useMarketplaceData.js](src/hooks/useMarketplaceData.js) | Marketplace state | `{tasks, bids, specialists, syncData}` |
| [Marketplace.jsx](src/components/Marketplace.jsx) | Main UI | Task/bid rendering |
| [ProjectRoom.jsx](src/components/ProjectRoom.jsx) | Workspace UI | Messaging, dispute, review |
| [ProfileHub.jsx](src/components/ProfileHub.jsx) | Profile UI | Role switching |
| [catchup-full-schema.sql](supabase/catchup-full-schema.sql) | Database schema | Tables, RLS, RPC, realtime |
