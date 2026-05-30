# Phase 1 Implementation Guide - Setup Instructions for User

**Status:** Phase 1 (CRITICAL) Features Implementation Complete  
**Date:** May 28, 2026  
**Implemented by:** AI Assistant  

---

## Summary of What's Been Done

I've implemented the **frontend components, hooks, and database schema** for Phase 1 features:

### ✅ Created Files (Frontend)
1. **Notification System**
   - `src/hooks/useNotifications.js` - Hook to manage notifications
   - `src/components/NotificationCenter.jsx` - UI component with bell icon
   - `src/components/NotificationCenter.css` - Styling

2. **Specialist Reputation Card**
   - `src/hooks/useSpecialistReputation.js` - Hook to fetch reputation data
   - `src/components/SpecialistReputationCard.jsx` - Visual reputation display
   - `src/components/SpecialistReputationCard.css` - Styling

3. **Contact Unlock System**
   - `src/hooks/useContactVisibility.js` - Hook for contact reveal logic
   - `src/components/ContactCard.jsx` - Contact info display component
   - `src/components/ContactCard.css` - Styling

4. **Service Functions**
   - Updated `src/services/supabaseService.js` with:
     - Notification CRUD operations
     - Specialist reputation fetching
     - Contact reveal functions

5. **Updated Navigation**
   - Modified `src/components/Navigation.jsx` to include NotificationCenter

### 📊 Created Database Schema File
- `supabase/phase-1-migrations.sql` - Complete SQL migration file

---

## What YOU Need to Do (Supabase Setup)

### Step 1: Run Database Migrations

You **MUST** run the SQL migration file in your Supabase project:

1. Open **Supabase Dashboard** → Your Project
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/phase-1-migrations.sql`
5. Paste into the SQL editor
6. Click **Run**

**This creates:**
- `notifications` table
- `notification_preferences` table
- `notification_delivery` table
- `specialist_metrics` table
- `specialist_reputation` table
- `contact_access_log` table
- RLS policies for all new tables
- Helper functions (`calculate_specialist_reputation`, `create_notification`)

⚠️ **IMPORTANT:** This step is **critical** and must be done before the app will work.

---

### Step 2: Update RLS Policies for Contact Visibility

The contact reveal feature needs an RLS policy update. After running migrations, add this policy:

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Find the `profiles` table
3. Add a new policy for **contact visibility check**:

```sql
-- Policy to control contact visibility
CREATE POLICY "Users can view contact after workspace acceptance"
  ON profiles FOR SELECT
  USING (
    -- User can always see their own profile
    auth.uid() = id
    -- Or if they are both in an accepted workspace
    OR EXISTS (
      SELECT 1 FROM workspace_rooms
      WHERE (
        (client_id = auth.uid() AND specialist_id = id AND status = 'accepted')
        OR
        (specialist_id = auth.uid() AND client_id = id AND status = 'accepted')
      )
    )
  );
```

---

### Step 3: Integrate Hooks & Components into Your Main App

Update your main **App.js** (or wherever you manage state) to use the new hooks:

```javascript
import { useNotifications } from './hooks/useNotifications';
import { useSpecialistReputation } from './hooks/useSpecialistReputation';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('client');

  // Add notification hook
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications(user?.id);

  // Update Navigation component to pass notifications
  return (
    <Navigation
      user={user}
      role={role}
      notifications={notifications}
      unreadCount={unreadCount}
      onNotificationClick={(notification) => {
        // Navigate to notification.action_url
        // Example: if (notification.action_url) window.location.href = notification.action_url;
      }}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onClearAll={clearAll}
      setRole={setRole}
      setActiveTab={/* your setActiveTab function */}
      activeTab={/* your activeTab state */}
      onSignOut={/* your signOut function */}
    />
  );
}
```

---

### Step 4: Display Specialist Reputation in Components

#### In Marketplace (when browsing specialists):

```javascript
import SpecialistReputationCard from './components/SpecialistReputationCard';
import { useSpecialistReputation } from './hooks/useSpecialistReputation';

export function SpecialistCard({ specialist }) {
  const { reputation } = useSpecialistReputation(specialist.id);

  return (
    <div>
      <h3>{specialist.full_name}</h3>
      <SpecialistReputationCard 
        reputation={reputation}
        compact={false}
        clickable={true}
      />
    </div>
  );
}
```

#### In Profile Hub (specialist's own profile):

```javascript
export function ProfileHub({ user }) {
  const { reputation } = useSpecialistReputation(user?.id);

  if (user.role === 'specialist') {
    return (
      <div>
        <h2>Your Reputation</h2>
        <SpecialistReputationCard 
          reputation={reputation}
          showDetails={true}
        />
      </div>
    );
  }
}
```

---

### Step 5: Add Contact Card to ProjectRoom

Update your `ProjectRoom.jsx` to show contact details after bid acceptance:

```javascript
import ContactCard from './components/ContactCard';
import { useContactVisibility, useWorkspaceContact } from './hooks/useContactVisibility';

