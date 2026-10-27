import { Mail, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KONTAK_PENGEMBANG as K } from "@/lib/kontak";

/** Tombol WhatsApp & email ke pengembang (membuka aplikasi WA / email). */
export function TombolKontakPengembang({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <a href={K.whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("utama")}>
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp {K.whatsapp}
      </a>
      <a href={K.emailUrl} className={buttonClass("kedua", "min-w-0")}>
        <Mail className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{K.email}</span>
      </a>
    </div>
  );
}

/** Kartu "Ada kendala dengan aplikasi?" untuk halaman Bantuan. */
export function KartuKontakPengembang() {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Ada kendala dengan aplikasi?</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Aplikasi error, tidak bisa dibuka, atau ada fitur yang tidak berjalan semestinya? Hubungi
        pengembang. Mohon sertakan nama akun, halaman yang dibuka, dan tangkapan layar bila ada.
      </p>
      <TombolKontakPengembang />
    </Card>
  );
}

/** Satu baris tautan ringkas (halaman login, perawatan, galat). */
export function BarisKontakPengembang({ awalan = "Ada kendala?" }: { awalan?: string }) {
  return (
    <p className="text-sm text-muted">
      {awalan} Hubungi pengembang lewat{" "}
      <a href={K.whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-medium whitespace-nowrap text-primary hover:underline">
        WhatsApp {K.whatsapp}
      </a>{" "}
      atau{" "}
      <a href={K.emailUrl} className="font-medium whitespace-nowrap text-primary hover:underline">
        {K.email}
      </a>
      .
    </p>
  );
}
