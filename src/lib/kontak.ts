/** Kontak pengembang untuk kendala aplikasi (ditampilkan di Bantuan, login, perawatan, galat). */
export const KONTAK_PENGEMBANG = {
  whatsapp: "0855-4220-1902",
  // wa.me memakai format internasional tanpa 0 dan tanda +.
  whatsappUrl: `https://wa.me/6285542201902?text=${encodeURIComponent("Halo, saya ada kendala dengan aplikasi KawanKu: ")}`,
  email: "morenoryandika@gmail.com",
  emailUrl: `mailto:morenoryandika@gmail.com?subject=${encodeURIComponent("Kendala aplikasi KawanKu")}`,
} as const;
