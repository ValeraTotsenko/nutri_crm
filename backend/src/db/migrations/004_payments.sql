BEGIN;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  next_payment_date DATE,
  overdue_days_threshold INT NOT NULL DEFAULT 2 CHECK (overdue_days_threshold >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'UAH',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  paid_at DATE NOT NULL,
  method VARCHAR(50),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View для paid_amount (вычисляемое поле)
CREATE OR REPLACE VIEW payments_with_totals AS
SELECT
  p.*,
  COALESCE(SUM(pt.amount), 0) AS paid_amount,
  p.total_amount - COALESCE(SUM(pt.amount), 0) AS remaining_amount,
  CASE
    WHEN COALESCE(SUM(pt.amount), 0) >= p.total_amount THEN true
    ELSE false
  END AS is_paid_in_full
FROM payments p
LEFT JOIN payment_transactions pt ON pt.payment_id = p.id
GROUP BY p.id;

CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_next_payment_date ON payments(next_payment_date)
  WHERE next_payment_date IS NOT NULL;
CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX idx_payment_transactions_paid_at ON payment_transactions(paid_at);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
