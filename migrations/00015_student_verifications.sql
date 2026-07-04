-- Student verifications table
CREATE TABLE IF NOT EXISTS student_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  full_name text NOT NULL,
  mobile_number text,
  college_name text,
  course text,
  year text,
  registered_email text,
  id_front_url text,
  id_back_url text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);

CREATE INDEX IF NOT EXISTS idx_student_verifications_status ON student_verifications(status);
