DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_marketplace_apps_user_id_profiles'
      AND table_name = 'marketplace_apps'
  ) THEN
    ALTER TABLE public.marketplace_apps
      ADD CONSTRAINT fk_marketplace_apps_user_id_profiles
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  -- Ignore errors (migration safe to run multiple times)
  RAISE NOTICE 'Constraint add skipped or failed: %', SQLERRM;
END$$;
