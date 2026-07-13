-- Fix overly permissive RLS policies on student_verifications table
-- Previously: any user could read/write ANY record
-- Now: users can only access their own records; updates blocked for normal users

-- Drop the dangerous policies
DROP POLICY IF EXISTS "users_insert_own" ON student_verifications;
DROP POLICY IF EXISTS "users_select_own" ON student_verifications;
DROP POLICY IF EXISTS "service_role_all" ON student_verifications;

-- ============================================================================
-- NEW RESTRICTIVE POLICIES
-- ============================================================================

-- POLICY 1: SELECT - Users can only read their own verification record
CREATE POLICY "users_select_own_record" ON student_verifications
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- POLICY 2: INSERT - Users can only create a verification record for themselves
--           (authenticated users only, and only setting their own user_id)
CREATE POLICY "users_insert_own_record" ON student_verifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = user_id
  );

-- POLICY 3: UPDATE - EXPLICITLY BLOCKED for normal users
--           Service role (via edge functions) bypasses RLS entirely,
--           so no policy needed for admin updates. If a normal user tries
--           to update, they will get a permission denied error.
--           (No UPDATE policy = no one can update except service role)

-- POLICY 4: DELETE - EXPLICITLY BLOCKED for normal users
--           (No DELETE policy = no one can delete except service role)

-- ============================================================================
-- NOTES ON SERVICE ROLE ACCESS
-- ============================================================================
-- The student-verification-admin edge function uses SUPABASE_SERVICE_ROLE_KEY,
-- which provides Postgres superuser privileges and BYPASSES RLS entirely.
-- Therefore:
-- ✅ Service role CAN: SELECT, INSERT, UPDATE, DELETE (bypasses RLS)
-- ❌ Normal users CANNOT: UPDATE, DELETE (no policies allow these actions)
-- ✅ Normal users CAN: SELECT their own record, INSERT their own record
--
-- This means the edge function will work unaffected, while normal users
-- cannot abuse the REST API to read/modify other users' records.
