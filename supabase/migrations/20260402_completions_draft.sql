-- Draft completions: saves in-progress answers before submission
CREATE TABLE IF NOT EXISTS training_task_completions_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_task_id UUID NOT NULL REFERENCES training_tasks(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  takeaways TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  confidence_rating INTEGER DEFAULT NULL,
  certificate_reference TEXT DEFAULT NULL,
  certificate_url TEXT DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_task_id, trainee_id)
);
