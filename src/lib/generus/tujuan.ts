/** Tujuan aman setelah login generus: hanya halaman generus di situs ini. */
export function tujuanGenerus(nilai: unknown): string {
  if (typeof nilai !== "string" || nilai.startsWith("//") || nilai.includes("\\")) return "/saya";
  return /^\/(saya|absen)(\/|\?|$)/.test(nilai) ? nilai : "/saya";
}
