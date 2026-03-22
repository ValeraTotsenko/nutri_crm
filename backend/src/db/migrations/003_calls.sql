BEGIN;

CREATE TYPE call_type_enum AS ENUM (
  'intro', 'monthly', 'extra', 'free_diagnostic'
);

CREATE TYPE call_status_enum AS ENUM (
  'scheduled', 'done', 'cancelled', 'no_show'
);

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  call_type call_type_enum NOT NULL,
  duration_min INT,
  platform VARCHAR(50),
  status call_status_enum NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calls_must_have_client_or_lead CHECK (
    client_id IS NOT NULL OR lead_id IS NOT NULL
  ),
  CONSTRAINT calls_free_diagnostic_requires_lead CHECK (
    call_type != 'free_diagnostic' OR lead_id IS NOT NULL
  )
);

CREATE INDEX idx_calls_client_id ON calls(client_id);
CREATE INDEX idx_calls_lead_id ON calls(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_calls_scheduled_at ON calls(scheduled_at);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_tomorrow ON calls(scheduled_at, status)
  WHERE status = 'scheduled';

-- Добавляем FK в leads для diagnostic_call_id
ALTER TABLE leads ADD CONSTRAINT fk_leads_diagnostic_call
  FOREIGN KEY (diagnostic_call_id) REFERENCES calls(id) ON DELETE SET NULL;

COMMIT;
