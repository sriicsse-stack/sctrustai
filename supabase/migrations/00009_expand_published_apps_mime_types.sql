
-- Expand published-apps bucket to allow all required deployment artifact types.
-- Root cause fix: "text/html; charset=utf-8" was not in the allowlist.
-- Both the bare type AND the charset variant are included for robustness.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'text/html',
    'text/html; charset=utf-8',
    'text/css',
    'text/css; charset=utf-8',
    'text/plain',
    'text/plain; charset=utf-8',
    'text/javascript',
    'text/javascript; charset=utf-8',
    'application/javascript',
    'application/javascript; charset=utf-8',
    'application/json',
    'application/json; charset=utf-8',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    'image/x-icon'
  ],
  file_size_limit = 10485760  -- increase to 10MB for richer apps
WHERE id = 'published-apps';
