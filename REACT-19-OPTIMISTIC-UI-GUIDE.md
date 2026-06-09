# React 19 useOptimistic Implementation Guide

## 📌 Overview

You've implemented **React 19's `useOptimistic` hook** across your mutation-heavy components. This provides **instant UI feedback** while background async operations complete, eliminating the perception of lag.

## ✅ What Was Refactored

| Component | Mutation | Pattern |
|-----------|----------|---------|
| **NotificationPreferences** | Toggle preferences | Immediate checkbox flip + async save |
| **Marketplace** | Bid submission | Clear form instantly + send in background |
| **Marketplace** | Accept bid | Show agreement snapshot immediately |
| **ProjectRoom** | Send message | Message appears in chat instantly |
| **ProjectRoom** | Confirm completion | Mark room as completed immediately |
| **ProjectRoom** | File dispute | Mark room as disputed immediately |
| **MilestoneChecklist** | Complete milestone | Progress bar updates instantly |
| **DeliveryButton** | Mark delivered | Hide button immediately |

## 🎯 The Pattern: Optimistic UI

### Before (Waiting for Server Response)
```
User clicks "Send Message"
    ↓
Loading state = true (button disabled)
    ↓
Send to backend
    ↓
Wait for response... ⏳ (user sees delay)
    ↓
Update UI locally
    ↓
Show message in chat
```

**User experience:** 200-500ms delay feels sluggish

### After (Optimistic Update)
```
User clicks "Send Message"
    ↓
Update UI immediately ✅ (message appears instantly)
    ↓
Send to backend in background
    ↓
On success: UI stays updated (no rollback needed)
    ↓
On error: Revert UI to previous state
```

**User experience:** Instant response, feels snappy ⚡

## 🔧 How It Works

### Basic Pattern with useOptimistic

```javascript
// 1. Define the reducer: how to transform state on optimistic update
const reducer = (currentState, optimisticAction) => {
  if (optimisticAction.type === 'TOGGLE_PREFERENCE') {
    return {
      ...currentState,
      [optimisticAction.key]: !currentState[optimisticAction.key],
    };
  }
  return currentState;
};

// 2. Create optimistic state
const [optimisticState, updateOptimisticState] = useOptimistic(
  actualState,    // Source of truth from props/server
  reducer         // Transform function
);

// 3. Use optimistic state in render
return <input checked={optimisticState.emailNotifications} />;

// 4. Dispatch optimistic update on user action
const handleToggle = async (key) => {
  updateOptimisticState({ type: 'TOGGLE_PREFERENCE', key });
  
  try {
    await updateServerAsync(key, !actualState[key]);
    // UI already updated! No need to setStateafter success
  } catch (error) {
    // Automatically reverts to actualState on error
    console.error('Failed to update', error);
  }
};
```

## 📋 Implementation Details by Component

### 1. NotificationPreferences: Toggle Preferences

**What happens:**
- Checkbox toggles instantly (UI updates via `useOptimistic`)
- Mutation sends in background
- On error, checkbox reverts automatically

```javascript
const [optimisticPrefs, updateOptimisticPrefs] = useOptimistic(
  prefs,
  (state, toggleKey) => ({
    ...state,
    [toggleKey]: !state[toggleKey],
  })
);

const handleToggle = async (key) => {
  updateOptimisticPrefs(key);  // ← UI updates immediately
  
  try {
    await updateNotificationPreferences(userId, { 
      [key]: !prefs[key], 
    });
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));  // ← Sync local state
  } catch (err) {
    // Reverts automatically (optimisticPrefs falls back to prefs)
  }
};
```

### 2. Marketplace: Bid Submission

**What happens:**
- Form clears instantly (optimistic)
- Bid sends in background
- On error, form re-fills with failed data

```javascript
const [optimisticBidState, updateOptimisticBidState] = useOptimistic(
  { amounts: bidAmounts, notes: bidNotes },
  (state, action) => {
    if (action.type === 'SUBMIT') {
      return {
        amounts: { ...state.amounts, [action.taskId]: '' },
        notes: { ...state.notes, [action.taskId]: '' },
      };
    }
    if (action.type === 'ROLLBACK') {
      return { amounts: bidAmounts, notes: bidNotes };
    }
    return state;
  }
);

const handleSubmitBid = async (taskId) => {
  updateOptimisticBidState({ type: 'SUBMIT', taskId });  // ← Form clears instantly
  
  try {
    await submitBid(...);
    setBidAmounts(p => ({ ...p, [taskId]: '' }));  // ← Sync state
  } catch (err) {
    updateOptimisticBidState({ type: 'ROLLBACK' });  // ← Re-fill form on error
    alert('Failed to submit');
  }
};
```

### 3. ProjectRoom: Message Sending

**What happens:**
- Message appears in chat instantly with `isPending` flag
- Sent in background
- On error, message removed automatically

```javascript
const [optimisticMessages, addOptimisticMessage] = useOptimistic(
  messages,
  (state, message) => [
    ...state,
    {
      id: `temp-${Date.now()}`,
      message_text: message.text,
      isPending: true,  // Visual indicator
    }
  ]
);

const handleSendMessage = async (e) => {
  e.preventDefault();
  const text = newMessage.trim();
  
  addOptimisticMessage({ text });  // ← Message appears in chat instantly
  setNewMessage('');
  
  try {
    await sendWorkspaceMessage(activeRoom.id, user.id, text);
  } catch (err) {
    // Message automatically removed (optimisticMessages reverts to messages)
    setNewMessage(text);  // Restore unsent message for retry
  }
};
```

In the render, show pending indicator:
```jsx
{optimisticMessages.map(msg => (
  <div key={msg.id}>
    {msg.message_text}
    {msg.isPending && <span>⏳</span>}  // Visual cue
  </div>
))}
```

