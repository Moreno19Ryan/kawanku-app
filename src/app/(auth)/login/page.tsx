import type { Metadata } from "next";
import { FormMasuk } from "@/components/auth/form-masuk";
import { HalamanMasuk } from "@/components/auth/halaman-masuk";

export const metadata: Metadata = {
  title: "Masuk Admin",
};

/**
 * Login admin (email + kata sandi, Supabase Auth). Login generus (username +
 * PIN) ada di /masuk; keduanya satu tampilan dengan tab Generus | Admin.
 */
export default function AdminLoginPage() {
  return (
    <HalamanMasuk jenis="admin">
      <FormMasuk />
    </HalamanMasuk>
  );
}
