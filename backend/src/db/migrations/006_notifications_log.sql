BEGIN;

CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_type VARCHAR(50),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_text TEXT,
  tg_message_id BIGINT
);

CREATE INDEX idx_notifications_log_type_entity ON notifications_log(type, entity_id);
CREATE INDEX idx_notifications_log_sent_at ON notifications_log(sent_at);
-- Индекс для быстрой проверки дедупликации (отправляли ли сегодня)
CREATE INDEX idx_notifications_log_today ON notifications_log(type, entity_id, sent_at)
  WHERE sent_at >= CURRENT_DATE;

COMMIT;
