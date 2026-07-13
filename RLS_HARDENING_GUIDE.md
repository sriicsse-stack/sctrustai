# RLS Policy Hardening - Before/After Analysis

## Current Vulnerability (00001_student_verification_system.sql)

### ❌ DANGEROUS Current Policies

```sql
-- Policy 1: SELECT - ANY user can read ANY record
CREATE POLICY "users_select_own" ON student_verifications
  FOR SELECT USING (true);  -- ← true = no restriction

-- Policy 2: INSERT - ANY user can create ANY record
CREATE POLICY "users_insert_own" ON student_verifications
  FOR INSERT WITH CHECK (true);  -- ← true = no restriction

-- Policy 3: ALL - Service role has full access (this part is OK)
CREATE POLICY "service_role_all" ON student_verifications
  FOR ALL USING (true) WITH CHECK (true);
```

### 🔓 Attack Scenarios with Current Policies

**Scenario 1: Read Other Users' Data**
```bash
curl -H "Authorization: Bearer <any_anon_jwt>" \
  https://iggslegczqjfbxsxqhjm.supabase.co/rest/v1/student_verifications \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>"
# ✗ Returns ALL records from ALL users
# ✗ Exposes full names, emails, college info, ID card URLs, etc.
```

**Scenario 2: Modify Someone Else's Status**
```bash
curl -X PATCH \
  https://iggslegczqjfbxsxqhjm.supabase.co/rest/v1/student_verifications?id=eq.<victim_id> \
  -H "Authorization: Bearer <any_anon_jwt>" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -d '{"status":"approved","bonus_credits":1000}' \
# ✗ Allows arbitrary user to approve/reject anyone
# ✗ Allows giving credits to any account
```

**Scenario 3: Approve Your Own Submission (Circumvent Workflow)**
```bash
# User 1 submits verification
# User 1 then calls edge function with own user_id in request body
# Edge function trusts the parameter and approves it
# Then REST API allows User 1 to UPDATE their own status directly
# ✗ User bypasses admin review entirely
```

---

## Fixed Policies (00002_fix_verification_rls.sql)

### ✅ NEW RESTRICTIVE Policies

```sql
-- Policy 1: SELECT - Only users can read THEIR OWN record
CREATE POLICY "users_select_own_record" ON student_verifications
  FOR SELECT
  USING (auth.uid()::text = user_id);
  -- ✅ Checks: Is the auth.uid() equal to the record's user_id?
  -- ✅ Result: User can ONLY see records where user_id = their auth.uid()

-- Policy 2: INSERT - Only authenticated users creating THEIR OWN record
CREATE POLICY "users_insert_own_record" ON student_verifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = user_id
  );
  -- ✅ Checks: Is user authenticated? Does user_id in record = auth.uid()?
  -- ✅ Result: User can ONLY create one record with user_id = their auth.uid()

-- Policy 3: UPDATE - BLOCKED for normal users (no policy = denied)
-- Policy 4: DELETE - BLOCKED for normal users (no policy = denied)
```

---

## Before/After Comparison

### ✅ User: Alice (user_id = "alice123")

| Action | Before | After | Notes |
|--------|--------|-------|-------|
| **SELECT own record** | ✓ Allowed | ✓ Allowed | `auth.uid() = "alice123"` passes check |
| **SELECT Bob's record** | ❌ **ALLOWED** | ✓ Blocked | Cannot read other users' records |
| **SELECT all records** | ❌ **ALLOWED** | ✓ Blocked | Cannot query all records |
| **INSERT own record** | ✓ Allowed | ✓ Allowed | Creates record with `user_id = "alice123"` |
| **INSERT for Bob** | ❌ **ALLOWED** | ✓ Blocked | Cannot create records for others |
| **UPDATE own status** | ✓ Allowed | ✓ Blocked | No UPDATE policy for normal users |
| **UPDATE Bob's status** | ❌ **ALLOWED** | ✓ Blocked | Cannot modify others |
| **DELETE own record** | ✓ Allowed | ✓ Blocked | No DELETE policy for normal users |

### ✅ Service Role: Edge Function (uses SUPABASE_SERVICE_ROLE_KEY)

| Action | Before | After | Notes |
|--------|--------|-------|-------|
| **SELECT all records** | ✓ Allowed | ✓ Allowed | Service role BYPASSES RLS entirely |
| **INSERT new record** | ✓ Allowed | ✓ Allowed | Service role BYPASSES RLS entirely |
| **UPDATE approval** | ✓ Allowed | ✓ Allowed | Service role BYPASSES RLS entirely |
| **DELETE record** | ✓ Allowed | ✓ Allowed | Service role BYPASSES RLS entirely |

---

## Service Role & RLS Behavior

### Key Concept: Service Role Bypasses RLS

```
┌─────────────────────────────────────────────────────┐
│ User Request (with anon key)                        │
│ ✅ Checked against RLS policies                    │
│ ❌ Must have matching policy to succeed            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Edge Function (with service role key)              │
│ ❌ RLS policies are IGNORED                        │
│ ✅ Service role has Postgres superuser access     │
│ ✅ ALL operations succeed regardless of RLS       │
└─────────────────────────────────────────────────────┘
```

