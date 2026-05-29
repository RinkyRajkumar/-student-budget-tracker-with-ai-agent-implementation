import { Bus, CircleEllipsis, Film, GraduationCap, HeartPulse, Home, IndianRupee, PiggyBank, Plane, ReceiptText, RefreshCcw, ShoppingBag, Utensils, Wallet } from "lucide-react";

export const categoryMeta = {
  Budget: { icon: Wallet, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.15)" },
  Earnings: { icon: IndianRupee, color: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  Food: { icon: Utensils, color: "#F97316", bg: "rgba(249, 115, 22, 0.15)" },
  Transport: { icon: Bus, color: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)" },
  "Bills & Utilities": { icon: ReceiptText, color: "#10B981", bg: "rgba(16, 185, 129, 0.15)" },
  "Rent / Housing": { icon: Home, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)" },
  Rent: { icon: Home, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)" },
  Education: { icon: GraduationCap, color: "#EC4899", bg: "rgba(236, 72, 153, 0.15)" },
  Books: { icon: GraduationCap, color: "#EC4899", bg: "rgba(236, 72, 153, 0.15)" },
  Tuition: { icon: GraduationCap, color: "#EC4899", bg: "rgba(236, 72, 153, 0.15)" },
  Health: { icon: HeartPulse, color: "#06B6D4", bg: "rgba(6, 182, 212, 0.15)" },
  Shopping: { icon: ShoppingBag, color: "#A855F7", bg: "rgba(168, 85, 247, 0.15)" },
  Entertainment: { icon: Film, color: "#6366F1", bg: "rgba(99, 102, 241, 0.15)" },
  Subscriptions: { icon: RefreshCcw, color: "#7C3AED", bg: "rgba(124, 58, 237, 0.15)" },
  Recurring: { icon: RefreshCcw, color: "#7C3AED", bg: "rgba(124, 58, 237, 0.15)" },
  Savings: { icon: PiggyBank, color: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
  Travel: { icon: Plane, color: "#EAB308", bg: "rgba(234, 179, 8, 0.15)" },
  Other: { icon: CircleEllipsis, color: "#F43F5E", bg: "rgba(244, 63, 94, 0.15)" }
};

export function getCategoryMeta(category = "Other") {
  if (categoryMeta[category]) return categoryMeta[category];
  const value = String(category).toLowerCase();
  if (/earning|income/.test(value)) return categoryMeta.Earnings;
  if (/budget/.test(value)) return categoryMeta.Budget;
  if (/food|grocery|restaurant/.test(value)) return categoryMeta.Food;
  if (/transport|bus|cab|fuel|vehicle/.test(value)) return categoryMeta.Transport;
  if (/bill|utility|electric|water|internet|mobile/.test(value)) return categoryMeta["Bills & Utilities"];
  if (/rent|housing|home|emi/.test(value)) return categoryMeta["Rent / Housing"];
  if (/education|book|tuition|course|school|college/.test(value)) return categoryMeta.Education;
  if (/health|medical|medicine|gym/.test(value)) return categoryMeta.Health;
  if (/shopping|clothing|footwear/.test(value)) return categoryMeta.Shopping;
  if (/entertainment|movie|gift/.test(value)) return categoryMeta.Entertainment;
  if (/subscription|recurring|ott|music|cloud|app/.test(value)) return categoryMeta.Subscriptions;
  if (/saving|investment|emergency/.test(value)) return categoryMeta.Savings;
  if (/travel|trip/.test(value)) return categoryMeta.Travel;
  return categoryMeta.Other;
}

export default function CategoryBadge({ category, size = 40, iconSize = 18, className = "" }) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: meta.color, boxShadow: `0 10px 24px ${meta.bg}` }}
    >
      <Icon size={iconSize} className="text-white" />
    </span>
  );
}
