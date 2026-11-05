export function peso(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pesoShort(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return "₱" + v.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

export function pct(rate: number): string {
  return (rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1) + "%";
}

export function initials(name: string): string {
  const parts = name
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function displayName(name: string): string {
  // Stored as "Surname, First Name" — show "First Name Surname"
  const [last, first] = name.split(",").map((s) => s.trim());
  if (!first) return name.trim();
  return `${first} ${last}`;
}

export function longDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
