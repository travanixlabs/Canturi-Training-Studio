-- Users working days: managers advise which days trainees are scheduled to work
CREATE TABLE IF NOT EXISTS users_working_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  working_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  UNIQUE (user_id, working_date)
);

CREATE INDEX IF NOT EXISTS idx_users_working_days_user ON users_working_days(user_id);
CREATE INDEX IF NOT EXISTS idx_users_working_days_user_date ON users_working_days(user_id, working_date);
