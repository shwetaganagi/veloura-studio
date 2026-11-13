-- Customer verification, password reset, and database-backed auth throttling.
-- Apply in the target environment only after reviewing existing customer email duplicates.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS auth_session_version INTEGER NOT NULL DEFAULT 0
  CHECK (auth_session_version >= 0);

-- Preserve an equivalent existing index; create it only if this target lacks one.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'customers'
      AND indexdef ILIKE '%UNIQUE%lower%email%'
  ) THEN
    CREATE UNIQUE INDEX customers_email_lower_unique_idx
      ON customers (LOWER(email));
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS customer_auth_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_auth_tokens_customer_purpose_idx
  ON customer_auth_tokens (customer_id, purpose, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_auth_tokens_one_active_idx
  ON customer_auth_tokens (customer_id, purpose)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep the rate-limit table bounded; schedule this statement daily or invoke it from
-- the existing maintenance process once rows are older than two days.
-- DELETE FROM customer_auth_rate_limits WHERE window_started_at < NOW() - INTERVAL '2 days';
