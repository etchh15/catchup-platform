import React, { useEffect, useState, useOptimistic, useCallback } from 'react';
import { useToast } from './Toast';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../services/supabaseService';

export default function NotificationPreferences({ userId }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchNotificationPreferences(userId)
      .then(data => setPrefs(data))
      .catch(err => {
        console.error('Failed to load notification preferences', err);
        toast('Failed to load notification preferences', 'error');
      });
  }, [userId, toast]);

  // Optimistic state: UI updates instantly, mutation happens in background
  const [optimisticPrefs, updateOptimisticPrefs] = useOptimistic(prefs, (state, toggleKey) => ({
    ...state,
    [toggleKey]: !state[toggleKey],
  }));

  const handleToggle = useCallback(
    async (key) => {
      if (!prefs) return;
      setSaving(true);

      // 1. Update UI immediately (optimistic)
      updateOptimisticPrefs(key);

      try {
        // 2. Mutation happens in background
        await updateNotificationPreferences(userId, { 
          [key]: !prefs[key], 
          updated_at: new Date().toISOString() 
        });
        toast('Preferences saved', 'success');
        
        // 3. Sync local state after mutation succeeds
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
      } catch (err) {
        console.error('Failed to save preferences', err);
        toast('Failed to save preferences', 'error');
        // Rollback happens automatically (optimisticPrefs falls back to prefs)
      } finally {
        setSaving(false);
      }
    },
    [userId, prefs, updateOptimisticPrefs, toast]
  );

  if (!optimisticPrefs) {
    return <div style={{ padding: 12, color: 'var(--text-3)' }}>Loading preferences…</div>;
  }

  const rows = [
    { key: 'bid_received', label: 'New proposals' },
    { key: 'bid_accepted', label: 'Proposal accepted' },
    { key: 'message_received', label: 'Messages' },
    { key: 'task_completed', label: 'Task completed' },
    { key: 'dispute_filed', label: 'Dispute filed' },
  ];

  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: '1px solid #334155', background: 'var(--bg-soft)' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#cbd5e1' }}>Notification Preferences</h4>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#cbd5e1' }}>{r.label}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#94a3b8' }}>In-app</label>
              <input
                type="checkbox"
                checked={!!optimisticPrefs[`${r.key}_in_app`]}
                onChange={() => handleToggle(`${r.key}_in_app`)}
                disabled={saving}
              />
              <label style={{ fontSize: 12, color: '#94a3b8' }}>Email</label>
              <input
                type="checkbox"
                checked={!!optimisticPrefs[`${r.key}_email`]}
                onChange={() => handleToggle(`${r.key}_email`)}
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
        {saving ? '⏳ Saving…' : '✓ Changes are saved immediately.'}
      </div>
    </div>
  );
}
