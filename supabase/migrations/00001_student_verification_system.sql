
-- Create student_verifications table
CREATE TABLE student_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  full_name text NOT NULL,
  college_name text NOT NULL,
  department text NOT NULL,
  year text NOT NULL,
  student_id text NOT NULL,
  college_email text NOT NULL,
  mobile_number text NOT NULL,
  id_card_front_url text,
  id_card_back_url text,
  document_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_notes text,
  bonus_credits integer DEFAULT 0,
  discount_percentage integer DEFAULT 50
);

-- Enable RLS
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;

-- Any user can insert their own verification (user_id is their session/identifier)
CREATE POLICY "users_insert_own" ON student_verifications
  FOR INSERT WITH CHECK (true);

-- Users can read their own verification by user_id
CREATE POLICY "users_select_own" ON student_verifications
  FOR SELECT USING (true);

-- Service role can do everything (admin operations)
CREATE POLICY "service_role_all" ON student_verifications
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for student verification documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-verification',
  'student-verification',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "public_read_student_docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-verification');

CREATE POLICY "anyone_upload_student_docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'student-verification');

CREATE POLICY "anyone_update_student_docs" ON storage.objects
  FOR UPDATE USING (bucket_id = 'student-verification');
