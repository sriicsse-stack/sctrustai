
CREATE TABLE IF NOT EXISTS credit_usage_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  app_type    TEXT,
  credit_cost INTEGER NOT NULL,
  size        TEXT DEFAULT 'Medium',
  action      TEXT DEFAULT 'generate',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id  ON credit_usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created  ON credit_usage_history(created_at DESC);

ALTER TABLE credit_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all insert usage" ON credit_usage_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all read usage"   ON credit_usage_history FOR SELECT USING (true);
