// CIVITAS OS — money.ts
// Format FLR (integer minor unit → string tampilan). Tanpa float di jalur pembukuan.

export function fmt(amountMinor: number, withCode = true): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(amountMinor));
  const whole = Math.floor(abs / 100).toLocaleString("id-ID");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole},${frac}${withCode ? " FLR" : ""}`;
}

export function toMinor(whole: number): number {
  return Math.round(whole * 100);
}
