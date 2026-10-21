/**
 * Pilihan tema per perangkat (localStorage), tidak bergantung setelan HP/laptop.
 * "sistem" = ikut perangkat (tanpa atribut data-theme).
 */
export type PilihanTema = "terang" | "gelap" | "sistem";

export const KUNCI_TEMA = "kk-tema";

/** Warna bilah browser/PWA, sama dengan token --kk-bg. */
export const WARNA_BILAH = { terang: "#f4f5f9", gelap: "#0b0c10" } as const;

/**
 * Skrip inline di <head>: memasang data-theme SEBELUM halaman dilukis
 * supaya tidak berkedip. Harus berdiri sendiri (tanpa import).
 */
export const SKRIP_TEMA = `(function(){try{var t=localStorage.getItem("${KUNCI_TEMA}");if(t==="terang")document.documentElement.setAttribute("data-theme","light");else if(t==="gelap")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`;
