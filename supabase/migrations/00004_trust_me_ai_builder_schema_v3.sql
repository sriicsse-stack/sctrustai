
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  credits INTEGER DEFAULT 85,
  app_creations_count INTEGER DEFAULT 0,
  deployments_count INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'Free',
  referral_code TEXT UNIQUE,
  referral_count INTEGER DEFAULT 0,
  total_referral_credits INTEGER DEFAULT 0,
  student_status TEXT DEFAULT NULL,
  student_discount_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  analysis JSONB,
  files JSONB DEFAULT '[]'::jsonb,
  preview_html TEXT,
  preview_html_size TEXT DEFAULT 'Medium',
  auto_diagnostic_report JSONB,
  is_published BOOLEAN DEFAULT FALSE,
  published_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'vercel',
  url TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace apps
CREATE TABLE IF NOT EXISTS marketplace_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  thumbnail_url TEXT,
  prompt TEXT,
  preview_html TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App views tracking
CREATE TABLE IF NOT EXISTS app_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  viewer_id TEXT,
  viewer_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App likes
CREATE TABLE IF NOT EXISTS app_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID REFERENCES marketplace_apps(id) ON DELETE CASCADE,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(app_id, user_id)
);

-- Student verifications
CREATE TABLE IF NOT EXISTS student_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  college_name TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  student_id TEXT NOT NULL,
  college_email TEXT NOT NULL,
  mobile_number TEXT,
  id_card_front_url TEXT,
  id_card_back_url TEXT,
  supporting_doc_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bonus_credits INTEGER DEFAULT 0,
  discount_percentage INTEGER DEFAULT 50
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'signed_up',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- Referral rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  credits INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket for student verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-verification', 'student-verification', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Enable on all tables but allow all operations (app handles auth via Google)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles all" ON profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects all" ON projects FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deployments all" ON deployments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE marketplace_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketplace all" ON marketplace_apps FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE app_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App views all" ON app_views FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE app_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App likes all" ON app_likes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student ver all" ON student_verifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrals all" ON referrals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rewards all" ON referral_rewards FOR ALL USING (true) WITH CHECK (true);

-- Storage policy
CREATE POLICY "Storage all" ON storage.objects FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE profiles, projects, marketplace_apps;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_user_id ON marketplace_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_featured ON marketplace_apps(is_featured);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_trending ON marketplace_apps(is_trending);
CREATE INDEX IF NOT EXISTS idx_app_views_app_id ON app_views(app_id);
CREATE INDEX IF NOT EXISTS idx_app_likes_app_id ON app_likes(app_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_student_verifications_user ON student_verifications(user_id);
