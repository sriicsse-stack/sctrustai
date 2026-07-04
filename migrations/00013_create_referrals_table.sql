-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  referral_link text NOT NULL,
  referrer_user_id text,
  total_referrals integer NOT NULL DEFAULT 0,
  successful_referrals integer NOT NULL DEFAULT 0,
  earned_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index on referral_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
