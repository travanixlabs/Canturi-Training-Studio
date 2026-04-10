ALTER TABLE training_tasks ADD COLUMN IF NOT EXISTS trainee_feedback_required BOOLEAN NOT NULL DEFAULT true;
