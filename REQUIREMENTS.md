# CatchUp Platform - Feature Requirements & Implementation Roadmap

**Date:** May 28, 2026  
**Status:** MVP Audit + Feature Specification  

---

## Executive Summary

The platform has solid MVP infrastructure (bid lifecycle, real-time messaging, user profiles). However, **10 critical features** are missing or incomplete that will dramatically improve user trust, engagement, and platform viability. This document specifies each feature with current status, requirements, and implementation priorities.

---

## 1. ✅ ACCEPTANCE SUMMARY - "Contract Record"

### Current Status
- ❌ **NOT IMPLEMENTED** - No structured agreement snapshot after bid acceptance

### What Users Need
When a specialist's bid is accepted, the client should see a clear agreement snapshot containing:
- Job title
- Agreed amount (rate)
- Specialist name
- Client name
- Date accepted
- Proposal note (from bid)
- Expected delivery date/status
- Unique contract ID

### Database Changes Required
```sql
-- New table to store agreement snapshots
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  agreed_amount DECIMAL(10,2) NOT NULL,
  proposal_note TEXT,
  expected_delivery_date DATE,
  accepted_at TIMESTAMP DEFAULT now(),
  contract_data JSONB, -- Full snapshot
  created_at TIMESTAMP DEFAULT now()
);

-- Add to task completion receipt
ALTER TABLE completion_receipts ADD COLUMN agreement_id UUID REFERENCES agreements(id);
```

### Frontend Changes Required
- **New component:** `AgreementSnapshot.jsx` - Modal showing contract details after acceptance
- **Update:** `ProjectRoom.jsx` - Display agreement card with export button
- **Update:** `useWorkspaceRoom.js` - Fetch and cache agreement data

### Expected Delivery Date Logic
- If specialist provided estimate in bid → use that
- Otherwise → Current date + 7 days (default)
- Specialist can update in ProjectRoom before starting work

### UX Flow
1. Client accepts bid → Modal appears showing agreement snapshot
2. Agreement persists in workspace room header
3. Downloadable as PDF (agreement ID + all details)
4. Specialist can mark "Work delivered" to update status

---

## 2. 🟠 MILESTONES OR CHECKLIST - Simple Progress Tracking

### Current Status
- ❌ **NOT IMPLEMENTED** - No milestone or progress tracking

### What Users Need
For local services, a simple 5-step checklist instead of complex project management:

1. **Request confirmed** - Initial task posted
2. **Work scheduled** - Appointment/visit time set
3. **Work started** - Specialist begins service
4. **Client inspected** - Client reviews quality
5. **Completed** - Both parties agree work is done

### Database Changes Required
```sql
-- Milestone table
CREATE TABLE agreement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  milestone_number INT NOT NULL, -- 1-5
  name TEXT NOT NULL, -- "Request confirmed", "Work scheduled", etc.
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  completed_by TEXT, -- 'specialist', 'client', 'system'
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### Frontend Changes Required
- **New component:** `MilestoneChecklist.jsx` - Visual checklist in ProjectRoom
- **Update:** `ProjectRoom.jsx` - Add milestone section above chat
- **Update:** `useWorkspaceRoom.js` - Handle milestone status updates

### Completion Rules
- Milestone 1 auto-completes when task posted
- Milestone 2 requires specialist to set scheduled visit time
- Milestone 3 specialist marks "Work started"
- Milestone 4 client can mark "Inspected"
- Milestone 5 triggers completion flow

---

## 3. 📍 SCHEDULED VISIT / APPOINTMENT TIME - Location & Timing

### Current Status
- ❌ **NOT IMPLEMENTED** - No scheduling system, only chat-based coordination

### What Users Need
Neighborhood services need structured scheduling:
- **Proposed visit date** - Specialist suggests time
- **Address/area note** - Where service happens
- **Client confirmation** - Confirm or suggest alternative
- **Status:** Scheduled / Rescheduled / Completed

### Database Changes Required
```sql
-- Appointment/scheduling table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agreement_id UUID REFERENCES agreements(id),
  proposed_date TIMESTAMP NOT NULL,
  proposed_by TEXT NOT NULL, -- 'specialist' or 'client'
  confirmed_date TIMESTAMP,
  confirmed_by TEXT,
  service_address TEXT, -- Full address or area note
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, rescheduled, completed
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Frontend Changes Required
- **New component:** `ScheduleAppointment.jsx` - Date picker + location input
- **Update:** `ProjectRoom.jsx` - Show appointment card with accept/reschedule buttons
- **New hook:** `useAppointmentScheduling.js` - Manage appointment lifecycle

