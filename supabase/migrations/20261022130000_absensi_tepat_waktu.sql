-- =====================================================================
-- KawanKu: absensi hanya dibuka menjelang pertemuan (22 Okt 2026)
-- =====================================================================
-- Temuan uji peran admin kelompok: absensi pertemuan 3 hari lagi bisa
-- dibuka sekarang, sehingga kartu/QR bisa dipakai absen untuk pertemuan
-- yang belum terjadi. Sesi absensi (dari Kegiatan maupun "Buat sesi")
-- sekarang hanya bisa dibuat paling cepat 2 jam sebelum waktu mulainya.
-- Sesi yang sudah lewat tetap boleh dibuat (mencatat susulan).
-- =====================================================================

create or replace function private.cek_waktu_sesi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mulai > now() + interval '2 hours' then
    raise exception 'Absensi bisa dibuka paling cepat 2 jam sebelum mulai'
      using errcode = '22023', hint = 'belum_waktunya';
  end if;
  return new;
end;
$$;

create trigger cek_waktu_sesi before insert on public.sesi_absensi
  for each row execute function private.cek_waktu_sesi();
