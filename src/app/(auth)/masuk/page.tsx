import type { Metadata } from "next";
import { HalamanMasuk } from "@/components/auth/halaman-masuk";
import { FormMasukGenerus } from "@/components/generus/form-masuk-generus";

export const metadata: Metadata = {
  title: "Masuk Generus",
};

/** Login generus (username + PIN dari admin); tab Admin membuka /login. */
export default function GenerusLoginPage() {
  return (
    <HalamanMasuk jenis="generus">
      <FormMasukGenerus />
    </HalamanMasuk>
  );
}
