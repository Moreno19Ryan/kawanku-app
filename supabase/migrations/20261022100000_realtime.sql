-- =====================================================================
-- KawanKu: Realtime supaya halaman terbarui sendiri tanpa refresh
-- =====================================================================
-- Aplikasi (SegarkanLangsung) mendengarkan perubahan tabel di bawah lewat
-- Supabase Realtime, lalu memuat ulang data halaman dari server. Realtime
-- tetap tunduk RLS: tiap pengguna hanya menerima kabar perubahan baris
-- yang boleh ia baca (untuk DELETE hanya id barisnya). Tabel data pribadi
-- (kontak, alamat, identitas, janda/duda) sengaja tidak disiarkan.
-- =====================================================================
do $$
declare
  v_tabel text;
begin
  foreach v_tabel in array array[
    'jamaah', 'keluarga', 'kategori_jamaah', 'kelompok',
    'absensi', 'sesi_absensi', 'kartu_qr', 'akun_generus',
    'kegiatan', 'kegiatan_jadwal', 'pertemuan',
    'pengumuman', 'pengajuan_izin', 'usulan_koreksi',
    'fitur', 'fitur_kelompok', 'pengaturan_sistem'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabel
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabel);
    end if;
  end loop;
end;
$$;
