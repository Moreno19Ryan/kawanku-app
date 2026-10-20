export const TUJUAN_BAWAAN = "/dashboard";

/**
 * Tujuan setelah login (parameter ?next=). Hanya path relatif di situs ini;
 * URL absolut atau "//host" ditolak supaya tidak jadi open redirect.
 */
export function tujuanAman(nilai: unknown): string {
  if (typeof nilai !== "string") return TUJUAN_BAWAAN;
  if (!nilai.startsWith("/") || nilai.startsWith("//") || nilai.includes("\\")) {
    return TUJUAN_BAWAAN;
  }
  if (nilai === "/login" || nilai.startsWith("/login?") || nilai.startsWith("/keluar")) {
    return TUJUAN_BAWAAN;
  }
  return nilai;
}
