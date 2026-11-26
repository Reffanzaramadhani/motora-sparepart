CREATE TABLE app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE parts (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  compatibility TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price BETWEEN 0 AND 100000000),
  stock INTEGER NOT NULL CONSTRAINT stock_available CHECK(stock >= 0),
  minStock INTEGER NOT NULL CHECK(minStock >= 0),
  image TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
--> statement-breakpoint
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  contact TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('in','sale')),
  date TEXT NOT NULL,
  party TEXT NOT NULL,
  signature TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE transaction_items (
  transactionId TEXT NOT NULL REFERENCES transactions(id),
  partId TEXT NOT NULL REFERENCES parts(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unitPrice INTEGER NOT NULL CHECK(unitPrice BETWEEN 0 AND 100000000),
  PRIMARY KEY(transactionId, partId)
);
--> statement-breakpoint
CREATE INDEX transactions_by_date ON transactions(date DESC);
