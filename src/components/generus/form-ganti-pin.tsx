"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { gantiPin } from "@/lib/generus/actions";

export function FormGantiPin({ tujuan }: { tujuan: string }) {
  const [state, onSubmit, pending] = useFormAksi(gantiPin);
  const pin = {
    type: "password",
    required: true,
    inputMode: "numeric" as const,
    pattern: "\\d{6}",
    maxLength: 6,
    autoComplete: "new-password",
    className: `${INPUT_CLASS} tracking-[0.4em]`,
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="tujuan" value={tujuan} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">PIN baru (6 angka)</span>
        <input name="pin" {...pin} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Ulangi PIN baru</span>
        <input name="ulang" {...pin} />
      </label>
      <PesanAksi state={state} />
      <button type="submit" disabled={pending} className={buttonClass("utama", "h-12")}>
        {pending ? "Menyimpan…" : "Simpan PIN"}
      </button>
    </form>
  );
}
