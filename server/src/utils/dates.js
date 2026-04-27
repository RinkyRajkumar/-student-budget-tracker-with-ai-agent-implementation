export function currentMonth() {
  return localDateString().slice(0, 7);
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function monthBounds(month = currentMonth()) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

export function daysInMonth(month = currentMonth()) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

export function daysRemainingInMonth(month = currentMonth()) {
  const today = new Date();
  const nowMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (month !== nowMonth) return daysInMonth(month);
  return Math.max(1, daysInMonth(month) - today.getDate() + 1);
}

export function weekOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000;
  return Math.floor(diff / 604800000);
}