### Why the Edge Function Still Works

In `student-verification-admin/index.ts`:
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,  // ← Superuser access
);

// This UPDATE works even though normal users can't:
await supabase
  .from('student_verifications')
  .update({ status: 'approved', ... })
  .eq('id', verificationId);
// ✅ Service role bypasses RLS policies
```

---

## Migration Deployment Instructions

### Given Current Supabase CLI Auth Issue (401 Error)

#### **Option 1: Manual SQL in Supabase Dashboard** (RECOMMENDED)
```
1. Go to: https://app.supabase.com/project/iggslegczqjfbxsxqhjm/sql
2. Click "New Query"
3. Copy the contents of: supabase/migrations/00002_fix_verification_rls.sql
4. Paste into the SQL editor
5. Click "RUN"
6. Verify: Message "Commands executed successfully"
```

**Advantages:**
- ✅ Works without CLI credentials
- ✅ Immediate feedback in dashboard
- ✅ Can verify changes in Table Editor right after

**Steps to verify in dashboard:**
1. Go to "Table Editor" → "student_verifications"
2. Click "RLS" tab
3. Verify 2 policies exist: "users_select_own_record" and "users_insert_own_record"
4. Verify UPDATE and DELETE are blocked (no policies)

---

#### **Option 2: Via Supabase CLI (Once Auth Fixed)**
```bash
# First, refresh your credentials
npx supabase logout
npx supabase login

# Then run migration
npx supabase db push --project-ref iggslegczqjfbxsxqhjm
```

**What happens:**
- CLI detects `00002_fix_verification_rls.sql` hasn't been applied
- Applies the migration remotely
- Returns confirmation or error

---

#### **Option 3: Check Current Auth Status**
```bash
# Test if CLI is working now
npx supabase projects list

# If still getting 401:
# Run: npx supabase logout && npx supabase login
# Then: npx supabase db push
```

---

## Verification After Migration

### ✅ Test SELECT Restriction (Dashboard SQL)
```sql
-- Test 1: This should work (user reading own record)
SELECT * FROM student_verifications 
WHERE user_id = auth.uid()::text;
-- Expected: Returns only records where user_id matches authenticated user

-- Test 2: This should be blocked (trying to read all records)
SELECT * FROM student_verifications;
-- Expected: Zero rows (RLS blocks access to records not owned by user)
```

### ✅ Test Edge Function Still Works
```bash
# From AdminVerificationDashboard calling edge function
curl -X POST \
  https://iggslegczqjfbxsxqhjm.supabase.co/functions/v1/student-verification-admin \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"action":"list"}'
# Expected: Returns all pending verifications (service role bypasses RLS)
```

### ✅ Test Normal User Cannot Update Via REST
```bash
# Attempt to update own record directly (should fail)
curl -X PATCH \
  https://iggslegczqjfbxsxqhjm.supabase.co/rest/v1/student_verifications?id=eq.<some_id> \
  -H "Authorization: Bearer <user_jwt>" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -d '{"status":"approved"}'
# Expected: Error "new row violates row-level security policy"
```

---

## Impact Summary

### 🔒 Security Improvements
| Issue | Before | After |
|-------|--------|-------|
| Unauthorized READ | ❌ Anyone can read ALL records | ✅ Users see only own |
| Unauthorized WRITE | ❌ Anyone can modify ANY record | ✅ Updates blocked for users |
| Bypass Edge Function | ❌ Users could approve own records | ✅ Only edge function can update |
| Admin Authorization | ❌ Not enforced at DB level | ✅ Enforced by RLS + edge function |

### ⚙️ Functional Impact
- ✅ **Edge Function**: Unaffected (service role bypasses RLS)
- ✅ **User Submission**: Still works (INSERT own record)
- ✅ **User View Status**: Still works (SELECT own record)
- ✅ **Admin Approval**: Still works (via edge function only)
- ✅ **API Security**: Dramatically improved

---

## File Locations

- **Old (Vulnerable)**: `supabase/migrations/00001_student_verification_system.sql`
  - Contains old dangerous policies
  - DO NOT edit this file (migrations are immutable)

- **New (Fixed)**: `supabase/migrations/00002_fix_verification_rls.sql`
  - Contains DROP + new restrictive policies
  - Ready to apply immediately

---

## Rollback (If Needed)

If you need to revert the changes (not recommended):
```sql
-- Create a new migration file: 00003_rollback_verification_rls.sql
DROP POLICY IF EXISTS "users_select_own_record" ON student_verifications;
DROP POLICY IF EXISTS "users_insert_own_record" ON student_verifications;

-- Then recreate dangerous policies (NOT RECOMMENDED)
CREATE POLICY "users_select_own" ON student_verifications
  FOR SELECT USING (true);
-- ... etc
```

**Better approach**: Keep the restrictive policies and fix any legitimate features that break.

---

## Key Takeaway

**Before**: Anyone with the public anon key could read/write all student verification records.

**After**: 
- Users can only read/write their own records
- Updates require edge function (service role)
- Edge function still has full access (bypasses RLS)
- Admin authorization enforced at both RLS and application layer
