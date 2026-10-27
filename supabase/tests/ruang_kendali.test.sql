-- =====================================================================
-- Tes migrasi 20261101090000_ruang_kendali: kesehatan sistem, tugas
-- otomatis (jalankan/atur), pembersihan riwayat, dan galat yang digeser
-- saat penuh. Hanya pengembang. Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema uji;
grant usage on schema uji to anon, authenticated;
create table uji.hasil (no serial primary key, nama text not null, lulus boolean not null, catatan text);
grant insert, select on uji.hasil to anon, authenticated;
grant usage on sequence uji.hasil_no_seq to anon, authenticated;

create function uji.cek(p_nama text, p_kondisi boolean) returns void language plpgsql as $$
begin
  insert into uji.hasil (nama, lulus) values (p_nama, coalesce(p_kondisi, false));
end $$;

-- Lulus bila p_sql GAGAL atau tidak mengubah baris apa pun (RLS diam-diam
-- menyaring update/delete). p_sql harus diakhiri `returning 1` untuk
-- update/delete supaya jumlah baris bisa dihitung.
create function uji.harus_ditolak(p_nama text, p_sql text)
returns void language plpgsql as $$
declare v_pesan text; v_baris int;
begin
  begin
    execute 'with t as (' || p_sql || ') select count(*) from t' into v_baris;
    raise exception 'BARIS:%', v_baris;
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (
    p_nama, v_pesan not like 'BARIS:%' or v_pesan = 'BARIS:0', v_pesan);
end $$;

-- Lulus bila p_sql mengubah minimal satu baris (efeknya dibatalkan).
create function uji.harus_berhasil(p_nama text, p_sql text)
returns void language plpgsql as $$
declare v_pesan text; v_baris int;
begin
  begin
    execute 'with t as (' || p_sql || ') select count(*) from t' into v_baris;
    raise exception 'BARIS:%', v_baris;
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (
    p_nama, v_pesan like 'BARIS:%' and v_pesan <> 'BARIS:0', v_pesan);
end $$;

create function uji.sebagai(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, true);
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema uji to anon, authenticated;

grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';

-- Struktur
select uji.cek('Tugas kawanku-bersihkan terjadwal',
  exists (select 1 from cron.job where jobname = 'kawanku-bersihkan' and active));
select uji.cek('anon tidak boleh menjalankan kesehatan_sistem',
  not has_function_privilege('anon', 'public.kesehatan_sistem()', 'execute'));
select uji.cek('anon tidak boleh menjalankan jalankan_tugas',
  not has_function_privilege('anon', 'public.jalankan_tugas(text)', 'execute'));
select uji.cek('authenticated tidak boleh memanggil bersihkan_riwayat langsung',
  not has_function_privilege('authenticated', 'private.bersihkan_riwayat()', 'execute'));

-- Pembersihan riwayat: hanya yang lama
insert into cron.job_run_details (jobid, runid, command, status, start_time, end_time)
select jobid, 900000001, 'uji', 'succeeded', now() - interval '10 days', now() - interval '10 days'
from cron.job where jobname = 'kawanku-buka-absensi';
insert into cron.job_run_details (jobid, runid, command, status, return_message, start_time, end_time)
select jobid, 900000002, 'uji', 'failed', 'galat uji', now() - interval '1 hour', now() - interval '1 hour'
from cron.job where jobname = 'kawanku-buka-absensi';
insert into public.notifikasi_terkirim (user_id, kunci, created_at) values
  ('00000000-0000-0000-0000-0000000000a5', 'lama', now() - interval '100 days'),
  ('00000000-0000-0000-0000-0000000000a5', 'baru', now());
select private.bersihkan_riwayat();
select uji.cek('Riwayat tugas > 7 hari terhapus',
  not exists (select 1 from cron.job_run_details where runid = 900000001));
select uji.cek('Riwayat tugas baru tetap ada',
  exists (select 1 from cron.job_run_details where runid = 900000002));
select uji.cek('Catatan notifikasi > 90 hari terhapus, yang baru tetap',
  (select array_agg(kunci order by kunci) = array['baru'] from public.notifikasi_terkirim
   where user_id = '00000000-0000-0000-0000-0000000000a5'));

-- Galat penuh: galat lama yang sudah dicek digeser
insert into public.galat_aplikasi (sidik, sumber, pesan, terakhir_at, dicek_at)
select 's' || g, 'server', 'galat ' || g, now() - (g || ' minutes')::interval,
       case when g = 499 then now() end
from generate_series(0, 499) g;
select public.catat_galat('server', 'Galat baru saat penuh', '/x', 'render', null);
select uji.cek('Penuh: galat baru tetap tercatat',
  exists (select 1 from public.galat_aplikasi where pesan = 'Galat baru saat penuh'));
select uji.cek('Penuh: galat lama yang sudah dicek digeser',
  not exists (select 1 from public.galat_aplikasi where sidik = 's499'));
select uji.cek('Penuh: jumlah tetap 500', (select count(*) = 500 from public.galat_aplikasi));
select public.catat_galat('server', 'Galat kedua saat penuh', '/x', 'render', null);
select uji.cek('Penuh & semua belum dicek: galat baru diabaikan',
  not exists (select 1 from public.galat_aplikasi where pesan = 'Galat kedua saat penuh'));

-- Akses
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.harus_ditolak('Admin desa: kesehatan_sistem ditolak', $q$ select 1 from public.kesehatan_sistem() $q$);
select uji.harus_ditolak('Admin desa: jalankan_tugas ditolak',
  $q$ select 1 from public.jalankan_tugas('kawanku-bersihkan') $q$);
select uji.harus_ditolak('Admin desa: atur_tugas ditolak',
  $q$ select 1 from public.atur_tugas('kawanku-kirim-notifikasi', false) $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Pengembang: kesehatan memuat 5 tugas KawanKu',
  (select jsonb_array_length(public.kesehatan_sistem() -> 'tugas') = 5));
select uji.cek('Pengembang: gagal 24 jam terhitung',
  (select (t ->> 'gagal_24j')::int = 1 and t ->> 'terakhir_pesan' = 'galat uji'
   from jsonb_array_elements(public.kesehatan_sistem() -> 'tugas') t
   where t ->> 'nama' = 'kawanku-buka-absensi'));
select uji.cek('Pengembang: galat baru terhitung',
  (select (public.kesehatan_sistem() -> 'galat' ->> 'baru')::int = 500));
select uji.cek('Pengembang: ukuran database terbaca',
  (select (public.kesehatan_sistem() ->> 'database_byte')::bigint > 0));
select uji.harus_berhasil('Pengembang: jalankan buka absensi',
  $q$ select public.jalankan_tugas('kawanku-buka-absensi') $q$);
select uji.harus_ditolak('Pengembang: tugas tak dikenal ditolak',
  $q$ select public.jalankan_tugas('hapus-semua') $q$);
select uji.harus_ditolak('Pengembang: atur tugas di luar KawanKu ditolak',
  $q$ select 1 from public.atur_tugas('tugas-lain', false) $q$);
select public.atur_tugas('kawanku-kirim-notifikasi', false);
reset role;
select uji.cek('Pengembang: tugas bisa dimatikan',
  (select not active from cron.job where jobname = 'kawanku-kirim-notifikasi'));
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select public.atur_tugas('kawanku-kirim-notifikasi', true);
reset role;
select uji.cek('Pengembang: tugas bisa dinyalakan lagi',
  (select active from cron.job where jobname = 'kawanku-kirim-notifikasi'));

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 23, 'Jumlah skenario ruang kendali');
select * from finish();
rollback;
