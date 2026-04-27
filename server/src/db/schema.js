export const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  spent_at TEXT NOT NULL,
  note TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank', 'upi', 'other')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  monthly_limit_cents INTEGER NOT NULL CHECK (monthly_limit_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  current_cents INTEGER NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  target_date TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  billing_day INTEGER NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  interval_months INTEGER NOT NULL DEFAULT 1 CHECK (interval_months IN (1, 3, 6, 12)),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank', 'upi', 'other')),
  active INTEGER NOT NULL DEFAULT 1,
  last_charged_month TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS split_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_self INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  payer_member_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  place TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  bill_at TEXT NOT NULL,
  notes TEXT,
  receipt_name TEXT,
  expense_id INTEGER,
  split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'custom', 'item')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_member_id) REFERENCES split_group_members(id),
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS split_bill_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  share_cents INTEGER NOT NULL CHECK (share_cents >= 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  FOREIGN KEY (bill_id) REFERENCES split_bills(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES split_group_members(id)
);

CREATE TABLE IF NOT EXISTS split_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  from_member_id INTEGER NOT NULL,
  to_member_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  settled_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_member_id) REFERENCES split_group_members(id),
  FOREIGN KEY (to_member_id) REFERENCES split_group_members(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_split_bills_user_date ON split_bills(user_id, bill_at);
CREATE INDEX IF NOT EXISTS idx_split_members_group ON split_group_members(group_id);
`;
