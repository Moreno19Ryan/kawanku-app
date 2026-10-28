import { LogOut } from "lucide-react";
import { getGenerusSaatIni } from "@/lib/generus/akun";
import { keluarGenerus } from "@/lib/generus/actions";

/**
 * Info akun jamaah di menu samping laptop + tombol keluar. Membaca sesi,
 * jadi di dalam <Suspense>. Penjaga akses tetap wajibGenerus() di halaman.
 */
export async function AkunGenerus() {
  const generus = await getGenerusSaatIni();
  if (!generus) return null;
  const nama = generus.jamaah.panggilan ?? generus.jamaah.nama;
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft font-semibold text-primary">
        {nama.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{nama}</p>
        <p className="truncate text-xs text-muted">
          {[generus.jamaah.kelompok, `@${generus.username}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <form action={keluarGenerus}>
        <button
          type="submit"
          aria-label="Keluar"
          title="Keluar"
          className="flex size-10 items-center justify-center rounded-pill text-muted transition-colors duration-200 ease-oneui hover:bg-surface-muted hover:text-fg"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
