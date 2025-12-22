import type { PopupAudience } from "./popupTypes";

export function toDatetimeLocal(ms?: number): string {
  if (ms === undefined) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function parseOptionalInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function parseOptionalDatetimeLocal(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const ms = new Date(trimmed).getTime();
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

export function audienceLabel(audience: PopupAudience) {
  if (audience === "all") return "Todos";
  if (audience === "free") return "Gratis";
  if (audience === "trial") return "Trial";
  return "Gratis o Trial";
}

export function scheduleLabel(startAt?: number, endAt?: number) {
  if (startAt === undefined && endAt === undefined) return "Siempre";
  const start = startAt ? new Date(startAt).toLocaleString() : "(sin inicio)";
  const end = endAt ? new Date(endAt).toLocaleString() : "(sin fin)";
  return `${start} → ${end}`;
}
