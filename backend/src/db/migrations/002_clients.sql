BEGIN;

CREATE TYPE work_type_enum AS ENUM (
  'individual',
  'family',
  'pregnancy_planning',
  'pregnancy_support',
  'express',
  'scheme_3m'
);

CREATE TYPE client_status_enum AS ENUM (
  'active', 'paused', 'completed', 'extended'
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  phone VARCHAR(20),
  telegram_username VARCHAR(50),
  work_type work_type_enum NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status client_status_enum NOT NULL DEFAULT 'active',
  contraindications TEXT,
  notes TEXT,
  source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status) WHERE archived_at IS NULL;
CREATE INDEX idx_clients_birth_date ON clients(birth_date) WHERE birth_date IS NOT NULL;
CREATE INDEX idx_clients_work_type ON clients(work_type);
CREATE INDEX idx_clients_end_date ON clients(end_date) WHERE end_date IS NOT NULL AND archived_at IS NULL;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Добавляем FK к leads после создания clients (circular dependency)
ALTER TABLE leads ADD CONSTRAINT fk_leads_referred_by
  FOREIGN KEY (referred_by_client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE leads ADD CONSTRAINT fk_leads_converted_to
  FOREIGN KEY (converted_to_client_id) REFERENCES clients(id) ON DELETE SET NULL;

COMMIT;
