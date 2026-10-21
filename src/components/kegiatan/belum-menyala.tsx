import { Card } from "@/components/ui/card";

export function KegiatanBelumMenyala() {
  return (
    <Card className="mt-10 text-center">
      <p className="text-lg font-semibold">Modul Kegiatan belum tersedia untukmu</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Modul ini dinyalakan bertahap per kelompok, atau peranmu tidak mencakup kegiatan. Hubungi admin desa bila
        kamu seharusnya sudah bisa membukanya.
      </p>
    </Card>
  );
}
