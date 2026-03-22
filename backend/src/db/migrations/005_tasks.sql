BEGIN;

CREATE TYPE task_status_enum AS ENUM (
  'pending', 'in_progress', 'done', 'overdue'
);

CREATE TYPE task_priority_enum AS ENUM (
  'low', 'medium', 'high'
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  deadline_date DATE,
  remind_days_before INT NOT NULL DEFAULT 1 CHECK (remind_days_before >= 0 AND remind_days_before <= 14),
  status task_status_enum NOT NULL DEFAULT 'pending',
  priority task_priority_enum NOT NULL DEFAULT 'medium',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_completed_has_date CHECK (
    status != 'done' OR completed_at IS NOT NULL
  )
);

CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_status ON tasks(status) WHERE status NOT IN ('done');
CREATE INDEX idx_tasks_deadline ON tasks(deadline_date, status)
  WHERE deadline_date IS NOT NULL AND status NOT IN ('done');

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