### UX Flow
1. After acceptance, specialist suggests visit date in ProjectRoom
2. Client sees appointment card with date + location
3. Client can confirm or propose alternative date
4. Once both agree, appointment status = "confirmed"
5. Countdown timer shows days until scheduled visit

---

## 4. 🔓 CONTACT UNLOCK AFTER ACCEPTANCE - Progressive Trust

### Current Status
- ⚠️ **PARTIAL** - Contact info hidden before acceptance, but no explicit unlock/reveal mechanism

### What Users Need
Before acceptance: Keep contact limited (name + avatar only)  
After acceptance: Reveal phone/email/WhatsApp  

**Why:** Makes accepting a bid feel valuable and safer for both parties

### Database Changes Already Present
- `profiles` table has `phone`, `email`, `whatsapp`
- RLS policies restrict visibility

### Changes Required
```sql
-- Add contact_revealed_at to track when contact was first accessed
ALTER TABLE workspace_rooms ADD COLUMN 
  contact_revealed_at TIMESTAMP;

-- Add audit log
CREATE TABLE contact_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES profiles(id),
  target_id UUID NOT NULL REFERENCES profiles(id),
  room_id UUID REFERENCES workspace_rooms(id),
  accessed_at TIMESTAMP DEFAULT now()
);
```

### Frontend Changes Required
- **Update:** `SpecialistAvatar.jsx` - Show contact "locked" state before acceptance
- **New component:** `ContactCard.jsx` - Shows phone/email/WhatsApp after acceptance
- **Update:** `ProjectRoom.jsx` - Replace avatar with ContactCard after acceptance
- **Update:** `supabaseService.js` - Add RLS check for contact visibility

### Visibility Rules
1. **Before bid accepted:** Show name + avatar only
2. **After bid accepted:** Show phone + email + WhatsApp options
3. **First contact reveal:** Log event (for specialist safety tracking)
4. **Display options:** Copy to clipboard, call, WhatsApp link, email link

---

## 5. ✅ COMPLETION CONFIRMATION FROM BOTH SIDES - Mutual Agreement

### Current Status
- ⚠️ **PARTIALLY IMPLEMENTED** - Only client marks completion

### Current Flow
- Client marks task "completed"
- Client submits review + rating
- Specialist can see review but can't explicitly confirm

### Recommended Enhanced Flow

1. **Specialist marks "Work delivered"**
   - Specialist indicates work is complete and ready for inspection
   - Status: work_delivered
   - Optional message: "Work is complete, please inspect"

2. **Client confirms "Work completed"**
   - After inspection, client marks task complete
   - Status: completed_by_client
   - Optional note: Satisfaction feedback

3. **Final agreement state: COMPLETED**
   - Both sides have acted
   - Triggers payment release (future)
   - Completion receipt generated

