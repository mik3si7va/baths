CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  specialization TEXT,
  animal_types TEXT[] NOT NULL DEFAULT '{}',
  animal_sizes TEXT[] NOT NULL DEFAULT '{}',
  full_shift BOOLEAN NOT NULL DEFAULT TRUE,
  work_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
