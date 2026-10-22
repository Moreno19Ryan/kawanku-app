-- =====================================================================
-- Tes migrasi 20261022100000_realtime: tabel yang disiarkan Realtime, dan
-- tabel data pribadi yang sengaja tidak disiarkan.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  (select count(*) = 20 from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('jamaah', 'keluarga', 'kategori_jamaah', 'kelompok', 'absensi', 'sesi_absensi',
                       'kartu_qr', 'akun_generus', 'kegiatan', 'kegiatan_jadwal', 'pertemuan',
                       'pengumuman', 'pengajuan_izin', 'usulan_koreksi', 'fitur', 'fitur_kelompok',
                       'pengaturan_sistem', 'perubahan_data_generus', 'pengajar', 'pertemuan_materi')),
  'Realtime: 20 tabel aplikasi disiarkan');
select ok(
  not exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime' and schemaname = 'public'
                and tablename in ('jamaah_kontak', 'jamaah_pribadi', 'jamaah_identitas', 'jamaah_janda_duda',
                                  'jamaah_keringanan', 'admin', 'penugasan_peran', 'sesi_layar')),
  'Realtime: tabel data pribadi & akses tidak disiarkan');
select ok(
  (select bool_and(c.relrowsecurity) from pg_publication_tables t
   join pg_class c on c.relname = t.tablename
   join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
   where t.pubname = 'supabase_realtime' and t.schemaname = 'public'),
  'Realtime: semua tabel yang disiarkan memakai RLS');

select * from finish();
rollback;
