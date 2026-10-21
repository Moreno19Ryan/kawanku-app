import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { KembaliKePengaturan } from "@/components/pengaturan/kembali";
import { PilihTema } from "@/components/tema/pilih-tema";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Tampilan",
};

export default function TampilanPage() {
  return (
    <>
      <KembaliKePengaturan />
      <PageHeader title="Tampilan" />
      <Card>
        <h2 className="text-lg font-semibold">Tema</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Disimpan di perangkat ini saja. &ldquo;Ikut perangkat&rdquo; mengikuti setelan terang/gelap
          HP atau laptop.
        </p>
        <PilihTema />
      </Card>
    </>
  );
}
