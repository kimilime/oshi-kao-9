-- Preserve existing votes and allow multiple successful submissions per visitor/day.
CREATE TABLE runs_cumulative (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, day TEXT NOT NULL, ranking TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO runs_cumulative SELECT id,visitor,day,ranking,created_at FROM runs;
DROP TABLE runs;
ALTER TABLE runs_cumulative RENAME TO runs;
CREATE INDEX runs_visitor ON runs(visitor);
