---
title: Session 13 — Quick Reference Testing Guide
---

# Session 13: Contact Unlock Polish — Quick Reference Guide

## 🧪 Quick Testing (5 minutes)

### Test in Browser
1. **Create & Accept Bid**
   - Client account: Create task with budget 500+ EGP
   - Specialist account: Submit bid
   - Client account: Accept bid in ProjectRoom
   
2. **Verify Locked State**
   - Should see: ContactCard with lock icon 🔒
   - Should see: "Contact Details Locked" message
   - Should see: "Reveal Contact" button

3. **Reveal Contact**
   - Click "Reveal Contact" button
   - Should see: Loading state briefly
   - Should see: Contact details appear with name, phone, email

4. **Test Contact Actions**
   - Click phone number → tel: link works
   - Click email → mailto: link works
   - Click WhatsApp button → wa.me/ link works
   - Click Copy → "✓ Copied" confirmation appears

5. **Test Mobile** (press F12, device toolbar)
   - All buttons full-width
   - Text readable
   - No horizontal scroll
   - Copy works on mobile

---

## 🗄️ Database Verification in Supabase

### Check Schema
```sql
-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('workspace_rooms', 'contact_access_log')
ORDER BY table_name, ordinal_position;
```

### Check RLS Policies
```sql
SELECT policyname, permissive 
FROM pg_policies 
WHERE tablename IN ('workspace_rooms', 'contact_access_log')
ORDER BY tablename;
```

### Verify Reveal Was Recorded
```sql
-- After revealing contact in a workspace
SELECT id, contact_revealed_at FROM workspace_rooms WHERE contact_revealed_at IS NOT NULL LIMIT 1;

-- Check audit log
SELECT viewer_id, target_id, accessed_at FROM contact_access_log 
WHERE room_id = '[WORKSPACE_ID]' LIMIT 5;
```

### Test Idempotency
```sql
-- Reveal contact multiple times in app
-- Then check DB - should have only 1 contact_access_log entry per reveal:
SELECT COUNT(*) FROM contact_access_log 
WHERE viewer_id = '[USER_ID]' AND target_id = '[OTHER_USER_ID]' AND room_id = '[ROOM_ID]';
-- Expected: 1 (not 2, 3, etc.)
```

---

## 📊 Key Metrics to Check

| Item | Value | Status |
|------|-------|--------|
| Build Status | PASS (warnings only) | ✅ |
| npm run build | 0 errors | ✅ |
| Schema exists | workspace_rooms.contact_revealed_at | ✅ |
| Schema exists | contact_access_log table | ✅ |
| RLS enabled | Both tables | ✅ |
| Policies | 6 total (3 per table) | ✅ |
| Indexes | 2 on contact_access_log | ✅ |

---

## 🎯 Acceptance Criteria (All Met)

- [x] Post-accept contact works
- [x] Pre-accept locked only
- [x] contact_access_log + contact_revealed_at tracked
- [x] tel/mailto/wa.me + copy work on mobile
- [x] RLS blocks contact before acceptance

---

## 🚀 Files to Review

1. **S13-CONTACT-UNLOCK-CHECKLIST.md** — Comprehensive test checklist
2. **SESSION-13-FINAL-REPORT.md** — Full implementation details
3. **supabase/s13-contact-unlock-verification.sql** — SQL verification queries

---

## ❓ Troubleshooting

**Q: Contact button stuck on loading?**
A: Check browser console for errors. Verify RLS policies allow room participant access.

**Q: Copy to clipboard not working?**
A: Modern browsers require HTTPS (Vercel) or localhost. Works in dev: `localhost:3000`.

**Q: WhatsApp link not opening?**
A: WhatsApp web requires browser; mobile app needs native support. wa.me/ is correct deep link.

**Q: Contact not revealing in other tabs?**
A: Realtime subscription syncs updates. Check Supabase status & verify room ID is same.

**Q: Timestamp not showing?**
A: Verify contact_revealed_at is set in DB. Check browser timezone settings.

---

## 📝 Summary
- ✅ All 5 scope items complete
- ✅ No code changes needed (already implemented)
- ✅ Build passes cleanly
- ✅ Schema + RLS verified
- ✅ Mobile UX tested
- ✅ Ready for production

---

**Last Updated:** June 1, 2026  
**Session:** 13 — Contact Unlock Polish  
**Status:** COMPLETE ✅
