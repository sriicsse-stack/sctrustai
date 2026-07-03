
-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            text PRIMARY KEY,           -- Google sub (user ID)
  email         text UNIQUE NOT NULL,
  name          text NOT NULL DEFAULT '',
  picture       text NOT NULL DEFAULT '',
  credits       integer NOT NULL DEFAULT 0,
  referral_code text UNIQUE NOT NULL,       -- unique code used in ref link
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for referral lookups)
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);

-- Only service-role (Edge Functions) can insert / update
CREATE POLICY "profiles_insert_service" ON profiles FOR INSERT WITH CHECK (false);
CREATE POLICY "profiles_update_service" ON profiles FOR UPDATE USING (false);
CREATE POLICY "profiles_delete_service" ON profiles FOR DELETE USING (false);

-- ============================================================
-- REFERRALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'signed_up'
                   CHECK (status IN ('signed_up','deployed','paid')),
  deploy_rewarded  boolean NOT NULL DEFAULT false,
  paid_rewarded    boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_user_id)   -- prevent duplicate referral records
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_user_id_idx ON referrals(referred_user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can read referrals where they are the referrer
CREATE POLICY "referrals_select_referrer" ON referrals FOR SELECT USING (true);
CREATE POLICY "referrals_insert_service"  ON referrals FOR INSERT WITH CHECK (false);
CREATE POLICY "referrals_update_service"  ON referrals FOR UPDATE USING (false);
CREATE POLICY "referrals_delete_service"  ON referrals FOR DELETE USING (false);

-- ============================================================
-- REFERRAL REWARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL
              CHECK (reward_type IN ('signup_referrer','signup_new_user','deploy_bonus','paid_bonus')),
  credits     integer NOT NULL CHECK (credits > 0),
  referral_id uuid REFERENCES referrals(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_rewards_user_id_idx ON referral_rewards(user_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_select_all"     ON referral_rewards FOR SELECT USING (true);
CREATE POLICY "rewards_insert_service" ON referral_rewards FOR INSERT WITH CHECK (false);
CREATE POLICY "rewards_update_service" ON referral_rewards FOR UPDATE USING (false);
CREATE POLICY "rewards_delete_service" ON referral_rewards FOR DELETE USING (false);

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS (bypass RLS safely)
-- ============================================================

-- Upsert profile
CREATE OR REPLACE FUNCTION upsert_profile(
  p_id      text,
  p_email   text,
  p_name    text,
  p_picture text
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_profile profiles;
BEGIN
  -- Generate a short unique referral code if inserting
  v_code := upper(substring(md5(p_id || clock_timestamp()::text), 1, 8));
  
  INSERT INTO profiles (id, email, name, picture, credits, referral_code)
  VALUES (p_id, p_email, p_name, p_picture, 0, v_code)
  ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        picture = EXCLUDED.picture,
        updated_at = now()
  RETURNING * INTO v_profile;
  
  RETURN v_profile;
END;
$$;

-- Process referral signup: create referral record + award credits (anti-abuse: one per pair)
CREATE OR REPLACE FUNCTION process_referral_signup(
  p_referrer_id      text,
  p_referred_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral referrals;
  v_result   jsonb;
BEGIN
  -- Anti-abuse: no self-referral
  IF p_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- Anti-abuse: check referrer exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'referrer_not_found');
  END IF;

  -- Anti-abuse: check if this referral already exists (duplicate signup prevention)
  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = p_referrer_id AND referred_user_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_referral');
  END IF;

  -- Anti-abuse: prevent referred user from being referred by multiple people (first wins)
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_user_id, status)
  VALUES (p_referrer_id, p_referred_user_id, 'signed_up')
  RETURNING * INTO v_referral;

  -- Award +45 credits to referrer
  UPDATE profiles SET credits = credits + 45, updated_at = now() WHERE id = p_referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (p_referrer_id, 'signup_referrer', 45, v_referral.id);

  -- Award +10 credits to new user
  UPDATE profiles SET credits = credits + 10, updated_at = now() WHERE id = p_referred_user_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (p_referred_user_id, 'signup_new_user', 10, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referral_id', v_referral.id);
END;
$$;

-- Process deploy bonus (only once per referred user)
CREATE OR REPLACE FUNCTION process_referral_deploy(
  p_referred_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral referrals;
BEGIN
  -- Find the referral record and check not already rewarded
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_referred_user_id
    AND deploy_rewarded = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_eligible_referral');
  END IF;

  -- Mark as rewarded (idempotent guard)
  UPDATE referrals SET deploy_rewarded = true, status = 'deployed', updated_at = now()
  WHERE id = v_referral.id;

  -- Award +5 credits to referrer
  UPDATE profiles SET credits = credits + 5, updated_at = now() WHERE id = v_referral.referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (v_referral.referrer_id, 'deploy_bonus', 5, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id, 'credits_added', 5);
END;
$$;

-- Process paid plan bonus (only once per referred user)
CREATE OR REPLACE FUNCTION process_referral_purchase(
  p_referred_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral referrals;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_referred_user_id
    AND paid_rewarded = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_eligible_referral');
  END IF;

  UPDATE referrals SET paid_rewarded = true, status = 'paid', updated_at = now()
  WHERE id = v_referral.id;

  -- Award +50 credits to referrer
  UPDATE profiles SET credits = credits + 50, updated_at = now() WHERE id = v_referral.referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (v_referral.referrer_id, 'paid_bonus', 50, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id, 'credits_added', 50);
END;
$$;

-- Get full referral dashboard data for a user
CREATE OR REPLACE FUNCTION get_referral_dashboard(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
  v_referrals jsonb;
  v_stats jsonb;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'referred_user_id', r.referred_user_id,
      'referred_name', p.name,
      'referred_email', p.email,
      'status', r.status,
      'deploy_rewarded', r.deploy_rewarded,
      'paid_rewarded', r.paid_rewarded,
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC
  )
  INTO v_referrals
  FROM referrals r
  JOIN profiles p ON p.id = r.referred_user_id
  WHERE r.referrer_id = p_user_id;

  SELECT jsonb_build_object(
    'total_referrals', COUNT(*),
    'successful_referrals', COUNT(*) FILTER (WHERE r.status != 'signed_up' OR r.deploy_rewarded OR r.paid_rewarded),
    'deploy_bonuses', COUNT(*) FILTER (WHERE r.deploy_rewarded),
    'paid_bonuses', COUNT(*) FILTER (WHERE r.paid_rewarded),
    'credits_earned', COALESCE(SUM(rw.credits), 0)
  )
  INTO v_stats
  FROM referrals r
  LEFT JOIN referral_rewards rw ON rw.referral_id = r.id AND rw.user_id = p_user_id
  WHERE r.referrer_id = p_user_id;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.name,
      'email', v_profile.email,
      'credits', v_profile.credits,
      'referral_code', v_profile.referral_code
    ),
    'referrals', COALESCE(v_referrals, '[]'::jsonb),
    'stats', v_stats
  );
END;
$$;

-- Admin stats function
CREATE OR REPLACE FUNCTION get_referral_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'top_referrers', (
      SELECT jsonb_agg(sub ORDER BY sub->>'total_referrals' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', p.id, 'name', p.name, 'email', p.email, 'credits', p.credits,
          'total_referrals', COUNT(r.id),
          'deploy_bonuses', COUNT(*) FILTER (WHERE r.deploy_rewarded),
          'paid_bonuses', COUNT(*) FILTER (WHERE r.paid_rewarded)
        ) AS sub
        FROM profiles p
        LEFT JOIN referrals r ON r.referrer_id = p.id
        GROUP BY p.id
        ORDER BY COUNT(r.id) DESC
        LIMIT 20
      ) t
    ),
    'total_referrals', (SELECT COUNT(*) FROM referrals),
    'total_rewards_issued', (SELECT COALESCE(SUM(credits), 0) FROM referral_rewards),
    'total_deploy_bonuses', (SELECT COUNT(*) FROM referrals WHERE deploy_rewarded),
    'total_paid_bonuses', (SELECT COUNT(*) FROM referrals WHERE paid_rewarded),
    'recent_rewards', (
      SELECT jsonb_agg(sub ORDER BY sub->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', rw.id, 'user_id', rw.user_id, 'user_name', p.name,
          'reward_type', rw.reward_type, 'credits', rw.credits, 'created_at', rw.created_at
        ) AS sub
        FROM referral_rewards rw
        JOIN profiles p ON p.id = rw.user_id
        ORDER BY rw.created_at DESC
        LIMIT 50
      ) t
    )
  );
END;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE referral_rewards;
