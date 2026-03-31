-- Manager sign-off fields on training_task_completions
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS manager_notes TEXT DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS manager_coaching TEXT DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS manager_rating INTEGER DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS signed_off_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS signed_off_by UUID DEFAULT NULL REFERENCES users(id);
