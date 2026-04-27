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
  ["Books", "#6366f1"],
  ["Rent", "#14b8a6"],
  ["Tuition", "#64748b"],
  ["Entertainment", "#d946ef"],
  ["Health", "#ef4444"],
  ["Shopping", "#f59e0b"],
  ["Subscriptions", "#8b5cf6"],
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
  if (user) {
    seedDefaultSubscriptions(db, user.id);
    seedDefaultSplitGroup(db, user.id);
    return;
  }

  const passwordHash = bcrypt.hashSync("Student123!", 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, ?)")
    .run("Demo Student", "demo@student.edu", passwordHash, "INR");
  const userId = result.lastInsertRowid;

  db.prepare("INSERT INTO budgets (user_id, monthly_limit_cents) VALUES (?, ?)").run(userId, 95000);
  db.prepare(
    "INSERT INTO savings_goals (user_id, name, target_cents, current_cents, target_date) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, "Spring break fund", 80000, 27500, monthOffsetDate(3));

  const catId = (name) => db.prepare("SELECT id FROM categories WHERE name = ?").get(name).id;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const demoExpenses = [
    [catId("Rent"), 42000, `${currentMonth}-01`, "Shared room rent", "bank"],
    [catId("Food"), 1250, isoDateOffset(0), "Campus lunch", "card"],
    [catId("Food"), 860, isoDateOffset(-1), "Coffee and snacks", "upi"],
    [catId("Books"), 4899, isoDateOffset(-3), "Used textbook", "card"],
    [catId("Transport"), 1800, isoDateOffset(-5), "Metro pass recharge", "upi"],
    [catId("Entertainment"), 2200, isoDateOffset(-7), "Movie night", "card"],
    [catId("Subscriptions"), 999, isoDateOffset(-9), "Study app monthly plan", "card"],
    [catId("Health"), 1350, isoDateOffset(-12), "Pharmacy", "cash"],
    [catId("Shopping"), 3150, isoDateOffset(-14), "Dorm supplies", "card"]
  ];

  const insertExpense = db.prepare(
    "INSERT INTO expenses (user_id, category_id, amount_cents, spent_at, note, payment_method) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const seedExpenses = db.transaction(() => {
    demoExpenses.forEach(([categoryId, amount, date, note, method]) => {
      insertExpense.run(userId, categoryId, amount, date, note, method);
    });
  });
  seedExpenses();

  seedDefaultSubscriptions(db, userId);
  seedDefaultSplitGroup(db, userId);
}

function seedDefaultSubscriptions(db, userId) {
  const existing = db.prepare("SELECT id FROM subscriptions WHERE user_id = ? LIMIT 1").get(userId);
  if (existing) return;

  const catId = (name) => db.prepare("SELECT id FROM categories WHERE name = ?").get(name).id;
  const insertSubscription = db.prepare(
    `INSERT INTO subscriptions
      (user_id, category_id, name, amount_cents, billing_day, interval_months, payment_method, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertSubscription.run(userId, catId("Subscriptions"), "Spotify Student", 5900, 5, 1, "card", 1);
  insertSubscription.run(userId, catId("Subscriptions"), "Netflix shared plan", 19900, 15, 1, "upi", 1);
}

function seedDefaultSplitGroup(db, userId) {
  const existing = db.prepare("SELECT id FROM split_groups WHERE user_id = ? LIMIT 1").get(userId);
  if (existing) return;

  const group = db.prepare("INSERT INTO split_groups (user_id, name) VALUES (?, ?)").run(userId, "Canteen Crew");
  const insertMember = db.prepare("INSERT INTO split_group_members (group_id, name, is_self) VALUES (?, ?, ?)");
  insertMember.run(group.lastInsertRowid, "You", 1);
  insertMember.run(group.lastInsertRowid, "Rahul", 0);
  insertMember.run(group.lastInsertRowid, "Aisha", 0);
}

function isoDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthOffsetDate(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
