import { getSupabase, isSupabaseEnabled } from "./supabaseClient.js";

export const SPENDLY_CATEGORIES_KEY = "spendly_categories";
const SESSION_KEY = "student-budget-app-session";

export function readSpendlyCategories() {
  try {
    const rows = JSON.parse(localStorage.getItem(SPENDLY_CATEGORIES_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function saveSpendlyCategories(categories) {
  localStorage.setItem(SPENDLY_CATEGORIES_KEY, JSON.stringify(categories));
  syncCategoriesToSupabase(categories).catch((error) => {
    console.warn("Could not sync categories to Supabase", error);
  });
  window.dispatchEvent(new CustomEvent("spendly-categories-updated"));
}

export function mergeSpendlyCategories(baseCategories) {
  const existingNames = new Set(baseCategories.map((item) => item.name.toLowerCase()));
  const localRows = readSpendlyCategories()
    .filter((item) => item?.name && !existingNames.has(item.name.toLowerCase()))
    .map((item, index) => ({
      id: item.id || 9000 + index,
      name: item.name,
      color: item.color || "#8b5cf6",
      icon: item.icon || item.name.slice(0, 1).toUpperCase(),
      isCustom: Boolean(item.isCustom)
    }));
  return [...baseCategories, ...localRows];
}

async function syncCategoriesToSupabase(categories) {
  if (!isSupabaseEnabled()) return;
  const user = readSessionUser();
  if (!user?.id) return;
  const rows = categories
    .filter((item) => item?.name)
    .map((item, index) => ({
      user_id: user.id,
      category_id: Number(item.id) || 9000 + index,
      name: item.name,
      color: item.color || "#8b5cf6",
      icon: item.icon || item.name.slice(0, 1).toUpperCase(),
      is_custom: Boolean(item.isCustom ?? true)
    }));
  if (rows.length === 0) return;
  const { error } = await getSupabase()
    .from("spendly_categories")
    .upsert(rows, { onConflict: "user_id,name" });
  if (error) throw error;
}

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
