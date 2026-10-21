"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bacaAdmin } from "./admin";
import { tujuanAman } from "./tujuan";

export type StateMasuk = {
  galat?: string;
  email?: string;
};

const PESAN_SALAH = "Email atau kata sandi salah.";

/** Login admin dengan email + kata sandi (Supabase Auth). */
export async function masuk(_prev: StateMasuk, formData: FormData): Promise<StateMasuk> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = tujuanAman(formData.get("tujuan"));

  if (!email || !password) {
    return { galat: "Isi email dan kata sandi.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Jangan bedakan "email tidak terdaftar" dan "sandi salah".
    const galat =
      error.status === 429
        ? "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
        : PESAN_SALAH;
    return { galat, email };
  }

  // Akun ada di Auth, tapi belum tentu admin aktif (mis. akun generus nanti).
  const admin = await bacaAdmin(supabase);
  if (!admin) {
    const { data: generus } = await supabase.from("akun_generus").select("user_id").maybeSingle();
    if (generus) redirect("/saya");
    await supabase.auth.signOut();
    return { galat: "Akun ini bukan admin aktif. Hubungi admin desa.", email };
  }

  redirect(next);
}

/** Keluar dari sesi admin. */
export async function keluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Keluar dari semua perangkat (mencabut semua sesi akun ini). */
export async function keluarSemuaPerangkat() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
