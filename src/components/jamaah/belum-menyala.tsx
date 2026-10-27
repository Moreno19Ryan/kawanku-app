import { Card } from "@/components/ui/card";

/** Ditampilkan bila modul Jamaah belum dinyalakan / tidak ada wewenang. */
export function JamaahBelumMenyala() {
  return (
    <Card className="mt-10 text-center">
      <p className="text-lg font-semibold">Modul Jamaah belum tersedia</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Modul ini dinyalakan bertahap per kelompok, atau peran akun ini belum mencakup data jamaah.
        Bila seharusnya sudah bisa dibuka, silakan hubungi admin desa.
      </p>
    </Card>
  );
}
