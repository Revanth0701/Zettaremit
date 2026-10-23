-- Preserve transaction_id/status capacity: neither column is modified (50 or 255).
-- REVIEW ONLY. Do not apply to Aiven without explicit owner approval.
-- MySQL 8.4. Take a private backup first. Never upload the customer dump.
-- REQUIRED: tools/migration_preflight.py guarded_apply must pass before this DDL.
-- Do not execute this SQL directly. Rounding/overflow/incompatible states are blocked.
-- Populated legacy data requires independently confirmed USD -> INR provenance.
-- DDL auto-commits: backup/restore is the rollback strategy, not SQL ROLLBACK.
-- Historical Python records are interpreted as USD -> INR (verify this assumption).
-- Local test/legacy data may use inconsistent units. Review them before conversion.
ALTER TABLE transactions
  MODIFY gross_amount DECIMAL(18,2) NOT NULL,
  MODIFY fee_deducted DECIMAL(18,2) NOT NULL,
  MODIFY net_amount DECIMAL(18,2) NOT NULL,
  MODIFY exchange_rate DECIMAL(18,8) NOT NULL,
  CHANGE recipient_amount_inr recipient_amount DECIMAL(18,2) NOT NULL,
  ADD source_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD target_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  ADD idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD request_hash VARCHAR(64) NULL,
  ADD CONSTRAINT uq_transactions_owner_key UNIQUE(sender_id, idempotency_key);
-- New requests explicitly persist INR -> USD. Old rows retain legacy currencies.
-- Existing users/user_verifications/service_transactions are not changed.