export function ProjectRoom({ roomId, userId, otherUserId }) {
  const { isContactRevealed, revealContact, loading: contactLoading } = useContactVisibility(
    userId,
    otherUserId,
    roomId
  );

  const { contactInfo, loading: infoLoading } = useWorkspaceContact(
    userId,
    otherUserId,
    'accepted' // workspace status
  );

  return (
    <div>
      {/* ... existing room content ... */}
      
      <ContactCard
        contact={contactInfo}
        isRevealed={isContactRevealed}
        onReveal={revealContact}
        loading={contactLoading || infoLoading}
        compact={false}
      />
    </div>
  );
}
```

---

### Step 6: Trigger Notification Creation (Server-Side - Optional for Phase 1)

For **Phase 2+**, you'll need to create Supabase Functions to automatically trigger notifications when:
- A bid is submitted
- A bid is accepted
- A message is sent
- A dispute is filed

For now, you can test the notification UI manually by inserting test data:

```sql
-- Test notification (run in Supabase SQL Editor)
INSERT INTO notifications (recipient_id, sender_id, type, task_id, title, message, action_url)
VALUES (
  'YOUR_USER_ID', 
  'OTHER_USER_ID',
  'bid_received'::notification_type,
  'TASK_ID',
  'New bid received!',
  'Someone submitted a bid on your job',
  '/task/TASK_ID/room'
);
```

---

## Checklist for Setup

- [ ] **SQL Migrations Run** - All tables created in Supabase
- [ ] **RLS Policies Updated** - Contact visibility policy added
- [ ] **App.js Updated** - useNotifications hook integrated
- [ ] **Navigation Updated** - Passing notification props
- [ ] **Marketplace Updated** - Shows SpecialistReputationCard
- [ ] **ProfileHub Updated** - Shows specialist reputation metrics
- [ ] **ProjectRoom Updated** - Shows ContactCard after acceptance
- [ ] **Test Data Created** - At least one test notification to verify UI

---

## Testing the Implementation

### Test Notification Center
1. Go to app → Click bell icon in navigation
2. Should show "No notifications yet" initially
3. Insert test notification via SQL (see Step 6)
4. Refresh app, should see notification in center
5. Click notification to mark as read
6. Test "Mark all read" and "Clear all" buttons

### Test Specialist Reputation Card
1. Go to Marketplace
2. Should see reputation card under each specialist name
3. If specialist has completed jobs, should show rating + metrics
4. If not, should show "0.0" rating and "No reviews yet"

### Test Contact Card
1. Create a task as client
2. Submit bid as specialist
3. Client accepts bid
4. Both should see ContactCard in ProjectRoom
5. Should show phone/email/WhatsApp options
6. Click to call/email/WhatsApp - should open native apps

---

## What's Missing for Phase 1 to Be Complete

### Notification Triggers (Need Server-Side Code)
The notifications table is created, but you need **Supabase Functions** or **Triggers** to automatically create notifications when:

**When bid submitted:**
```sql
-- Create trigger in Supabase to insert notification into client
-- On bids.INSERT → notifications.INSERT (recipient = task author)
```

**When bid accepted:**
```sql
-- Create trigger to notify specialist
-- On tasks.UPDATE (status = 'accepted') → notifications.INSERT
```

**For Phase 2+:**
- Message notifications
- Work delivery notifications
- Dispute notifications

### Reputation Calculation
The `calculate_specialist_reputation()` function exists, but needs to be called:
- After a task is marked completed
- After a review is submitted

You can call it manually:
```javascript
// In your task completion handler
await supabase.rpc('calculate_specialist_reputation', {
  p_specialist_id: specialistId
});
```

---

## Files Reference

### Frontend Components
- `src/components/NotificationCenter.jsx` - Notification bell + panel
- `src/components/SpecialistReputationCard.jsx` - Reputation display
- `src/components/ContactCard.jsx` - Contact info display
- `src/components/Navigation.jsx` - Updated with notifications

### Hooks
- `src/hooks/useNotifications.js` - Fetch & manage notifications
- `src/hooks/useSpecialistReputation.js` - Fetch specialist & client reputation
- `src/hooks/useContactVisibility.js` - Manage contact reveal logic

### Services
- `src/services/supabaseService.js` - Updated with notification + reputation functions

### Database
- `supabase/phase-1-migrations.sql` - All SQL schema + RLS policies

---

## Next Steps (Phases 2-4)

Once Phase 1 is complete and tested:

**Phase 2 (IMPORTANT):**
1. Acceptance Summary component (#1)
2. Dual completion confirmation (#5)
3. Dispute reason + evidence (#6)

**Phase 3 (ENHANCING):**
1. Milestones checklist (#2)
2. Appointment scheduling (#3)
3. Client reputation card (#8)

**Phase 4 (POLISH):**
1. Receipt PDF export (#10)

---

## Support

If you encounter issues:
1. **Check SQL errors** - Look at Supabase Logs → SQL Editor
2. **Check RLS policies** - Verify all rows are passing auth checks
3. **Check browser console** - Look for JavaScript errors
4. **Test with curl/Postman** - Verify Supabase API responses directly

Good luck with Phase 1! Let me know if you need help with any of the setup steps.
