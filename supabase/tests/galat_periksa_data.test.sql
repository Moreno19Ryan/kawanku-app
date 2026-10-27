-- =====================================================================
-- Tes migrasi 20261101130000_galat_periksa_data: notifikasi galat baru
-- (maks. 3/jam), periksa_data & perbaiki_data (hanya pengembang).
-- Satu transaksi, di-rollback.
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
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a5'),
  ('00000000-0000-0000-0000-0000000000b1');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';
delete from public.notifikasi_sistem;

-- 1. Notifikasi galat baru
set local role anon;
select public.catat_galat('server', 'Galat A', '/a', 'render', null);
select public.catat_galat('server', 'Galat A', '/a', 'render', null);  -- berulang: tidak dikirim lagi
select public.catat_galat('server', 'Galat B', '/b', 'render', null);
select public.catat_galat('klien', 'Galat C', '/c', 'klien', null);
select public.catat_galat('klien', 'Galat D', '/d', 'klien', null);  -- ke-4 dalam 1 jam: tidak dikirim
reset role;
select uji.cek('Galat baru dikirim ke HP pengembang, maks. 3 per jam',
  (select count(*) = 3 from public.notifikasi_sistem where kunci like 'galat:%'));
select uji.cek('Isi notifikasi memuat rute & pesan',
  exists (select 1 from public.notifikasi_sistem where isi = '/a: Galat A' and url = '/pengaturan/sistem'));

-- 2. Pemeriksaan data
insert into public.kelompok (nama, nomor) values ('Kelompok Periksa', 93);
insert into public.jamaah (nama_lengkap, jenis_kelamin, kelompok_id, tahun_lahir, status_pernikahan, status_sekolah, aktif)
select 'Generus Pindah', 'L', id, 2008, 'lajang', 'sma_smk', false from public.kelompok where nomor = 93;
insert into public.akun_generus (user_id, jamaah_id, username)
select '00000000-0000-0000-0000-0000000000b1', id, 'pindah' from public.jamaah where nama_lengkap = 'Generus Pindah';
insert into public.keluarga (kelompok_id, nama) select id, 'Keluarga Kosong' from public.kelompok where nomor = 93;
insert into public.langganan_notifikasi (user_id, endpoint, p256dh, auth_key, aktif, updated_at)
values ('00000000-0000-0000-0000-0000000000a5', 'https://push.contoh/lama', 'x', 'y', false, now() - interval '40 days');

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.harus_ditolak('Admin desa: periksa_data ditolak', $q$ select 1 from public.periksa_data() $q$);
select uji.harus_ditolak('Admin desa: perbaiki_data ditolak',
  $q$ select 1 from public.perbaiki_data('langganan_mati') $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Temuan: akun generus dengan jamaah nonaktif',
  (select jumlah = 1 and contoh = 'Generus Pindah' and bisa_diperbaiki
   from public.periksa_data() where kode = 'akun_generus_jamaah_nonaktif'));
select uji.cek('Temuan: keluarga kosong',
  (select jumlah >= 1 and contoh like '%Keluarga Kosong%' from public.periksa_data() where kode = 'keluarga_kosong'));
select uji.cek('Temuan: langganan mati', (select jumlah = 1 from public.periksa_data() where kode = 'langganan_mati'));
select uji.cek('Semua pemeriksaan selalu tampil (8 butir)', (select count(*) = 8 from public.periksa_data()));
select uji.cek('Perbaiki akun generus: 1 dinonaktifkan',
  (select public.perbaiki_data('akun_generus_jamaah_nonaktif') = 1));
select uji.cek('Perbaiki langganan mati: 1 dihapus', (select public.perbaiki_data('langganan_mati') = 1));
select uji.cek('Setelah perbaikan: temuan jadi 0',
  (select bool_and(jumlah = 0) from public.periksa_data() where kode in ('akun_generus_jamaah_nonaktif', 'langganan_mati')));
select uji.harus_ditolak('Kode yang tidak aman tidak bisa diperbaiki otomatis',
  $q$ select 1 from public.perbaiki_data('keluarga_kosong') $q$);
reset role;
select uji.cek('Akun generus benar-benar nonaktif',
  (select not aktif from public.akun_generus where username = 'pindah'));

set local role anon;
select uji.harus_ditolak('Anon: periksa_data ditolak', $q$ select 1 from public.periksa_data() $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 14, 'Jumlah skenario galat & periksa data');
select * from finish();
rollback;
