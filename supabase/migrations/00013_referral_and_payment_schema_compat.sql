-- Compatibility migration for the production Supabase project.
-- This creates the profile/referral/payment objects expected by the current edge functions
-- even when the remote database already contains an older referral schema.

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  picture text NOT NULL DEFAULT '',
  credits integer NOT NULL DEFAULT 0,
  referral_code text UNIQUE NOT NULL,
  referral_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_all') THEN
    CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_service') THEN
    CREATE POLICY "profiles_insert_service" ON profiles FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_service') THEN
    CREATE POLICY "profiles_update_service" ON profiles FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete_service') THEN
    CREATE POLICY "profiles_delete_service" ON profiles FOR DELETE USING (false);
  END IF;
END $$;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS deploy_rewarded boolean DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS paid_rewarded boolean DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE referrals
SET status = COALESCE(status, 'signed_up'),
    deploy_rewarded = COALESCE(deploy_rewarded, false),
    paid_rewarded = COALESCE(paid_rewarded, false)
WHERE status IS NULL;

UPDATE referrals
SET referrer_id = COALESCE(referrer_id, referrer_user_id)
WHERE referrer_id IS NULL AND referrer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_user_id_idx ON referrals(referred_user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'referrals_select_referrer') THEN
    CREATE POLICY "referrals_select_referrer" ON referrals FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'referrals_insert_service') THEN
    CREATE POLICY "referrals_insert_service" ON referrals FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'referrals_update_service') THEN
    CREATE POLICY "referrals_update_service" ON referrals FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'referrals_delete_service') THEN
    CREATE POLICY "referrals_delete_service" ON referrals FOR DELETE USING (false);
  END IF;
END $$;

ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS credits integer;
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS referral_id uuid;
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE referral_rewards
SET user_id = COALESCE(user_id, referrer_user_id)
WHERE user_id IS NULL AND referrer_user_id IS NOT NULL;

UPDATE referral_rewards
SET credits = COALESCE(credits, amount)
WHERE credits IS NULL AND amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS referral_rewards_user_id_idx ON referral_rewards(user_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_rewards' AND policyname = 'rewards_select_all') THEN
    CREATE POLICY "rewards_select_all" ON referral_rewards FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_rewards' AND policyname = 'rewards_insert_service') THEN
    CREATE POLICY "rewards_insert_service" ON referral_rewards FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_rewards' AND policyname = 'rewards_update_service') THEN
    CREATE POLICY "rewards_update_service" ON referral_rewards FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_rewards' AND policyname = 'rewards_delete_service') THEN
    CREATE POLICY "rewards_delete_service" ON referral_rewards FOR DELETE USING (false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION upsert_profile(
  p_id text,
  p_email text,
  p_name text,
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
  v_code := upper(substring(md5(p_id || clock_timestamp()::text), 1, 8));

  INSERT INTO profiles (id, email, name, picture, credits, referral_code)
  VALUES (p_id, p_email, p_name, p_picture, 0, v_code)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        picture = EXCLUDED.picture,
        updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION process_referral_signup(
  p_referrer_id text,
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
  IF p_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'referrer_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = p_referrer_id AND referred_user_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  INSERT INTO referrals (referrer_id, referred_user_id, status)
  VALUES (p_referrer_id, p_referred_user_id, 'signed_up')
  RETURNING * INTO v_referral;

  UPDATE profiles SET credits = credits + 45, updated_at = now() WHERE id = p_referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (p_referrer_id, 'signup_referrer', 45, v_referral.id);

  UPDATE profiles SET credits = credits + 10, updated_at = now() WHERE id = p_referred_user_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (p_referred_user_id, 'signup_new_user', 10, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referral_id', v_referral.id);
END;
$$;

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
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_referred_user_id
    AND deploy_rewarded = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_eligible_referral');
  END IF;

  UPDATE referrals SET deploy_rewarded = true, status = 'deployed', updated_at = now()
  WHERE id = v_referral.id;

  UPDATE profiles SET credits = credits + 5, updated_at = now() WHERE id = v_referral.referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (v_referral.referrer_id, 'deploy_bonus', 5, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id, 'credits_added', 5);
END;
$$;

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

  UPDATE profiles SET credits = credits + 50, updated_at = now() WHERE id = v_referral.referrer_id;
  INSERT INTO referral_rewards (user_id, reward_type, credits, referral_id)
  VALUES (v_referral.referrer_id, 'paid_bonus', 50, v_referral.id);

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id, 'credits_added', 50);
END;
$$;

CREATE OR REPLACE FUNCTION get_referral_dashboard(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'name', v_profile.name,
      'picture', v_profile.picture,
      'credits', v_profile.credits,
      'referral_code', v_profile.referral_code,
      'referral_link', v_profile.referral_link
    ),
    'referrals', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'referred_user_id', r.referred_user_id,
        'status', r.status,
        'deploy_rewarded', r.deploy_rewarded,
        'paid_rewarded', r.paid_rewarded,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC), '[]'::jsonb)
      FROM referrals r
      WHERE r.referrer_id = p_user_id
    ),
    'stats', jsonb_build_object(
      'total_referrals', (
        SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id
      ),
      'successful_referrals', (
        SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND (status <> 'signed_up' OR deploy_rewarded OR paid_rewarded)
      ),
      'deploy_bonuses', (
        SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND deploy_rewarded
      ),
      'paid_bonuses', (
        SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND paid_rewarded
      ),
      'credits_earned', (
        SELECT COALESCE(SUM(credits), 0) FROM referral_rewards WHERE user_id = p_user_id
      )
    )
  );
END;
$$;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text,
  razorpay_signature text,
  plan_name text NOT NULL,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  credits_added integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created',
  is_student boolean NOT NULL DEFAULT false,
  receipt_number text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'users_select_own_transactions') THEN
    CREATE POLICY "users_select_own_transactions" ON payment_transactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'service_insert_transactions') THEN
    CREATE POLICY "service_insert_transactions" ON payment_transactions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'service_update_transactions') THEN
    CREATE POLICY "service_update_transactions" ON payment_transactions FOR UPDATE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_timestamp();

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(razorpay_order_id);
