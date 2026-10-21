-- =====================================================================
-- Tes migrasi 20261022060000_kenaikan_kelas: kolom kelas (jenjang &
-- tahun ajaran otomatis), RPC terapkan_kenaikan_kelas (RLS, tidak naik dua
-- kali), dan catatan kenaikan_kelas. Satu transaksi, di-rollback.
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

create function uji.beri(p_user uuid, p_peran text, p_nomor int) returns void language sql as $$
  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select p_user, p.id, (select id from public.kelompok where nomor = p_nomor)
  from public.peran p where p.kode = p_peran;
$$;
create function uji.kelompok(p_nomor int) returns uuid language sql as $$
  select id from public.kelompok where nomor = p_nomor;
$$;
create function uji.naik(p_nomor int, p_isi jsonb) returns integer language sql as $$
  select public.terapkan_kenaikan_kelas(uji.kelompok(p_nomor), p_isi);
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000b2', 'kel1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b3', 'kel2@uji.id'),
  ('00000000-0000-0000-0000-0000000000b4', 'gen1@uji.id');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000b1', 'Desa'), ('00000000-0000-0000-0000-0000000000b2', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000b3', 'Kelompok 2'), ('00000000-0000-0000-0000-0000000000b4', 'Generus K1');
select uji.beri('00000000-0000-0000-0000-0000000000b1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000b2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000b3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000b4', 'admin_generus', 1);

-- f1 SD kelas 4 K1, f2 SMP kelas 9 K1, f3 SMA kelas 12 K1, f4 SD kelas 2 K2,
-- f5 SD tanpa kelas K1, f6 SMP kelas 8 K1
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir, kelas)
select v.id::uuid, uji.kelompok(v.nomor), v.nama, 'L', 'x', 'lajang', v.sekolah::public.status_sekolah, v.tahun, v.kelas
from (values
  ('00000000-0000-0000-0000-0000000000f1', 1, 'SD Empat',     'sd',      2016, 4),
  ('00000000-0000-0000-0000-0000000000f2', 1, 'SMP Sembilan', 'smp',     2011, 9),
  ('00000000-0000-0000-0000-0000000000f3', 1, 'SMA Duabelas', 'sma_smk', 2008, 12),
  ('00000000-0000-0000-0000-0000000000f4', 2, 'SD Dua K2',    'sd',      2018, 2),
  ('00000000-0000-0000-0000-0000000000f5', 1, 'SD Kosong',    'sd',      2017, null),
  ('00000000-0000-0000-0000-0000000000f6', 1, 'SMP Delapan',  'smp',     2012, 8)
) v(id, nomor, nama, sekolah, tahun, kelas);

