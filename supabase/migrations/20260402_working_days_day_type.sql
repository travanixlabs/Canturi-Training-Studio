-- Add day_type column to users_working_days
ALTER TABLE users_working_days ADD COLUMN IF NOT EXISTS day_type TEXT NOT NULL DEFAULT 'Client Day';
