
-- Create the published-apps storage bucket for hosting generated app HTML files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'published-apps',
  'published-apps',
  true,
  5242880,  -- 5MB limit
  ARRAY['text/html', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['text/html', 'text/plain', 'application/octet-stream'];

-- Public read: anyone can view published apps
CREATE POLICY "published_apps_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'published-apps');

-- Authenticated service role can insert (edge functions use service role)
CREATE POLICY "published_apps_service_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'published-apps');

-- Service role can update/delete existing apps
CREATE POLICY "published_apps_service_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'published-apps');

CREATE POLICY "published_apps_service_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'published-apps');
