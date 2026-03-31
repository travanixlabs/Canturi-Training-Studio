-- Drop the unique constraint on (training_task_id, trainee_id) to allow
-- multiple completions for recurring training tasks.
ALTER TABLE training_task_completions DROP CONSTRAINT IF EXISTS training_task_completions_training_task_id_trainee_id_key;
