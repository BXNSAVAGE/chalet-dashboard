-- Cloudflare D1 schema for legacy Pages Functions
-- Bookings table expected by functions/api/bookings.js
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  guest TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'pending',
  start TEXT,
  end TEXT,
  adults INTEGER DEFAULT 2,
  children INTEGER DEFAULT 0,
  amount REAL DEFAULT 0,
  depositAmount REAL DEFAULT 0,
  depositDue TEXT,
  cancellationPolicy TEXT,
  freeCancellation TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_start_end ON bookings(start, end);

-- Gmail token storage used by functions/api/gmail/*
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER
);
