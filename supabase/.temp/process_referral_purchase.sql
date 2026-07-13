CREATE OR REPLACE FUNCTION process_referral_purchase(p_referred_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral record;
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