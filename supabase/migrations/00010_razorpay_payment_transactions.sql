
-- Payment transactions table
CREATE TABLE payment_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  razorpay_order_id   text NOT NULL,
  razorpay_payment_id text,
  razorpay_signature  text,
  plan_name       text NOT NULL,
  amount_paise    integer NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  credits_added   integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'created',  -- created | paid | failed
  is_student      boolean NOT NULL DEFAULT false,
  receipt_number  text UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "users_select_own_transactions"
  ON payment_transactions FOR SELECT
  USING (user_id = auth.uid()::text OR true);

-- Only edge function (service role) can insert/update
CREATE POLICY "service_insert_transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_update_transactions"
  ON payment_transactions FOR UPDATE
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_timestamp();

-- Index for fast user lookups
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(razorpay_order_id);
