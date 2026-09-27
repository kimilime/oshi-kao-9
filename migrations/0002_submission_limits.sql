CREATE TABLE submission_limits (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, ip_hash TEXT NOT NULL, day TEXT NOT NULL, submitted_at INTEGER NOT NULL);
CREATE INDEX submission_limits_visitor ON submission_limits(visitor, submitted_at);
CREATE INDEX submission_limits_ip_day ON submission_limits(ip_hash, day);
CREATE INDEX submission_limits_time ON submission_limits(submitted_at);
