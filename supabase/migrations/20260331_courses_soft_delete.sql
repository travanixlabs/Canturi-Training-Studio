-- Add soft-delete support to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
