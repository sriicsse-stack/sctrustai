CREATE OR REPLACE FUNCTION process_referral_signup(p_referrer_id text, p_referred_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral record;
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