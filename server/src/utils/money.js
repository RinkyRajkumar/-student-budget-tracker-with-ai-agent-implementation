export function toCents(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

export function fromCents(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 10000) / 100;
}