select uji.cek('tahun_ajaran: 30 Juni → tahun sebelumnya', private.tahun_ajaran('2026-06-30') = 2025);
select uji.cek('tahun_ajaran: 1 Juli → tahun itu', private.tahun_ajaran('2026-07-01') = 2026);
select uji.cek('Insert kelas → kelas_tahun = tahun ajaran berjalan',
  (select kelas_tahun from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1')
    = private.tahun_ajaran((now() at time zone 'Asia/Jakarta')::date));
select uji.cek('Tanpa kelas → kelas_tahun kosong',
  (select kelas_tahun is null from public.jamaah where id = '00000000-0000-0000-0000-0000000000f5'));
select uji.harus_ditolak('Kelas tidak sesuai jenjang (SMP kelas 3) ditolak',
  $q$ update public.jamaah set kelas = 3 where id = '00000000-0000-0000-0000-0000000000f2' returning 1 $q$);
select uji.harus_ditolak('Kelas di luar 1–12 ditolak',
  $q$ update public.jamaah set kelas = 13 where id = '00000000-0000-0000-0000-0000000000f3' returning 1 $q$);
update public.jamaah set status_sekolah = 'bekerja' where id = '00000000-0000-0000-0000-0000000000f3';
select uji.cek('Lulus (status bekerja) → kelas otomatis kosong',
  (select kelas is null and kelas_tahun is null from public.jamaah where id = '00000000-0000-0000-0000-0000000000f3'));
update public.jamaah set status_sekolah = 'sma_smk', kelas = 12 where id = '00000000-0000-0000-0000-0000000000f3';
select uji.cek('View jamaah_dengan_kategori memuat kelas',
  (select kelas from public.jamaah_dengan_kategori where id = '00000000-0000-0000-0000-0000000000f2') = 9);

-- Anggap kelas yang tercatat milik tahun ajaran lalu.
update public.jamaah set kelas_tahun = kelas_tahun - 1 where kelas is not null;

-- ---------------------------------------------------------------------
-- RPC sebagai admin kelompok 1
-- ---------------------------------------------------------------------
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('Admin K1: terapkan 4 perubahan (naik, SMP→SMA, lulus, isi kelas) → 4',
  uji.naik(1, '[
    {"id":"00000000-0000-0000-0000-0000000000f1","status_sekolah":"sd","kelas":5},
    {"id":"00000000-0000-0000-0000-0000000000f2","status_sekolah":"sma_smk","kelas":10},
    {"id":"00000000-0000-0000-0000-0000000000f3","status_sekolah":"kuliah","kelas":null},
    {"id":"00000000-0000-0000-0000-0000000000f5","status_sekolah":"sd","kelas":3}
  ]') = 4);
select uji.cek('Hasil: SD 5, SMA 10, kuliah tanpa kelas, SD 3',
  (select array_agg(status_sekolah::text || ':' || coalesce(kelas::text, '-') order by id) from public.jamaah
   where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
                '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f5'))
  = array['sd:5', 'sma_smk:10', 'kuliah:-', 'sd:3']);
select uji.cek('Diterapkan ulang tahun yang sama → 0 (tidak naik dua kali)',
  uji.naik(1, '[{"id":"00000000-0000-0000-0000-0000000000f1","status_sekolah":"sd","kelas":6}]') = 0
  and (select kelas from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1') = 5);
select uji.cek('Catatan kenaikan_kelas K1: jumlah 4, oleh admin K1',
  (select jumlah = 4 and created_by = '00000000-0000-0000-0000-0000000000b2'
   from public.kenaikan_kelas where kelompok_id = uji.kelompok(1)));
select uji.cek('Admin K1: jamaah K2 tidak tersentuh',
  uji.naik(1, '[{"id":"00000000-0000-0000-0000-0000000000f4","status_sekolah":"sd","kelas":3}]') = 0);
select uji.cek('Admin K1: lewat id kelompok K2 pun tidak tersentuh',
  uji.naik(2, '[{"id":"00000000-0000-0000-0000-0000000000f4","status_sekolah":"sd","kelas":3}]') = 0
  and (select count(*) from public.jamaah where id = '00000000-0000-0000-0000-0000000000f4') = 0);
select uji.harus_ditolak('Admin K1: tidak bisa mencatat kenaikan K2',
  $q$ insert into public.kenaikan_kelas (kelompok_id, tahun) values (uji.kelompok(2), 2026) returning 1 $q$);
select uji.harus_ditolak('Admin K1: kelas tidak sesuai jenjang lewat RPC ditolak',
  $q$ select uji.naik(1, '[{"id":"00000000-0000-0000-0000-0000000000f6","status_sekolah":"smp","kelas":11}]') $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000b3');
select uji.cek('Admin K2: tidak melihat catatan K1',
  not exists (select 1 from public.kenaikan_kelas where kelompok_id = uji.kelompok(1)));
select uji.cek('Admin K2: menaikkan jamaah K2 → 1',
  uji.naik(2, '[{"id":"00000000-0000-0000-0000-0000000000f4","status_sekolah":"sd","kelas":3}]') = 1);

select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.cek('Admin desa: melihat catatan semua kelompok',
  (select count(*) from public.kenaikan_kelas) = 2);
reset role;

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memanggil terapkan_kenaikan_kelas',
  $q$ select public.terapkan_kenaikan_kelas(gen_random_uuid(), '[]') $q$);
select uji.harus_ditolak('Anon: tidak bisa membaca kenaikan_kelas', $q$ select 1 from public.kenaikan_kelas $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 20, 'Jumlah skenario kenaikan kelas');
select * from finish();
rollback;
