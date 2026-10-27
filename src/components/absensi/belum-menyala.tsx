import { Card } from "@/components/ui/card";

/** Ditampilkan bila modul Absensi belum dinyalakan / tidak ada wewenang. */
export function AbsensiBelumMenyala() {
  return (
    <Card className="mt-10 text-center">
      <p className="text-lg font-semibold">Modul Absensi belum tersedia</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Modul ini dinyalakan bertahap per kelompok, atau peran akun ini belum mencakup absensi. Bila
        seharusnya sudah bisa dibuka, silakan hubungi admin desa.
      </p>
    </Card>
  );
}
