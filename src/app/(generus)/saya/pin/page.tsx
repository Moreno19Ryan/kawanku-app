import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { FormGantiPin } from "@/components/generus/form-ganti-pin";
import { Card } from "@/components/ui/card";
import { wajibGenerus } from "@/lib/generus/akun";
import { tujuanGenerus } from "@/lib/generus/tujuan";
import { Memuat } from "@/components/ui/memuat";

export const metadata: Metadata = {
  title: "Ganti PIN",
};

export default function PinPage({ searchParams }: PageProps<"/saya/pin">) {
  return (
    <Suspense fallback={<Memuat className="mt-8 h-80" />}>
      <GantiPin cari={searchParams} />
    </Suspense>
  );
}

async function GantiPin({ cari }: { cari: Promise<Record<string, string | string[] | undefined>> }) {
  const [generus, param] = await Promise.all([wajibGenerus({ bolehPinAwal: true }), cari]);
  const next = Array.isArray(param.next) ? param.next[0] : param.next;
  return (
    <div className="flex flex-col gap-4 pt-6">
      {!generus.pinAwal && (
        <Link href="/saya/profil" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="size-4" aria-hidden />
          Profil saya
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">Ganti PIN</h1>
      {generus.pinAwal && (
        <p className="rounded-card bg-primary-soft px-4 py-3 text-sm text-primary">
          Kamu masih memakai PIN awal dari admin (tanggal lahir). Ganti dulu dengan PIN pilihanmu supaya akunmu
          aman.
        </p>
      )}
      <Card>
        <FormGantiPin tujuan={tujuanGenerus(next)} />
      </Card>
      <p className="px-1 text-xs text-muted">
        Jangan pakai tanggal lahir atau angka berurutan. Jangan beri tahu PIN ke siapa pun.
      </p>
    </div>
  );
}
