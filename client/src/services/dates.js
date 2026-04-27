export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMonthString(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

export function monthBounds(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const last = new Date(year, monthIndex, 0);
  return {
    start: localDateString(first),
    end: localDateString(last)
  };
}

export function addMonths(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return localMonthString(date);
}

export function formatMonthLabel(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, monthIndex - 1, 1));
}

export function buildCalendarDays(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const last = new Date(year, monthIndex, 0);
  const days = [];
  const leading = first.getDay();

  for (let index = 0; index < leading; index += 1) {
    days.push({ key: `empty-${index}`, empty: true });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, monthIndex - 1, day);
    days.push({
      key: localDateString(date),
      date: localDateString(date),
      day
    });
  }

  while (days.length % 7 !== 0) {
    days.push({ key: `tail-${days.length}`, empty: true });
  }

  return days;
}
