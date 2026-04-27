import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const useBrowserStore = import.meta.env.PROD && !import.meta.env.VITE_API_URL;

const remoteApi = axios.create({ baseURL: API_URL });

remoteApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("student-budget-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);
const cents = (amount) => Math.round(Number(amount || 0) * 100);
const money = (value) => Number((Number(value || 0) / 100).toFixed(2));
const nextId = (rows) => Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;

const categories = [
  { id: 2, name: "Books", color: "#6366f1" },
  { id: 5, name: "Entertainment", color: "#d946ef" },
  { id: 10, name: "Food", color: "#f97316" },
  { id: 6, name: "Health", color: "#ef4444" },
  { id: 9, name: "Other", color: "#475569" },
  { id: 3, name: "Rent", color: "#14b8a6" },
  { id: 7, name: "Shopping", color: "#f59e0b" },
  { id: 8, name: "Subscriptions", color: "#8b5cf6" },
  { id: 1, name: "Transport", color: "#0ea5e9" },
  { id: 4, name: "Tuition", color: "#64748b" }
];

function seed() {
  const current = month();
  return {
    user: { id: 1, name: "Demo Student", email: "demo@student.edu", currency: "INR" },
    expenses: [
      expense(1, 9, 2000, `${current}-25`, "video games", "upi"),
      expense(2, 10, 30, `${current}-25`, "dal chawal", "upi"),
      expense(3, 10, 1000, `${current}-24`, "BURGERS", "card"),
      expense(4, 8, 199, `${current}-15`, "Netflix shared plan subscription", "upi"),
      expense(5, 8, 59, `${current}-05`, "Spotify Student subscription", "card")
    ],
    budget: { monthlyLimit: 50000 },
    goal: { name: "Spring break fund", targetAmount: 10000, currentAmount: 275, targetDate: "" },
    subscriptions: [
      { id: 1, name: "Spotify Student", categoryId: 8, category: "Subscriptions", categoryColor: "#8b5cf6", amount: 59, billingDay: 5, intervalMonths: 1, paymentMethod: "card", active: true, lastChargedMonth: current },
      { id: 2, name: "Netflix shared plan", categoryId: 8, category: "Subscriptions", categoryColor: "#8b5cf6", amount: 199, billingDay: 15, intervalMonths: 1, paymentMethod: "upi", active: true, lastChargedMonth: current }
    ],
    split: {
      groups: [
        {
          id: 1,
          name: "Canteen Crew",
          members: [
            { id: 1, groupId: 1, name: "You", isSelf: true, initials: "Y" },
            { id: 2, groupId: 1, name: "Rahul", isSelf: false, initials: "R" },
            { id: 3, groupId: 1, name: "Aisha", isSelf: false, initials: "A" }
          ]
        }
      ],
      bills: [],
      settlements: []
    }
  };
}

function expense(id, categoryId, amount, date, note, paymentMethod) {
  const category = categories.find((item) => item.id === categoryId) || categories[0];
  return {
    id,
    categoryId,
    category: category.name,
    categoryColor: category.color,
    amount,
    amountCents: cents(amount),
    date,
    note,
    paymentMethod,
    createdAt: new Date().toISOString()
  };
}

function store() {
  const raw = localStorage.getItem("student-budget-browser-store");
  if (raw) return JSON.parse(raw);
  const initial = seed();
  localStorage.setItem("student-budget-browser-store", JSON.stringify(initial));
  return initial;
}

function write(next) {
  localStorage.setItem("student-budget-browser-store", JSON.stringify(next));
  return next;
}

function response(data) {
  return Promise.resolve({ data });
}

function filterExpenses(rows, params = {}) {
  return rows
    .filter((item) => !params.from || item.date >= params.from)
    .filter((item) => !params.to || item.date <= params.to)
    .filter((item) => !params.categoryId || String(item.categoryId) === String(params.categoryId))
    .filter((item) => !params.paymentMethod || item.paymentMethod === params.paymentMethod)
    .filter((item) => !params.search || item.note.toLowerCase().includes(String(params.search).toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function monthBounds(value = month()) {
  const [year, monthNumber] = value.split("-").map(Number);
  const end = new Date(year, monthNumber, 0).getDate();
  return { start: `${value}-01`, end: `${value}-${String(end).padStart(2, "0")}`, days: end };
}

function buildSummary(state, selectedMonth = month()) {
  const bounds = monthBounds(selectedMonth);
  const monthRows = state.expenses.filter((item) => item.date >= bounds.start && item.date <= bounds.end);
  const total = monthRows.reduce((sum, item) => sum + item.amount, 0);
  const todayRows = state.expenses.filter((item) => item.date === today());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const categoryRows = categories
    .map((category) => {
      const categoryTotal = monthRows.filter((item) => item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0);
      return { ...category, total: categoryTotal, percent: total ? Math.round((categoryTotal / total) * 10000) / 100 : 0 };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const trend = Object.values(
    monthRows.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = { date: item.date, total: 0 };
      acc[item.date].total += item.amount;
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));
  const remaining = Math.max(0, state.budget.monthlyLimit - total);
  const daysRemaining = Math.max(1, bounds.days - Number(today().slice(8, 10)) + 1);
  return {
    month: selectedMonth,
    dailyTotal: todayRows.reduce((sum, item) => sum + item.amount, 0),
    weeklyTotal: state.expenses.filter((item) => item.date >= weekStartIso).reduce((sum, item) => sum + item.amount, 0),
    monthlyTotal: total,
    monthlyBudget: state.budget.monthlyLimit,
    remainingBudget: remaining,
    budgetUsedPercent: state.budget.monthlyLimit ? Math.round((total / state.budget.monthlyLimit) * 10000) / 100 : 0,
    safeToSpendPerDay: Number((remaining / daysRemaining).toFixed(2)),
    daysRemaining,
    budgetStatus: total > state.budget.monthlyLimit ? "over" : total > state.budget.monthlyLimit * 0.85 ? "near" : "ok",
    categories: categoryRows,
    trend
  };
}

function buildAdvice(state, selectedMonth = month()) {
  const summary = buildSummary(state, selectedMonth);
  const highest = summary.categories[0];
  const notes = state.expenses.filter((item) => item.date.startsWith(selectedMonth) && item.note);
  const foodNotes = notes.filter((item) => /food|lunch|dinner|coffee|burger|snack|dal|chawal/i.test(item.note));
  const noteInsights = foodNotes.length
    ? [{ topic: "outside_food", label: "Food notes", count: foodNotes.length, amount: foodNotes.reduce((sum, item) => sum + item.amount, 0), message: "Your notes mention bought meals or snacks. Try setting a weekly cafe/order cap." }]
    : [];
  return {
    advice: {
      summary: highest ? `${highest.name} is your highest spending area this month.` : "No spending recorded for this month yet.",
      highestCategory: highest ? { category: highest.name, amount: highest.total, percentOfSpend: highest.percent } : null,
      safeToSpend: { totalRemaining: summary.remainingBudget, perDay: summary.safeToSpendPerDay, daysRemaining: summary.daysRemaining, status: summary.budgetStatus },
      alerts: [{ level: summary.budgetStatus === "over" ? "critical" : "normal", message: summary.budgetStatus === "over" ? "You have exceeded your monthly budget." : "Your spending is within the expected range." }],
      suggestions: noteInsights.length ? [noteInsights[0].message, "Review recent purchases and mark which ones were necessary."] : ["Set a small buffer for unplanned expenses."],
      noteInsights,
      weeklyTip: noteInsights.length ? "Pick two low-cost meal swaps this week." : "Plan one no-spend day this week."
    }
  };
}

function splitOverview(state) {
  const split = state.split;
  const balances = new Map();
  split.bills.forEach((bill) => {
    const payer = findMember(split.groups, bill.payerMemberId);
    bill.shares.forEach((share) => {
      if (share.memberId === bill.payerMemberId || !share.remaining) return;
      const member = findMember(split.groups, share.memberId);
      if (!payer?.isSelf && !member?.isSelf) return;
      const friend = payer?.isSelf ? member : payer;
      const current = balances.get(friend.id) || { memberId: friend.id, name: friend.name, net: 0 };
      current.net += payer?.isSelf ? share.remaining : -share.remaining;
      balances.set(friend.id, current);
    });
  });
  split.settlements.forEach((settlement) => {
    const from = findMember(split.groups, settlement.fromMemberId);
    const to = findMember(split.groups, settlement.toMemberId);
    if (!from?.isSelf && !to?.isSelf) return;
    const friend = from?.isSelf ? to : from;
    const current = balances.get(friend.id) || { memberId: friend.id, name: friend.name, net: 0 };
    current.net += from?.isSelf ? settlement.amount : -settlement.amount;
    balances.set(friend.id, current);
  });
  return {
    groups: split.groups,
    bills: split.bills,
    balances: [...balances.values()].filter((item) => Math.abs(item.net) > 0.009).map((item) => ({ ...item, direction: item.net >= 0 ? "owed_to_you" : "you_owe" })),
    settlements: split.settlements,
    analytics: {
      monthlySharedFood: split.bills.filter((bill) => bill.dateTime.startsWith(month())).reduce((sum, bill) => sum + bill.totalAmount, 0),
      mostFrequentPartner: null,
      billCount: split.bills.length,
      pendingCount: split.bills.length
    },
    insights: []
  };
}

function findMember(groups, id) {
  return groups.flatMap((group) => group.members).find((member) => Number(member.id) === Number(id));
}

function splitShares(total, splitType, participants) {
  if (splitType === "equal") {
    const totalCents = cents(total);
    const base = Math.floor(totalCents / participants.length);
    let remainder = totalCents - base * participants.length;
    return participants.map((item) => ({ memberId: item.memberId, share: money(base + (remainder-- > 0 ? 1 : 0)) }));
  }
  return participants.map((item) => ({ memberId: item.memberId, share: splitType === "percentage" ? Number((Number(total) * Number(item.percent || 0) / 100).toFixed(2)) : Number(item.amount ?? item.itemTotal ?? 0) }));
}

const browserApi = {
  get(path, config = {}) {
    const state = store();
    const params = config.params || {};
    if (path === "/auth/local") return response({ user: state.user, token: "browser-local-token" });
    if (path === "/categories") return response({ categories });
    if (path === "/expenses") return response({ expenses: filterExpenses(state.expenses, params) });
    if (path === "/summary") return response({ summary: buildSummary(state, params.month || month()) });
    if (path === "/advice") return response(buildAdvice(state, params.month || month()));
    if (path === "/budget") return response(state.budget);
    if (path === "/savings-goal") return response({ goal: { ...state.goal, progressPercent: Math.round((state.goal.currentAmount / state.goal.targetAmount) * 10000) / 100 } });
    if (path === "/subscriptions") return response({ subscriptions: state.subscriptions });
    if (path === "/split-bills") return response(splitOverview(state));
    if (path.startsWith("/export.csv")) {
      const rows = filterExpenses(state.expenses, params);
      const csv = ["date,category,note,payment_method,amount", ...rows.map((item) => [item.date, item.category, `"${item.note.replaceAll('"', '""')}"`, item.paymentMethod, item.amount].join(","))].join("\n");
      return response(new Blob([csv], { type: "text/csv" }));
    }
    return Promise.reject(new Error(`Unsupported local API route: ${path}`));
  },
  post(path, payload) {
    const state = store();
    if (path === "/expenses") {
      const row = expense(nextId(state.expenses), Number(payload.categoryId), Number(payload.amount), payload.date, payload.note || "", payload.paymentMethod);
      state.expenses.push(row);
      write(state);
      return response({ expense: row });
    }
    if (path === "/subscriptions") {
      const category = categories.find((item) => item.id === Number(payload.categoryId)) || categories.find((item) => item.name === "Subscriptions");
      state.subscriptions.push({ id: nextId(state.subscriptions), name: payload.name, categoryId: category.id, category: category.name, categoryColor: category.color, amount: Number(payload.amount), billingDay: Number(payload.billingDay), intervalMonths: Number(payload.intervalMonths), paymentMethod: payload.paymentMethod, active: true, lastChargedMonth: "" });
      write(state);
      return response({ subscription: state.subscriptions[state.subscriptions.length - 1] });
    }
    if (path === "/split-bills/groups") {
      const groupId = nextId(state.split.groups);
      const members = [{ id: 1, groupId, name: "You", isSelf: true, initials: "Y" }, ...(payload.members || []).map((name, index) => ({ id: index + 2, groupId, name, isSelf: false, initials: name[0]?.toUpperCase() || "?" }))];
      state.split.groups.unshift({ id: groupId, name: payload.name, members });
      write(state);
      return response(splitOverview(state));
    }
    const memberMatch = path.match(/^\/split-bills\/groups\/(\d+)\/members$/);
    if (memberMatch) {
      const group = state.split.groups.find((item) => item.id === Number(memberMatch[1]));
      group.members.push({ id: nextId(group.members), groupId: group.id, name: payload.name, isSelf: false, initials: payload.name[0]?.toUpperCase() || "?" });
      write(state);
      return response(splitOverview(state));
    }
    if (path === "/split-bills/bills") {
      const shares = splitShares(payload.totalAmount, payload.splitType, payload.participants).map((share) => ({ ...share, paid: Number(share.memberId) === Number(payload.payerMemberId) ? share.share : 0, remaining: Number(share.memberId) === Number(payload.payerMemberId) ? 0 : share.share }));
      state.split.bills.unshift({ id: nextId(state.split.bills), ...payload, totalAmount: Number(payload.totalAmount), shares, status: "pending" });
      write(state);
      return response(splitOverview(state));
    }
    if (path === "/split-bills/settlements") {
      state.split.settlements.unshift({ id: nextId(state.split.settlements), ...payload, amount: Number(payload.amount) });
      write(state);
      return response(splitOverview(state));
    }
    return Promise.reject(new Error(`Unsupported local API route: ${path}`));
  },
  put(path, payload) {
    const state = store();
    const expenseMatch = path.match(/^\/expenses\/(\d+)$/);
    if (expenseMatch) {
      const index = state.expenses.findIndex((item) => item.id === Number(expenseMatch[1]));
      state.expenses[index] = expense(Number(expenseMatch[1]), Number(payload.categoryId), Number(payload.amount), payload.date, payload.note || "", payload.paymentMethod);
      write(state);
      return response({ expense: state.expenses[index] });
    }
    if (path === "/budget") {
      state.budget.monthlyLimit = Number(payload.monthlyLimit);
      write(state);
      return response(state.budget);
    }
    if (path === "/savings-goal") {
      state.goal = { ...state.goal, ...payload };
      write(state);
      return response({ goal: state.goal });
    }
    return Promise.reject(new Error(`Unsupported local API route: ${path}`));
  },
  delete(path) {
    const state = store();
    const expenseMatch = path.match(/^\/expenses\/(\d+)$/);
    const subscriptionMatch = path.match(/^\/subscriptions\/(\d+)$/);
    const memberMatch = path.match(/^\/split-bills\/groups\/(\d+)\/members\/(\d+)$/);
    if (expenseMatch) state.expenses = state.expenses.filter((item) => item.id !== Number(expenseMatch[1]));
    else if (subscriptionMatch) state.subscriptions = state.subscriptions.filter((item) => item.id !== Number(subscriptionMatch[1]));
    else if (memberMatch) {
      const group = state.split.groups.find((item) => item.id === Number(memberMatch[1]));
      group.members = group.members.filter((item) => item.id !== Number(memberMatch[2]));
    } else return Promise.reject(new Error(`Unsupported local API route: ${path}`));
    write(state);
    return response({});
  }
};

export const api = useBrowserStore ? browserApi : remoteApi;

export function saveSession(payload) {
  localStorage.setItem("student-budget-token", payload.token);
  localStorage.setItem("student-budget-user", JSON.stringify(payload.user));
}

export function readUser() {
  const raw = localStorage.getItem("student-budget-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("student-budget-token");
  localStorage.removeItem("student-budget-user");
}

export async function downloadCsv(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = useBrowserStore
    ? await api.get("/export.csv", { params: filters })
    : await api.get(`/export.csv?${params.toString()}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-expenses.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
