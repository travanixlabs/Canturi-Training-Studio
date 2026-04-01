-- Seed working days for Farhana Choudhury
-- Dates: 2-Apr, 4-Apr, 6-Apr, 9-Apr, 10-Apr, 11-Apr, 12-Apr
INSERT INTO users_working_days (user_id, working_date, created_by)
SELECT u.id, d.working_date, u.id
FROM users u
CROSS JOIN (
  VALUES
    ('2026-04-02'::date),
    ('2026-04-04'::date),
    ('2026-04-06'::date),
    ('2026-04-09'::date),
    ('2026-04-10'::date),
    ('2026-04-11'::date),
    ('2026-04-12'::date)
) AS d(working_date)
WHERE u.email = 'farhana.choudhury@canturi.com'
ON CONFLICT (user_id, working_date) DO NOTHING;
