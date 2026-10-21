import { getPengumumanTayang } from "@/lib/sistem/data";
import { DaftarPengumuman } from "./daftar-pengumuman";

/** Pengumuman yang sedang tayang, di atas isi halaman. Di dalam <Suspense>. */
export async function BannerPengumuman() {
  const pengumuman = await getPengumumanTayang();
  if (pengumuman.length === 0) return null;
  return <DaftarPengumuman pengumuman={pengumuman.map(({ id, pesan, nada }) => ({ id, pesan, nada }))} />;
}
