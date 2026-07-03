
-- Project files table for granular file storage
CREATE TABLE IF NOT EXISTS project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT,
  language TEXT,
  size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project versions table for rollback history
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  description TEXT,
  files JSONB,
  preview_html TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for project_files
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own project files" ON project_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()::text)
);
CREATE POLICY "Users can insert their own project files" ON project_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()::text)
);
CREATE POLICY "Users can update their own project files" ON project_files FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()::text)
);
CREATE POLICY "Users can delete their own project files" ON project_files FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()::text)
);

-- RLS for project_versions
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own project versions" ON project_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()::text)
);
CREATE POLICY "Users can insert their own project versions" ON project_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()::text)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);
