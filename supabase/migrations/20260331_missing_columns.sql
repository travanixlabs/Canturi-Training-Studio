-- ============================================================
-- Missing columns migration
-- Adds all columns the application code expects but that
-- were created via the Supabase dashboard (no migration file).
-- All statements use IF NOT EXISTS / IF NOT FOUND so this is
-- safe to run even if columns already exist.
-- ============================================================

-- ------------------------------------------------------------
-- training_tasks: 11 new columns
-- ------------------------------------------------------------
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS trainer_type TEXT DEFAULT '';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS modality TEXT DEFAULT '';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS role_level TEXT DEFAULT '';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT '';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS prerequisites TEXT[] DEFAULT '{}';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS recurring_count INTEGER DEFAULT NULL;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS certificate_required BOOLEAN DEFAULT FALSE;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS rewards_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS confidence_rating_required BOOLEAN DEFAULT FALSE;
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ------------------------------------------------------------
-- training_task_completions: 3 new columns
-- ------------------------------------------------------------
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS confidence_rating INTEGER DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS certificate_reference TEXT DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- ------------------------------------------------------------
-- Soft-delete columns for remaining tables
-- (courses.deleted_at already handled in 20260331_courses_soft_delete.sql)
-- ------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE training_task_content ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
