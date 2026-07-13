CREATE OR REPLACE FUNCTION process_referral_deploy(p_referred_user_id text)
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