### Database Changes Required
```sql
-- Update tasks table
ALTER TABLE tasks ADD COLUMN 
  work_delivered_by TEXT, -- 'specialist' when specialist marks delivery
  work_delivered_at TIMESTAMP;

ALTER TABLE tasks ADD COLUMN 
  confirmed_by_client TEXT,
  confirmed_by_client_at TIMESTAMP;

-- Track who marked what and when
CREATE TABLE completion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  action TEXT NOT NULL, -- 'work_delivered', 'work_confirmed'
  actor_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### Frontend Changes Required
- **Update:** `ProjectRoom.jsx` - Add "Mark work delivered" button (specialist only, before client completion)
- **Update:** Completion flow to show both actions
- **New component:** `CompletionConfirmationModal.jsx` - Shows both parties' status
- **Update:** `useWorkspaceRoom.js` - Handle work_delivered status

### Trigger Rules
- Specialist can mark "delivered" at any time after start date
- Client must accept before marking "completed"
- Receipt only generates after both confirmations

---

## 6. 🔴 DISPUTE REASON + EVIDENCE - Lightweight Resolution

### Current Status
- ⚠️ **PARTIALLY IMPLEMENTED** - Disputes filed but no evidence collection or resolution

### Current Implementation
- Disputes stored in `disputes` table with reason
- **Missing:** Evidence collection, image uploads, timeline

### What Users Need

**When filing a dispute:**
1. **Reason dropdown** + free text
   - "Work quality not as agreed"
   - "Specialist didn't show up"
   - "Incomplete work"
   - "Other (explain)"

2. **Evidence collection**
   - Up to 5 images/screenshots (upload to storage)
   - Optional voice note
   - Reference message in chat (link to specific message)

3. **Final message from both sides**
   - Specialist responds to dispute with their side
   - Client can reply
   - Creates dispute thread (mini-conversation)

4. **Timeline in receipt**
   - Dispute filed: [date/time]
   - Specialist response: [date/time]
   - Resolution: [pending/resolved/escalated]

### Database Changes Required
```sql
-- Enhance disputes table
ALTER TABLE disputes ADD COLUMN 
  evidence JSONB, -- Array of {type: 'image'|'audio', url: 'storage_url', uploaded_at}
  reason_category TEXT, -- 'quality', 'no_show', 'incomplete', 'other'
  referenced_message_id UUID REFERENCES workspace_messages(id);

-- Dispute thread/responses
CREATE TABLE dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  evidence JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Admin resolution
CREATE TABLE dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  resolved_by_admin_id UUID REFERENCES profiles(id), -- NULL if auto-resolved
  resolution TEXT, -- 'refund_client', 'approve_specialist', 'partial_refund', 'no_action'
  amount DECIMAL(10,2),
  notes TEXT,
  resolved_at TIMESTAMP DEFAULT now()
);
```

### Frontend Changes Required
- **New component:** `DisputeForm.jsx` - Reason + evidence collection
- **New component:** `DisputeThread.jsx` - Show dispute messages + evidence
- **Update:** `ProjectRoom.jsx` - Show dispute status + evidence
- **Storage integration:** Upload images to Supabase Storage

### UX Flow
1. Client/Specialist initiates dispute from ProjectRoom
2. Dispute form opens: select reason + upload evidence (images)
3. Dispute filed → Other party notified (TODO: add notification)
4. Other party can respond with their evidence
5. Admin reviews (TODO: admin dashboard) for final decision
6. Resolution logged + shown in completion receipt

### Evidence Storage
```
supabase-storage/disputes/{dispute_id}/{timestamp}-{filename}
Access: Public read (evidence must be visible to both parties + admins)
```

---

## 7. ⭐ SPECIALIST REPUTATION CARD - Visible Trust Signals

### Current Status
- ⚠️ **DATA EXISTS BUT NOT AGGREGATED** - Reviews stored but never calculated or displayed

### Current Data
- `reviews` table has ratings + text
- `profiles` table has `is_verified` flag
- **Missing:** Aggregation, ranking, visual display

### What Specialists Need to Display
1. **Completed jobs** - Count of finished tasks
2. **Rating** - Average stars (1-5) from reviews
3. **Response speed** - Avg hours to bid/accept
4. **Verified badge** - `is_verified = true` flag (visual indicator)
5. **Service districts** - Categories/areas specialist covers
6. **Service categories** - What they specialize in

### Database Changes Required
```sql
-- Materialized reputation view (recalculated on task completion)
CREATE TABLE specialist_reputation (
  specialist_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_completed_jobs INT DEFAULT 0,
  total_reviews INT DEFAULT 0,
  average_rating DECIMAL(2,1) DEFAULT 0, -- 0.0 - 5.0
  response_time_hours INT DEFAULT 0, -- Average hours to first bid
  is_verified BOOLEAN DEFAULT false,
  service_categories TEXT[], -- Array of categories
  service_areas TEXT[], -- Array of areas
  profile_completeness INT DEFAULT 0, -- % (0-100)
  calculated_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Track response times
CREATE TABLE specialist_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  posted_at TIMESTAMP,
  first_bid_at TIMESTAMP,
  response_time_hours INT,
  created_at TIMESTAMP DEFAULT now()
);
```

### Recalculation Logic
After task completion or review submission:
```sql
UPDATE specialist_reputation
SET 
  total_completed_jobs = (SELECT COUNT(*) FROM tasks WHERE specialist_id = ? AND status = 'completed'),
  total_reviews = (SELECT COUNT(*) FROM reviews WHERE specialist_id = ? AND rating IS NOT NULL),
  average_rating = ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE specialist_id = ? AND rating IS NOT NULL,
  response_time_hours = (SELECT AVG(response_time_hours) FROM specialist_metrics WHERE specialist_id = ?),
  updated_at = now()
