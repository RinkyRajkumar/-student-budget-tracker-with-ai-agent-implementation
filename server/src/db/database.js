import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { schema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "../../data/student-budget.sqlite");

class PersistedSqlite {
  constructor(database, dbPath) {
    this.database = database;
    this.dbPath = dbPath;
  }

  exec(sql) {
    this.database.exec(sql);
    this.persist();
  }

  pragma(sql) {
    this.database.run(`PRAGMA ${sql}`);
  }

  prepare(sql) {
    return new PreparedStatement(this, sql);
  }

  transaction(fn) {
    return (...args) => {
      const result = fn(...args);
      this.persist();
      return result;
    };
  }

  persist() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.database.export()));
  }
}

class PreparedStatement {
  constructor(parent, sql) {
    this.parent = parent;
    this.sql = sql;
  }

  run(...params) {
    this.parent.database.run(this.sql, normalizeParams(params));
    const changes = this.parent.database.exec("SELECT changes() AS changes")[0]?.values?.[0]?.[0] || 0;
    const lastInsertRowid = this.parent.database.exec("SELECT last_insert_rowid() AS id")[0]?.values?.[0]?.[0] || 0;
    this.parent.persist();
    return { changes, lastInsertRowid };
  }

  get(...params) {
    const statement = this.parent.database.prepare(this.sql);
    try {
      statement.bind(normalizeParams(params));
      if (!statement.step()) return undefined;
      return statement.getAsObject();
    } finally {
      statement.free();
    }
  }

  all(...params) {
    const statement = this.parent.database.prepare(this.sql);
    const rows = [];
    try {
      statement.bind(normalizeParams(params));
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

export async function openDatabase(dbPath = process.env.DB_PATH || defaultDbPath) {
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (file) => path.resolve(__dirname, "../../node_modules/sql.js/dist", file)
  });
  const database = fs.existsSync(resolved) ? new SQL.Database(fs.readFileSync(resolved)) : new SQL.Database();
  const db = new PersistedSqlite(database, resolved);
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  migrateDatabase(db);
  seedDatabase(db);
  db.persist();
  return db;
}

function migrateDatabase(db) {
  const splitBillColumns = db.prepare("PRAGMA table_info(split_bills)").all().map((column) => column.name);
  if (splitBillColumns.length && !splitBillColumns.includes("expense_id")) {
    db.exec("ALTER TABLE split_bills ADD COLUMN expense_id INTEGER");
  }
}

const categories = [
  ["Food", "#f97316"],
  ["Transport", "#0ea5e9"],
  ["Bills & Utilities", "#10b981"],
  ["Rent / Housing", "#f59e0b"],
  ["Education", "#ec4899"],
  ["Books", "#6366f1"],
  ["Rent", "#14b8a6"],
  ["Tuition", "#64748b"],
  ["Entertainment", "#d946ef"],
  ["Health", "#ef4444"],
  ["Shopping", "#f59e0b"],
  ["Subscriptions", "#8b5cf6"],
  ["Savings", "#22c55e"],
  ["Travel", "#eab308"],
  ["Other", "#475569"]
];

function seedDatabase(db) {
  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)");
  const insertMany = db.transaction(() => {
    categories.forEach((category) => insertCategory.run(...category));
  });
  insertMany();

  db.prepare("UPDATE users SET currency = 'INR' WHERE currency = 'USD'").run();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get("demo@student.edu");
  if (user) return;

  const passwordHash = bcrypt.hashSync("Student123!", 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, ?)")
    .run("Demo Student", "demo@student.edu", passwordHash, "INR");
  const userId = result.lastInsertRowid;

  db.prepare("INSERT INTO budgets (user_id, monthly_limit_cents) VALUES (?, ?)").run(userId, 0);
  db.prepare(
    "INSERT INTO savings_goals (user_id, name, target_cents, current_cents, target_date) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, "", 0, 0, "");
}
