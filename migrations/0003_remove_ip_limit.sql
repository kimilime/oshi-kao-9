-- IP quotas are retired; remove stored IP digests without changing votes.
UPDATE submission_limits SET ip_hash = '';
DROP INDEX IF EXISTS submission_limits_ip_day;