WHERE specialist_id = ?;
```

### Frontend Changes Required
- **New component:** `SpecialistReputationCard.jsx` - Shows all metrics visually
- **Update:** `Marketplace.jsx` - Sort specialists by rating/verified
- **Update:** `ProfileHub.jsx` - Show specialist's own reputation metrics
- **New hook:** `useSpecialistReputation.js` - Fetch reputation data

### Visual Design
```
┌─────────────────────────────────┐
│ ⭐ 4.8 (12 reviews)             │  ← Average rating + count
│ ✓ Verified                      │  ← Badge
│ ✓ 34 jobs completed             │  ← Experience
│ ⚡ Responds in 2 hours average  │  ← Speed
│                                 │
│ Categories: Plumbing, Electrical│  ← Services
│ Areas: Downtown, Shobra, Helwan │  ← Coverage
│                                 │
│ Profile: 85% complete           │  ← Completeness
└─────────────────────────────────┘
```

---

## 8. 👥 CLIENT RELIABILITY - Trust Signals for Specialists

### Current Status
- ❌ **NOT IMPLEMENTED** - No client reputation/reliability metrics

### What Specialists Need to See
When reviewing job postings, specialists should see:
1. **Posted jobs** - Lifetime count of jobs posted
2. **Completed jobs** - How many went to completion
3. **Average acceptance behavior** - Do they accept bids fairly?
4. **Verified phone/email** - Trust signals
5. **Rating from specialists** - Reverse reviews (specialists rating clients)
6. **Response to messages** - Does client engage?

### Database Changes Required
```sql
-- Client reputation table
CREATE TABLE client_reputation (
  client_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_jobs_posted INT DEFAULT 0,
  total_jobs_completed INT DEFAULT 0,
  completion_rate DECIMAL(3,1) DEFAULT 0, -- % of jobs completed vs abandoned
  average_acceptance_rate DECIMAL(3,1) DEFAULT 0, -- Avg bids received → accepted
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  average_rating_from_specialists DECIMAL(2,1) DEFAULT 0, -- Reverse rating
  total_ratings_given INT DEFAULT 0,
  average_response_time_hours INT DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Specialist rates client (reverse review)
CREATE TABLE specialist_client_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  rating INT NOT NULL, -- 1-5
  comment TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  UNIQUE(specialist_id, task_id) -- One rating per specialist per task
);
```

### Frontend Changes Required
- **New component:** `ClientReputationBadge.jsx` - Shows in job listings
- **Update:** `Marketplace.jsx` - Display client badges when browsing jobs
- **Update:** `ProfileHub.jsx` - Show how clients rate your reliability (if specialist)
- **New hook:** `useClientReputation.js` - Fetch client data

### Calculation Logic
After specialist marks task completed:
```
completion_rate = (completed_jobs / total_jobs_posted) * 100
acceptance_rate = (jobs_with_accepted_bids / jobs_posted) * 100
response_time = Average hours from message sent to response
```

### Visual Design
```
┌─────────────────────────────────┐
│ Client: Ahmed Hassan            │
│ Jobs Posted: 8                  │
│ Completion Rate: 75%            │
│ Average Rating: 4.2 ⭐ (6 rates)│
│ ✓ Phone verified                │
│ ✓ Email verified                │
│ Responds: ~30 min avg           │
└─────────────────────────────────┘
```

---

## 9. 🔔 NOTIFICATIONS - Critical Missing Feature

### Current Status
- ❌ **NOT IMPLEMENTED** - Only client-side toast notifications (temp)

### What Users Need Notifications For
1. **Someone bids on your task** → Client notified
2. **Bid accepted** → Specialist notified
3. **Workspace message arrives** → Both parties notified
4. **Dispute filed** → Other party + admin notified
5. **Work delivery marked** → Client notified
6. **Completion confirmed** → Both parties notified

### Notification Types Needed
- **In-app** (persistent, in platform)
- **Email** (immediate for critical events)
- **SMS** (optional, pay-per-message)
- **WhatsApp** (optional, via Twilio)

### Database Changes Required
```sql
-- Notification types
CREATE TYPE notification_type AS ENUM (
  'bid_received', 'bid_accepted', 'bid_rejected',
  'message_received', 'task_started', 'work_delivered',
  'task_completed', 'dispute_filed', 'dispute_response',
  'review_received', 'verification_status'
);

