CREATE OR REPLACE FUNCTION upsert_profile(p_id text, p_email text, p_name text, p_picture text)
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