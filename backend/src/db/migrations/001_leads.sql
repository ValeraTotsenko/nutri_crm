BEGIN;

CREATE TYPE lead_status_enum AS ENUM (
  'new', 'warm', 'negotiations', 'refused', 'club_member'
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name VARCHAR(100),
  first_name VARCHAR(100) NOT NULL,
  telegram_username VARCHAR(50),
  phone VARCHAR(20),
  status lead_status_enum NOT NULL DEFAULT 'new',
  interest TEXT,
  source VARCHAR(100),
  referred_by_client_id UUID,
  last_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remind_after_days INT NOT NULL DEFAULT 7,
  had_free_diagnostic BOOLEAN NOT NULL DEFAULT false,
  diagnostic_call_id UUID,
  converted_to_client_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_last_contact_at ON leads(last_contact_at);
CREATE INDEX idx_leads_converted ON leads(converted_to_client_id) WHERE converted_to_client_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