-- Notification table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id), -- NULL for system notifications
  type notification_type NOT NULL,
  task_id UUID REFERENCES tasks(id),
  related_id UUID, -- dispute_id, review_id, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- Link to click: /task/123/room
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_recipient_created (recipient_id, created_at DESC)
);

-- User notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bid_received_in_app BOOLEAN DEFAULT true,
  bid_received_email BOOLEAN DEFAULT true,
  message_received_in_app BOOLEAN DEFAULT true,
  message_received_email BOOLEAN DEFAULT false,
  task_completed_in_app BOOLEAN DEFAULT true,
  task_completed_email BOOLEAN DEFAULT true,
  dispute_filed_in_app BOOLEAN DEFAULT true,
  dispute_filed_email BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Notification delivery log (for email/SMS/WhatsApp)
CREATE TABLE notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  recipient_address TEXT NOT NULL, -- email/phone
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

### Implementation Steps
1. **In-app notifications** (Phase 1 - Required)
   - Add notification table
   - Add bell icon in Navigation showing unread count
   - Create Notifications panel to view history
   - Mark as read when clicked

2. **Email notifications** (Phase 2)
   - Use Supabase Functions to call SendGrid/Mailgun
   - Send immediately for critical events
   - Batch daily digest for others

3. **SMS/WhatsApp** (Phase 3 - Nice to have)
   - Use Twilio API
   - For critical events only (accepted bid, dispute)

### Frontend Changes Required
- **Update:** `Navigation.jsx` - Add notification bell + unread count
- **New component:** `NotificationCenter.jsx` - Popup panel
- **New component:** `NotificationPreferences.jsx` - Settings page
- **Update:** `useRealtimeSubscriptions.js` - Subscribe to notifications in real-time
- **New hook:** `useNotifications.js` - Fetch + manage notifications

### Trigger Rules
```
When bid submitted → Create notification for task author
When bid accepted → Create notification for specialist
When message sent → Create notification for other party (if not same person chatting)
When task marked completed → Create notification for other party
When dispute filed → Create notification for other party + mark for admin
```

---

## 10. 📋 AGREEMENT RECEIPT/EXPORT - Downloadable Record

### Current Status
- ⚠️ **PARTIALLY IMPLEMENTED** - Receipt generated but no download/export

### Current Implementation
- `completion_receipts` table stores receipt data
- Shown in UI but no PDF export

### What Users Need
Downloadable receipt after completion containing:

**Header:**
- Agreement ID (unique reference)
- Date generated
- Platform logo

**Parties:**
- Client name + phone (if verified)
- Specialist name + phone (if verified)

**Job Details:**
- Task title
- Task category
- Full description (initial posting)

**Agreement:**
- Agreed amount
- Proposal note
- Expected delivery date
- Scheduled appointment date/address (if applicable)

**Execution:**
- Started date
- Completed date
- Milestone completion dates (checkmarks)

**Quality:**
- Rating (if review submitted)
- Review text
- Client comment

**Dispute Status (if applicable):**
- Dispute filed date
- Dispute reason
- Evidence count
- Resolution status

**Platform Notes:**
- "CatchUp is a trusted marketplace for local services"
- Terms link
- Support email

