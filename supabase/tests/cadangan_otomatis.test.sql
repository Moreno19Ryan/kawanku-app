-- =====================================================================
-- Tes migrasi 20261029090000_cadangan_otomatis: cadangan terenkripsi,
-- rotasi, pemeriksaan, pemulihan per baris, notifikasi pengembang. Di-rollback.
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

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select '00000000-0000-0000-0000-0000000000f1', id, 'Ahmad Rahasia', 'L', 'x', 'menikah', 'bekerja', 1980
from public.kelompok where nomor = 1;

select uji.cek('Kunci cadangan ada di Vault', exists (select 1 from vault.secrets where name = 'kawanku_cadangan_kunci'));
select uji.cek('pg_cron: cadangan tiap 02.00 WIB',
  exists (select 1 from cron.job where jobname = 'kawanku-cadangan' and schedule = '0 19 * * *'));

create temp table c1 as select private.buat_cadangan('harian') as id;
select uji.cek('Cadangan harian berhasil, banyak tabel, ada jamaah',
  (select status = 'berhasil' and jumlah_tabel > 20 and jumlah_baris > 0 and ukuran_byte > 0
   from public.cadangan where id = (select id from c1)));
select uji.cek('Tabel teknis tidak ikut', not exists (
  select 1 from private.cadangan_isi where cadangan_id = (select id from c1)
    and tabel in ('galat_aplikasi', 'langganan_notifikasi', 'cadangan', 'tempat_sampah')));
select uji.cek('Isi terenkripsi (nama tidak terbaca)', not exists (
  select 1 from private.cadangan_isi where cadangan_id = (select id from c1)
    and position(convert_to('Ahmad Rahasia', 'UTF8') in isi) > 0));
select uji.cek('Pemeriksaan: cocok', private.periksa_cadangan((select id from c1)) = 'cocok');

-- Rotasi: simpan 2 harian.
update public.cadangan_jadwal set simpan = 2 where jenis = 'harian';
select private.buat_cadangan('harian');
select private.buat_cadangan('harian');
select uji.cek('Rotasi: hanya 2 harian disimpan, yang tertua terhapus',
  (select count(*) = 2 from public.cadangan where jenis = 'harian')
  and not exists (select 1 from public.cadangan where id = (select id from c1)));

-- Jadwal: Ahad → harian + mingguan; 1 Januari 2027 (Jumat) → harian + bulanan + tahunan.
select uji.cek('Ahad: harian + mingguan',
  private.cadangan_terjadwal(timestamptz '2026-11-08 02:00+07') = 2);
select uji.cek('1 Januari: harian + bulanan + tahunan',
  private.cadangan_terjadwal(timestamptz '2027-01-01 02:00+07') = 3);
select uji.cek('Tanggal 1: cadangan terakhir ikut diperiksa',
  (select hasil_periksa = 'cocok' from public.cadangan order by created_at desc limit 1));
update public.cadangan_jadwal set aktif = false where jenis = 'harian';
select uji.cek('Jadwal dimatikan tidak jalan', private.cadangan_terjadwal(timestamptz '2026-11-03 02:00+07') = 0);

-- Isi dirusak → pemeriksaan rusak + notifikasi sistem.
create temp table c2 as select id from public.cadangan where jenis = 'tahunan' limit 1;
update private.cadangan_isi set isi = convert_to('rusak', 'UTF8') where cadangan_id = (select id from c2) and tabel = 'jamaah';
select uji.cek('Cadangan rusak terdeteksi', private.periksa_cadangan((select id from c2)) = 'rusak');
select uji.cek('Notifikasi sistem tercatat', exists (select 1 from public.notifikasi_sistem where kunci like 'cadangan-rusak:%'));

-- Hak akses: admin desa & anon tidak bisa apa-apa.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin desa: tidak melihat daftar cadangan', not exists (select 1 from public.cadangan));
select uji.harus_ditolak('Admin desa: tidak bisa cadangkan sekarang', $q$ select public.cadangkan_sekarang() $q$);
select uji.harus_ditolak('Admin desa: tidak bisa mengubah jadwal',
  $q$ update public.cadangan_jadwal set simpan = 1 returning 1 $q$);
select uji.harus_ditolak('Admin desa: tidak bisa membaca isi cadangan',
  $q$ select * from public.cari_di_cadangan((select id from public.cadangan limit 1), 'jamaah', '') $q$);
reset role;
set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memulihkan',
  $q$ select public.pulihkan_dari_cadangan(gen_random_uuid(), 'jamaah', 'x') $q$);
reset role;

-- Pengembang: cadangkan, cari, pulihkan baris yang diubah & yang dihapus.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
create temp table c3 as select public.cadangkan_sekarang() as id;
select uji.cek('Pengembang: cadangan manual berhasil',
  (select status = 'berhasil' and dibuat_oleh = auth.uid() from public.cadangan where id = (select id from c3)));
select uji.cek('Pengembang: jamaah bisa dipulihkan per baris, peran_izin tidak',
  (select bool_and(case tabel when 'jamaah' then bisa_dipulihkan when 'peran_izin' then not bisa_dipulihkan else true end)
   from public.tabel_dalam_cadangan((select id from c3))));
select uji.cek('Pengembang: cari di cadangan',
  (select count(*) = 1 from public.cari_di_cadangan((select id from c3), 'jamaah', 'rahasia')));
select uji.harus_ditolak('Tabel berkunci komposit ditolak',
  $q$ select * from public.cari_di_cadangan((select id from c3), 'peran_izin', '') $q$);
reset role;
update public.jamaah set nama_lengkap = 'Salah Ketik' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Perbandingan: cadangan vs sekarang',
  (select di_cadangan->>'nama_lengkap' = 'Ahmad Rahasia' and sekarang->>'nama_lengkap' = 'Salah Ketik'
   from public.cari_di_cadangan((select id from c3), 'jamaah', 'rahasia')));
select public.pulihkan_dari_cadangan((select id from c3), 'jamaah', '00000000-0000-0000-0000-0000000000f1');
reset role;
select uji.cek('Baris yang diubah dipulihkan',
  (select nama_lengkap = 'Ahmad Rahasia' from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1'));
delete from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select public.pulihkan_dari_cadangan((select id from c3), 'jamaah', '00000000-0000-0000-0000-0000000000f1');
reset role;
select uji.cek('Baris yang dihapus dipulihkan',
  exists (select 1 from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1' and nama_lengkap = 'Ahmad Rahasia'));
select uji.cek('Pemulihan tercatat (2)',
  (select count(*) = 2 and bool_and(oleh = '00000000-0000-0000-0000-0000000000a5') from public.pemulihan_cadangan));

-- Notifikasi pengembang lewat jalur notifikasi HP.
insert into public.langganan_notifikasi (user_id, endpoint, p256dh, auth_key)
values ('00000000-0000-0000-0000-0000000000a5', 'https://push.example/dev', 'k', 'a');
select uji.cek('Peringatan sistem ikut terkirim ke pengembang',
  exists (select 1 from private.notifikasi_jatuh_tempo()
          where user_id = '00000000-0000-0000-0000-0000000000a5' and kunci like 'sistem:cadangan-rusak:%'));
select uji.cek('Admin desa tidak dikirimi', not exists (
  select 1 from private.notifikasi_jatuh_tempo() where user_id = '00000000-0000-0000-0000-0000000000a1'));

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 26, 'Jumlah skenario cadangan');
select * from finish();
rollback;
