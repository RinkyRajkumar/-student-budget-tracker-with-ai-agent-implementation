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

function sessionUserFromSupabaseUser(user, profile = null) {
  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student",
    email: user.email
  };
}

function writeOnboardingStatus(isComplete) {
  const current = getOnboarding() || {};
  writeJson(ONBOARDING_KEY, {
    ...current,
    complete: Boolean(isComplete),
    onboardingComplete: Boolean(isComplete)
  });
}

export async function signupUser({ name, email, password }) {
  if (isSupabaseEnabled()) {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw new Error(error.message);
    const user = data.user;
    if (data.session) {
      if (!user) throw new Error("Supabase did not return a user for this signup.");
      const sessionUser = { id: user.id, name: name.trim(), email: normalizedEmail };
      writeJson(SESSION_KEY, sessionUser);
      await upsertSupabaseProfile(sessionUser, false);
      return { user: sessionUser, verificationSent: false };
    }
    return { verificationSent: true, message: "Verification email sent. Please check your Gmail inbox." };
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
    const profile = await ensureSupabaseProfile(authUser);
    const sessionUser = sessionUserFromSupabaseUser(authUser, profile);
    writeJson(SESSION_KEY, sessionUser);
    await loadSupabaseOnboarding(authUser.id);
    writeOnboardingStatus(Boolean(profile?.onboarding_complete));
    return { user: sessionUser, onboardingComplete: Boolean(profile?.onboarding_complete) };
  }

  const users = readJson(USERS_KEY, []);
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((item) => item.email === normalizedEmail && item.password === password);
  if (!user) throw new Error("Invalid email or password.");
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  writeJson(SESSION_KEY, sessionUser);
  return sessionUser;
}

export async function logoutUser() {
  if (isSupabaseEnabled()) {
    await getSupabase()?.auth.signOut();
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

export async function redoOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem("onboardingComplete");

  if (!isSupabaseEnabled()) return;

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);

  const userId = data.user?.id || getSessionUser()?.id;
  if (!userId) return;

  const now = new Date().toISOString();
  const [profileResult, onboardingResult] = await Promise.all([
    supabase.from("profiles").update({ onboarding_complete: false }).eq("id", userId),
    supabase.from("spendly_onboarding").upsert({
      user_id: userId,
      complete: false,
      updated_at: now
    }, { onConflict: "user_id" })
  ]);

  if (profileResult.error || onboardingResult.error) {
    throw new Error(profileResult.error?.message || onboardingResult.error?.message || "Could not restart onboarding.");
  }
}

export async function signInWithGoogle() {
  if (!isSupabaseEnabled()) throw new Error("Supabase is not configured.");
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getSupabaseAuthRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });
  if (error) throw new Error(error.message);
}

export async function resetPassword(email) {
  if (!email?.trim()) throw new Error("Enter your email first.");
  if (!isSupabaseEnabled()) {
    throw new Error("Password reset is available when Supabase auth is enabled.");
  }
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/login`
  });
  if (error) throw new Error(error.message);
  return "Password reset link sent. Please check your Gmail inbox.";
}

export async function getCurrentSupabaseUser() {
  if (!isSupabaseEnabled()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await ensureSupabaseProfile(data.user);
  const sessionUser = sessionUserFromSupabaseUser(data.user, profile);
  writeJson(SESSION_KEY, sessionUser);
  await loadSupabaseOnboarding(data.user.id);
  writeOnboardingStatus(Boolean(profile?.onboarding_complete));
  return { user: sessionUser, onboardingComplete: Boolean(profile?.onboarding_complete) };
}

export async function completeSupabaseOAuthCallback() {
  if (!isSupabaseEnabled()) return null;
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error_description") || params.get("error");
  if (oauthError) throw new Error(oauthError);

  const code = params.get("code");
  if (code) {
    const { error } = await getSupabase().auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    window.history.replaceState({}, "", "/auth/callback");
  }

  return getCurrentSupabaseUser();
}

export function hasSupabaseOAuthCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error") || params.has("error_description");
}

function getSupabaseAuthRedirectUrl() {
  return import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL || `${window.location.origin}/auth/callback`;
}

export async function saveOnboarding(data) {
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
    await syncOnboardingToSupabase(normalized);
  }
  return normalized;
}

async function upsertSupabaseProfile(user, onboardingComplete = false) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: user.name,
      email: user.email,
      onboarding_complete: onboardingComplete
    }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function readSupabaseProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const legacy = await supabase
    .from("spendly_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (legacy.error) throw new Error(legacy.error.message);
  if (!legacy.data) return null;
  return upsertSupabaseProfile({
    id: legacy.data.id,
    name: legacy.data.full_name,
    email: legacy.data.email
  }, Boolean(legacy.data.onboarding_complete));
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
  const profileResult = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", sessionUser.id);
  if (onboardingError || budgetError || goalError) {
    throw new Error(onboardingError?.message || budgetError?.message || goalError?.message);
  }
  if (profileResult.error) throw new Error(profileResult.error.message);
}

async function ensureSupabaseProfile(user) {
  const existing = await readSupabaseProfile(user.id);
  if (existing) return existing;
  const sessionUser = sessionUserFromSupabaseUser(user);
  return upsertSupabaseProfile(sessionUser, false);
}