### Technical Implementation
```javascript
// Use library: html2pdf or jsPDF + html2canvas
// Trigger: After completion confirmed by both parties

generateReceiptPDF(agreement, task, completion, dispute?) → PDF blob
downloadPDF(blob, filename: "catchup-agreement-{id}.pdf")
```

### Frontend Changes Required
- **New component:** `ReceiptPDF.jsx` - Render receipt as printable HTML
- **Update:** `useWorkspaceRoom.js` - Add download receipt function
- **Update:** `ProjectRoom.jsx` - Add "Download Receipt" button (visible after completion)
- **Add dependency:** `html2pdf` or `jsPDF`

### UX Flow
1. After client confirms work completed
2. "Download Receipt" button appears
3. Click → PDF generated + browser downloads
4. User can share or archive

---

## Implementation Priority & Sequencing

### 🔴 Phase 1: CRITICAL (Weeks 1-2)
Must have before scaling:
1. **Notifications** (#9) - Users won't know what's happening without this
2. **Specialist Reputation Card** (#7) - Trust signals required for marketplace
3. **Contact Unlock** (#4) - Basic safety feature

### 🟠 Phase 2: IMPORTANT (Weeks 3-4)
Essential for user satisfaction:
4. **Acceptance Summary** (#1) - Make agreement clear
5. **Completion Confirmation Both Sides** (#5) - Fair closure
6. **Dispute Reason + Evidence** (#6) - Enable conflict resolution

### 🟡 Phase 3: ENHANCING (Weeks 5-6)
Improves UX but not blocking:
7. **Milestones Checklist** (#2) - Progress visibility
8. **Scheduled Visit/Appointment** (#3) - Better coordination
9. **Client Reliability** (#8) - Specialist safety

### 🟢 Phase 4: POLISH (Week 7)
Finishing touches:
10. **Agreement Receipt/Export** (#10) - Professional closure

---

## Cross-Feature Dependencies

```
Notifications (#9) ← Required by all other features
Specialist Reputation (#7) ← Needed for Marketplace sorting
Contact Unlock (#4) ← Enables safe communication
Acceptance Summary (#1) → Enables Dispute Reason (#6)
Milestones (#2) → Enables Completion Confirmation (#5)
Completion Confirmation (#5) → Enables Dispute Resolution
Receipt Export (#10) ← Built after all above features work
```

---

## Database Schema Summary

**New Tables to Create:**
- `agreements` - Contract snapshots
- `agreement_milestones` - Progress tracking
- `appointments` - Scheduled visits
- `specialist_reputation` - Aggregated metrics
- `specialist_metrics` - Response times
- `client_reputation` - Client reliability
- `specialist_client_ratings` - Reverse reviews
- `dispute_responses` - Dispute conversations
- `dispute_resolutions` - Admin decisions
- `notifications` - In-app notifications
- `notification_preferences` - User settings
- `notification_delivery` - Email/SMS/WhatsApp log
- `completion_log` - Who marked what

**Tables to Alter:**
- `tasks` - Add work_delivered, confirmed_by_client timestamps
- `disputes` - Add evidence, reason_category, referenced_message_id
- `completion_receipts` - Add agreement_id, dispute_resolution fields
- `workspace_rooms` - Add contact_revealed_at
- `profiles` - Add service_categories, service_areas (if not exists)

**RLS Policies to Update:**
- Contact visibility (phone/email/whatsapp)
- Reputation data (public read, user-controlled write)
- Notification permissions (read own only)
- Dispute evidence (both parties + admin)

---

## Success Metrics

After implementing all 10 features:
- **User Trust:** Client/Specialist ratings show > 4.0 average
- **Resolution:** Disputes resolved within 48 hours
- **Engagement:** Repeat transaction rate > 40%
- **Communication:** Message response time < 2 hours average
- **Safety:** 100% phone verification before work
- **Reliability:** 95% task completion rate

---

## Notes for Development

1. **All features should support real-time updates** via Supabase subscriptions
2. **Mobile-friendly** - These features are used on phones during work
3. **Offline support** - Cache notifications + reputation locally
4. **Admin dashboard** needed for dispute resolution + platform health
5. **Email templates** required for notifications (use Postmark/SendGrid)
6. **Image storage** for dispute evidence (Supabase Storage)

