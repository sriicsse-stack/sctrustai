
-- Create storage bucket for AI workspace image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-uploads',
  'ai-uploads',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "ai_uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ai-uploads');

-- Allow authenticated + anon upload
CREATE POLICY "ai_uploads_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ai-uploads');

-- Allow delete by owner
CREATE POLICY "ai_uploads_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'ai-uploads');
