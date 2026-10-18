CREATE TABLE IF NOT EXISTS submissions (
 id TEXT PRIMARY KEY,
 report_id INTEGER NOT NULL CHECK(report_id BETWEEN 1 AND 15),
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 sync_status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_retry INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 issue_number INTEGER,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS pending_submissions ON submissions(sync_status,next_retry,lease_until);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
