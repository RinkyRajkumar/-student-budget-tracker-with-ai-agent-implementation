import { getSupabase, isSupabaseEnabled } from "./supabaseClient.js";

const USERS_KEY = "student-budget-users";
const SESSION_KEY = "student-budget-app-session";
const ONBOARDING_KEY = "student-budget-onboarding";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSessionUser() {
  return readJson(SESSION_KEY, null);
}

export function getOnboarding() {
  return readJson(ONBOARDING_KEY, null);
}

export function isOnboardingComplete() {
  return Boolean(getOnboarding()?.complete);
}

export async function signupUser({ name, email, password }) {
  if (isSupabaseEnabled()) {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { name: name.trim() } }
    });
    if (error) throw new Error(error.message);
    const user = data.user;
    if (!user) throw new Error("Supabase did not return a user for this signup.");
    if (!data.session) throw new Error("Signup created. Confirm your email, then login to continue.");
    const sessionUser = { id: user.id, name: name.trim(), email: normalizedEmail };
    writeJson(SESSION_KEY, sessionUser);
    await upsertSupabaseProfile(sessionUser);
    return sessionUser;
  }

  const users = readJson(USERS_KEY, []);
  const normalizedEmail = email.trim().toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }
  const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, password };
  writeJson(USERS_KEY, [...users, user]);
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  writeJson(SESSION_KEY, sessionUser);
  return sessionUser;
}

export async function loginUser({ email, password }) {
  if (isSupabaseEnabled()) {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) throw new Error(error.message);
    const authUser = data.user;
    if (!authUser) throw new Error("Supabase did not return a user for this login.");
    const profile = await readSupabaseProfile(authUser.id);
    const sessionUser = {
      id: authUser.id,
      name: profile?.full_name || authUser.user_metadata?.name || normalizedEmail.split("@")[0],
      email: authUser.email || normalizedEmail
    };
    writeJson(SESSION_KEY, sessionUser);
    await loadSupabaseOnboarding(authUser.id);
    return sessionUser;
  }

  const users = readJson(USERS_KEY, []);
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((item) => item.email === normalizedEmail && item.password === password);
  if (!user) throw new Error("Invalid email or password.");
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  writeJson(SESSION_KEY, sessionUser);
  return sessionUser;
}

export function logoutUser() {
  if (isSupabaseEnabled()) {
    getSupabase()?.auth.signOut();
  }
  localStorage.removeItem(SESSION_KEY);
}

export function saveOnboarding(data) {
  const normalized = {
    monthlyIncome: Number(data.monthlyIncome || 0),
    monthlyBudget: Number(data.monthlyBudget || 0),
    goalName: data.goalName?.trim() || "Savings goal",
    goalTargetAmount: Number(data.goalTargetAmount || 0),
    targetDate: data.targetDate || "",
    categories: data.categories || [],
    subscriptions: (data.subscriptions || []).map((item) => ({
      name: item.name,
      amount: Number(item.amount || 0),
      billingCycle: Number(item.billingCycle || item.intervalMonths || 1),
      billingDay: Number(item.billingDay || 1)
    })),
    complete: true,
    onboardingComplete: true
  };
  writeJson(ONBOARDING_KEY, normalized);
  if (isSupabaseEnabled()) {
    syncOnboardingToSupabase(normalized).catch((error) => {
      console.warn("Could not sync onboarding to Supabase", error);
    });
  }
  return normalized;
}

async function upsertSupabaseProfile(user) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("spendly_profiles")
    .upsert({
      id: user.id,
      full_name: user.name,
      email: user.email,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function readSupabaseProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("spendly_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadSupabaseOnboarding(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("spendly_onboarding")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const normalized = {
    monthlyIncome: Number(data.monthly_income || 0),
    monthlyBudget: Number(data.monthly_budget || 0),
    goalName: data.goal_name || "Savings goal",
    goalTargetAmount: Number(data.goal_target_amount || 0),
    targetDate: data.target_date || "",
    categories: data.categories || [],
    subscriptions: data.subscriptions || [],
    complete: Boolean(data.complete),
    onboardingComplete: Boolean(data.complete)
  };
  writeJson(ONBOARDING_KEY, normalized);
  return normalized;
}

async function syncOnboardingToSupabase(data) {
  const sessionUser = getSessionUser();
  if (!sessionUser?.id) return;
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const [{ error: onboardingError }, { error: budgetError }, { error: goalError }] = await Promise.all([
    supabase.from("spendly_onboarding").upsert({
      user_id: sessionUser.id,
      monthly_income: Number(data.monthlyIncome || 0),
      monthly_budget: Number(data.monthlyBudget || 0),
      goal_name: data.goalName || "",
      goal_target_amount: Number(data.goalTargetAmount || 0),
      target_date: data.targetDate || null,
      categories: data.categories || [],
      subscriptions: data.subscriptions || [],
      complete: true,
      updated_at: now
    }, { onConflict: "user_id" }),
    supabase.from("spendly_budget_settings").upsert({
      user_id: sessionUser.id,
      monthly_limit: Number(data.monthlyBudget || 0),
      updated_at: now
    }, { onConflict: "user_id" }),
    supabase.from("spendly_savings_goals").upsert({
      user_id: sessionUser.id,
      name: data.goalName || "",
      target_amount: Number(data.goalTargetAmount || 0),
      current_amount: 0,
      target_date: data.targetDate || null,
      updated_at: now
    }, { onConflict: "user_id" })
  ]);
  if (onboardingError || budgetError || goalError) {
    throw new Error(onboardingError?.message || budgetError?.message || goalError?.message);
  }
}
