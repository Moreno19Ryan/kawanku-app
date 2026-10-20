import { LogOut } from "lucide-react";
import { keluar } from "@/lib/auth/actions";
import { labelPenugasan, wajibAdmin } from "@/lib/auth/admin";

/**
 * Info admin yang login + tombol keluar. Sekaligus penjaga area admin:
 * wajibAdmin() mengalihkan bila sesi bukan admin aktif. Harus di dalam
 * <Suspense> karena membaca cookie sesi.
 */
export async function AkunAdmin({ ringkas = false }: { ringkas?: boolean }) {
  const admin = await wajibAdmin();
  const peran = admin.penugasan.map(labelPenugasan).join(", ");
  const inisial = admin.nama.trim().charAt(0).toUpperCase();

  const tombolKeluar = (
    <form action={keluar}>
      <button
        type="submit"
        aria-label="Keluar"
        title="Keluar"
        className="flex size-10 items-center justify-center rounded-pill text-muted transition-colors duration-200 ease-oneui hover:bg-surface-muted hover:text-fg"
      >
        <LogOut className="size-5" aria-hidden />
      </button>
    </form>
  );

  if (ringkas) {
    return (
      <div className="flex items-center gap-1">
        <span
          title={`${admin.nama} (${peran})`}
          className="flex size-8 items-center justify-center rounded-pill bg-primary-soft text-sm font-semibold text-primary"
        >
          {inisial}
        </span>
        {tombolKeluar}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-soft font-semibold text-primary">
        {inisial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{admin.nama}</p>
        <p className="truncate text-xs text-muted" title={peran}>
          {peran}
        </p>
      </div>
      {tombolKeluar}
    </div>
  );
}
