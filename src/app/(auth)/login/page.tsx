import type { Metadata } from "next";
import { BrandMark } from "@/components/layout/brand-mark";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masuk Admin",
};

/**
 * Kerangka login admin. Belum tersambung ke Supabase Auth; form sengaja
 * dinonaktifkan. Login generus (username + PIN) akan punya halaman terpisah.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-gutter py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark height={36} />
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Masuk Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Khusus admin desa, kelompok, dan generus.
          </p>

          <form className="mt-6 flex flex-col gap-4">
            <fieldset disabled className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="admin@contoh.id"
                  className="h-12 rounded-control border border-border bg-surface-muted px-4 text-base outline-none transition-colors placeholder:text-muted/70 focus:border-primary disabled:opacity-60"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Kata sandi</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className="h-12 rounded-control border border-border bg-surface-muted px-4 text-base outline-none transition-colors focus:border-primary disabled:opacity-60"
                />
              </label>

              <button
                type="submit"
                className="mt-2 h-12 rounded-pill bg-primary font-semibold text-primary-fg transition-opacity duration-200 ease-oneui disabled:opacity-50"
              >
                Masuk
              </button>
            </fieldset>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            Login belum aktif (kerangka Fase 0).
          </p>
        </Card>
      </div>
    </div>
  );
}
