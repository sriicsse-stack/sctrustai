
-- Add the correctly-named bucket (students-verification)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'students-verification',
  'students-verification',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_students_docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'students-verification');

CREATE POLICY "anyone_upload_students_docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'students-verification');

CREATE POLICY "anyone_update_students_docs" ON storage.objects
  FOR UPDATE USING (bucket_id = 'students-verification');
