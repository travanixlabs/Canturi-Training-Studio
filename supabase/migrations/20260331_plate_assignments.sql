-- Training task assignments: managers assign training tasks to trainees on specific dates
CREATE TABLE IF NOT EXISTS training_task_assigned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_task_id UUID NOT NULL REFERENCES training_tasks(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, training_task_id, assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_training_task_assigned_trainee ON training_task_assigned(trainee_id);
CREATE INDEX IF NOT EXISTS idx_training_task_assigned_trainee_date ON training_task_assigned(trainee_id, assigned_date);
