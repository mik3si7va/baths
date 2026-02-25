CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO events (title, start_at, end_at)
SELECT
  'Banho Rex',
  '2026-02-27T10:00:00Z'::timestamptz,
  '2026-02-27T11:00:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1
  FROM events
  WHERE title = 'Banho Rex'
    AND start_at = '2026-02-27T10:00:00Z'::timestamptz
    AND end_at = '2026-02-27T11:00:00Z'::timestamptz
);
