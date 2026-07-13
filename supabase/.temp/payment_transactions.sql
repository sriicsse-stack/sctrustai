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