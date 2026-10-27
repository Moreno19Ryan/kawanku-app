-- =====================================================================
-- Verifikasi dua langkah (MFA, aplikasi authenticator/TOTP)
-- (Reno, 27 Okt 2026)
--
-- Aplikasi mewajibkan akun pengembang (sistem.kelola) mendaftarkan MFA dan
-- memasukkan kode 6 angka setiap masuk. Database ikut menjaga: akun yang
-- SUDAH punya MFA terverifikasi hanya bisa membaca/mengubah data bila
-- sesinya sudah melewati kode (aal2). Jadi kata sandi yang bocor saja
-- tidak cukup untuk membuka data lewat API.
--
-- Akun tanpa MFA (admin lain, generus) tidak terpengaruh.
--
-- Tabel public baru WAJIB ikut diberi kebijakan `wajib_aal2` (lihat
-- blok do di bawah; CLAUDE.md).
-- =====================================================================

-- Sesi ini sudah cukup kuat: aal2, atau akunnya memang belum punya MFA.
create function private.aal_cukup() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;
revoke all on function private.aal_cukup() from public, anon;
grant execute on function private.aal_cukup() to authenticated;

-- Kebijakan RESTRICTIVE di semua tabel public: digabung (AND) dengan
-- kebijakan yang sudah ada, jadi tidak membuka akses baru apa pun.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy wajib_aal2 on public.%I as restrictive for all to authenticated
         using ((select private.aal_cukup())) with check ((select private.aal_cukup()))',
      t.tablename);
  end loop;
end $$;

-- RPC khusus pengembang (security definer, melewati RLS) juga wajib aal2
-- bila akunnya sudah punya MFA.
create or replace function private.wajib_pengembang() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.boleh('sistem.kelola', null) then
    raise exception 'Khusus pengembang' using errcode = '42501';
  end if;
  if not private.aal_cukup() then
    raise exception 'Perlu verifikasi dua langkah' using errcode = '42501', hint = 'perlu_aal2';
  end if;
end;
$$;
revoke all on function private.wajib_pengembang() from public, anon, authenticated;
