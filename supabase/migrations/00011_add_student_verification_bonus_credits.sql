-- Add missing bonus_credits and discount_percentage columns to student_verifications
ALTER TABLE student_verifications
  ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 50;