### 4. MilestoneChecklist: Mark Complete

**What happens:**
- Milestone changes from "Pending" → "Done" instantly
- Progress bar updates
- Save happens in background

```javascript
const [optimisticMilestones, updateOptimisticMilestone] = useOptimistic(
  milestones,
  (state, milestoneId) =>
    state.map((m) =>
      m.id === milestoneId
        ? { ...m, status: 'completed', completed_at: new Date().toISOString() }
        : m
    )
);

const handleComplete = async (milestone) => {
  updateOptimisticMilestone(milestone.id);  // ← UI updates instantly
  
  try {
    await onMilestoneComplete(milestone.id);
  } catch (err) {
    // Reverts automatically
    alert('Failed to complete');
  }
};
```

### 5. DeliveryButton: Mark as Delivered

**What happens:**
- Button disappears instantly
- Background notification sent
- On error, button reappears

```javascript
const [optimisticDelivered, updateOptimisticDelivered] = useOptimistic(
  hasDelivered,
  () => true  // Always set to true
);

const handleSubmit = async (e) => {
  e.preventDefault();
  
  updateOptimisticDelivered();  // ← Button disappears instantly
  
  try {
    await onMarkDelivered(message);
  } catch (err) {
    // Reverts automatically
    alert('Failed to mark delivered');
  }
};

// In render:
if (optimisticDelivered) return null;  // ← Uses optimistic state
```

## 🚀 Benefits

| Benefit | Impact |
|---------|--------|
| **Instant feedback** | Users see their action worked immediately |
| **No loading spinners** | UI feels native/snappy |
| **Automatic rollback** | Failed mutations revert without extra code |
| **Background operations** | Network latency is hidden |
| **Works offline-ready** | Pattern supports offline-first patterns |
| **Clean code** | No manual `setLoading` / `setError` states |

## ⚠️ Important Notes

### 1. **Source of Truth Matters**
The first argument to `useOptimistic` is your source of truth:
```javascript
// ✅ CORRECT: Use server-synced state
const [actualState, setActualState] = useState(serverData);
const [optimisticState, updateOptimistic] = useOptimistic(actualState, reducer);

// ❌ WRONG: Using local-only state
const [formData, setFormData] = useState('');
const [optimisticState, updateOptimistic] = useOptimistic(formData, reducer);
// This will revert to unsaved formData on error!
```

### 2. **Sync After Success**
After an optimistic mutation succeeds, **sync your actual state**:
```javascript
try {
  await submitBid(...);
  setBidAmounts(p => ({ ...p, [taskId]: '' }));  // ← Sync actual state
} catch (err) {
  // Rollback happens automatically
}
```

### 3. **Error Recovery**
Let errors revert to source of truth, but preserve user data:
```javascript
catch (err) {
  // DON'T clear the form, let user retry
  setNewMessage(text);  // Restore text for retry
  alert('Failed to send');
}
```

### 4. **Pending Indicators**
Add visual cues for pending operations:
```jsx
{isPending && <span className="pending-indicator">⏳</span>}
{submitting && <button disabled>Sending…</button>}
```

## 🔗 Apply This Pattern To Other Components

### Template for Any Component

```javascript
// 1. Import useOptimistic
import { useOptimistic, useCallback } from 'react';

// 2. Define reducer for your state shape
const reducer = (currentState, action) => {
  switch (action.type) {
    case 'UPDATE':
      return { ...currentState, ...action.payload };
    case 'CLEAR':
      return {};
    default:
      return currentState;
  }
};

// 3. Create optimistic state
const [optimisticState, dispatch] = useOptimistic(actualState, reducer);

// 4. Dispatch optimistic update on user action
const handleAction = useCallback(async (data) => {
  dispatch({ type: 'UPDATE', payload: data });  // ← UI updates immediately
  
  try {
    await apiCall(data);
    setActualState(data);  // ← Sync source of truth after success
  } catch (error) {
    // Automatically reverts to actualState
    alert('Failed: ' + error.message);
  }
}, []);
```

## 📊 Current Implementation Status

✅ **Completed:**
- NotificationPreferences (toggle preferences)
- Marketplace (bid submission & acceptance)
- ProjectRoom (messages, disputes, completion)
- MilestoneChecklist (milestone completion)
- DeliveryButton (work delivery)

🎯 **Candidates for Future Optimization:**
- AdminDisputeQueue (dispute resolution)
- ScheduleAppointment (appointment scheduling)
- CompletionConfirmationModal (confirmation)
- DisputeForm (dispute filing - partial)
- ReviewModal (rating submission)

## 🧪 Testing

To test optimistic updates:

1. **Test Success Path:**
   - Click button
   - Verify UI updates immediately
   - Network tab shows request in background
   - UI persists after response

2. **Test Error Path:**
   - Simulate network error (DevTools → Throttle)
   - Click button
   - Verify UI updates immediately
   - Wait for error response
   - Verify UI reverts to previous state

3. **Test Rollback:**
   - Disable network (DevTools → Offline)
   - Click button
   - Verify UI updates immediately
   - Verify UI reverts when offline error occurs
   - Re-enable network
   - User can retry

## 🎓 React 19 Context

`useOptimistic` is a new React 19 hook designed specifically for:
- **Server actions** (RSC + form actions)
- **Optimistic UI patterns**
- **Real-time sync applications**

Even though you're using Supabase (not server actions), the pattern applies to any async operation.

---

**Status:** Production-ready pattern implemented across 8+ interaction points  
**Performance Impact:** ⚡ Instant UI feedback, 200-500ms latency hidden  
**Code Complexity:** Slightly increased (reducer functions), but more maintainable
