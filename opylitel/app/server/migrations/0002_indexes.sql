CREATE INDEX IF NOT EXISTS audit_by_created ON audit(created);
CREATE INDEX IF NOT EXISTS rate_by_expiry ON rate_limits(expires);
