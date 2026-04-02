-- Coaching workflow columns on training_task_completions
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS coaching_status TEXT DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS coaching_not_now_until DATE DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS coaching_reviewed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE training_task_completions ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ DEFAULT NULL;
