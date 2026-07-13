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
END $$;
