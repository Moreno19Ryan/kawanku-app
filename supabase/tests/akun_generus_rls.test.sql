-- =====================================================================
-- Tes Fase 2b (migrasi 20261021200000_akun_generus_qr_layar): akun generus,
-- login (kunci 5x salah), privasi generus, token QR layar & absen_layar.
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

create function uji.beri(p_user uuid, p_peran text, p_nomor int) returns void language sql as $$
  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select p_user, p.id, (select id from public.kelompok where nomor = p_nomor)
  from public.peran p where p.kode = p_peran;
$$;
-- Token dengan waktu bebas (untuk uji kedaluwarsa), dibuat sebagai pemilik DB.
create function uji.token(p_sesi uuid, p_detik bigint) returns text language sql security definer as $$
  select p_sesi::text || '.' || p_detik || '.' ||
    translate(encode(substr(extensions.hmac(convert_to(p_sesi::text || '.' || p_detik, 'UTF8'),
      (select rahasia from public.sesi_layar where sesi_id = p_sesi), 'sha256'), 1, 16), 'base64'), '+/=', '-_');
$$;
create function uji.absen(p_token text) returns text language sql as $$
  select public.absen_layar(p_token) ->> 'hasil';
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000b2', 'kel1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b3', 'gen1@uji.id'),
  ('00000000-0000-0000-0000-0000000000c1', 'g-satu@generus.kawanku.invalid'),   -- akun generus K1
  ('00000000-0000-0000-0000-0000000000c2', 'g-dua@generus.kawanku.invalid'),    -- calon akun (dewasa)
  ('00000000-0000-0000-0000-0000000000c3', 'g-tiga@generus.kawanku.invalid');   -- calon akun (generus K2)
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000b1', 'Desa'), ('00000000-0000-0000-0000-0000000000b2', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000b3', 'Generus K1');
select uji.beri('00000000-0000-0000-0000-0000000000b1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000b2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000b3', 'admin_generus', 1);

-- f1 generus K1 (punya akun), f2 dewasa K1, f3 generus K2, f4 generus K1 lain
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select v.id::uuid, k.id, v.nama, 'L', 'x', v.nikah::public.status_pernikahan, v.sekolah::public.status_sekolah, v.tahun
from (values
  ('00000000-0000-0000-0000-0000000000f1', 1, 'Generus Satu', 'lajang',  'smp',     2012),
  ('00000000-0000-0000-0000-0000000000f2', 1, 'Dewasa K1',    'menikah', 'bekerja', 1985),
  ('00000000-0000-0000-0000-0000000000f3', 2, 'Generus K2',   'lajang',  'smp',     2012),
  ('00000000-0000-0000-0000-0000000000f4', 1, 'Generus Lain', 'lajang',  'sma_smk', 2009)
) v(id, nomor, nama, nikah, sekolah, tahun)
join public.kelompok k on k.nomor = v.nomor;
insert into public.akun_generus (user_id, jamaah_id, username)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'satu');

-- e1 sesi K1, e2 sesi K2, e3 sesi generus K1
insert into public.sesi_absensi (id, nama, kelompok_id, hanya_generus, mulai)
select v.id::uuid, v.nama, (select id from public.kelompok where nomor = v.nomor), v.generus, now()
from (values
  ('00000000-0000-0000-0000-0000000000e1', 'Pengajian K1', 1, false),
  ('00000000-0000-0000-0000-0000000000e2', 'Pengajian K2', 2, false),
  ('00000000-0000-0000-0000-0000000000e3', 'Generus K1',   1, true)
) v(id, nama, nomor, generus);
insert into public.absensi (sesi_id, jamaah_id, jalur)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f4', 'manual');

select uji.cek('Seed: akun_generus.kelola untuk admin desa/kelompok/generus',
  (select array_agg(p.kode order by p.kode) from public.peran_izin pi join public.peran p on p.id = pi.peran_id
   where pi.izin_kode = 'akun_generus.kelola') = array['admin_desa', 'admin_generus', 'admin_kelompok']);
select uji.harus_ditolak('Trigger: akun untuk jamaah dewasa ditolak',
  $q$ insert into public.akun_generus (user_id, jamaah_id, username)
      values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2', 'dua') returning 1 $q$);
select uji.harus_ditolak('Trigger: akun admin tidak bisa jadi akun generus',
  $q$ insert into public.akun_generus (user_id, jamaah_id, username)
      values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f4', 'adm') returning 1 $q$);
select uji.harus_ditolak('Trigger: akun generus tidak bisa jadi admin',
  $q$ insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000c1', 'X') returning 1 $q$);
select uji.harus_ditolak('Format username: huruf besar/spasi ditolak',
  $q$ insert into public.akun_generus (user_id, jamaah_id, username)
      values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f3', 'Generus Dua') returning 1 $q$);

-- ---------------------------------------------------------------------
-- Login generus (anon)
-- ---------------------------------------------------------------------
set local role anon;
select uji.cek('Anon: mulai_login → email sintetis',
  (select email from public.mulai_login_generus(' SATU ')) = 'g-satu@generus.kawanku.invalid');
select uji.cek('Anon: username tak dikenal → kosong',
  not exists (select 1 from public.mulai_login_generus('tidakada')));
select uji.harus_ditolak('Anon: tidak bisa membaca akun_generus', $q$ select 1 from public.akun_generus $q$);
select uji.harus_ditolak('Anon: tidak bisa membuat token layar',
  $q$ select public.token_layar('00000000-0000-0000-0000-0000000000e1') $q$);
select public.gagal_login_generus('satu') from generate_series(1, 4);
select uji.cek('Anon: 4x salah belum terkunci',
  (select terkunci_sampai is null from public.mulai_login_generus('satu')));
select public.gagal_login_generus('satu');
select uji.cek('Anon: 5x salah → terkunci ±15 menit',
  (select terkunci_sampai > now() + interval '14 minutes' from public.mulai_login_generus('satu')));
reset role;

-- ---------------------------------------------------------------------
-- Admin kelompok 1
-- ---------------------------------------------------------------------
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('K1: boleh_kelola_akun_generus generus K1 = true',
  public.boleh_kelola_akun_generus('00000000-0000-0000-0000-0000000000f4'));
select uji.cek('K1: boleh_kelola_akun_generus generus K2 = false',
  not public.boleh_kelola_akun_generus('00000000-0000-0000-0000-0000000000f3'));
select uji.cek('K1: melihat akun generus K1', (select count(*) from public.akun_generus) = 1);
select uji.harus_ditolak('K1: membuat akun generus K2 ditolak',
  $q$ insert into public.akun_generus (user_id, jamaah_id, username)
      values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f3', 'tiga') returning 1 $q$);
select uji.harus_berhasil('K1: membuka kunci / atur ulang PIN awal',
  $q$ update public.akun_generus set gagal_login = 0, terkunci_sampai = null, pin_awal = true
      where username = 'satu' returning 1 $q$);
update public.akun_generus set terkunci_sampai = null where username = 'satu';

create temp table tok on commit drop as
  select public.token_layar('00000000-0000-0000-0000-0000000000e1') t1,
         public.token_layar('00000000-0000-0000-0000-0000000000e3') t3;
grant select on tok to authenticated;
select uji.cek('K1: token layar berformat sesi.detik.tanda',
  (select t1 ~ '^[0-9a-f-]{36}\.[0-9]+\.[A-Za-z0-9_-]{22}$' from tok));
select uji.harus_ditolak('K1: token layar sesi K2 ditolak',
  $q$ select public.token_layar('00000000-0000-0000-0000-0000000000e2') $q$);
reset role;
-- Token sesi K2 dibuat admin desa.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
create temp table tok2 on commit drop as select public.token_layar('00000000-0000-0000-0000-0000000000e2') t2;
grant select on tok2 to authenticated;

-- ---------------------------------------------------------------------
-- Generus (akun satu)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: login_generus_berhasil → pin_awal true', public.login_generus_berhasil());
select uji.cek('Gen: hanya melihat profilnya sendiri',
  (select array_agg(nama_lengkap) from public.jamaah) = array['Generus Satu']);
select uji.cek('Gen: view kategori juga hanya dirinya', (select count(*) from public.jamaah_dengan_kategori) = 1);
select uji.cek('Gen: melihat akunnya sendiri saja', (select count(*) from public.akun_generus) = 1);
select uji.harus_ditolak('Gen: tidak bisa mengubah akunnya sendiri langsung',
  $q$ update public.akun_generus set aktif = true, pin_awal = false returning 1 $q$);
select uji.cek('Gen: tidak melihat sesi yang belum diikuti', not exists (select 1 from public.sesi_absensi));
select uji.cek('Gen: tidak melihat catatan orang lain', not exists (select 1 from public.absensi));
select uji.cek('Gen: tidak melihat kartu QR', not exists (select 1 from public.kartu_qr));
select uji.harus_ditolak('Gen: tidak bisa membuat token layar',
  $q$ select public.token_layar('00000000-0000-0000-0000-0000000000e1') $q$);
select uji.harus_ditolak('Gen: tidak bisa mencatat absensi langsung',
  $q$ insert into public.absensi (sesi_id, jamaah_id)
      values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1') returning 1 $q$);
select uji.cek('Gen: catat_absensi_kode (jalur admin) → tidak_berhak',
  public.catat_absensi_kode('00000000-0000-0000-0000-0000000000e1', 'KW-AAAAAA') ->> 'hasil' in ('tidak_berhak', 'tidak_dikenal'));

select uji.cek('Gen: scan QR layar → tercatat', uji.absen((select t1 from tok)) = 'tercatat');
select uji.cek('Gen: scan ulang → sudah', uji.absen((select t1 from tok)) = 'sudah');
select uji.cek('Gen: catatan berjalur layar & terlihat olehnya',
  (select jalur = 'layar' and status = 'hadir' from public.absensi));
select uji.cek('Gen: sesi yang diikuti kini terlihat',
  (select array_agg(nama) from public.sesi_absensi) = array['Pengajian K1']);
select uji.cek('Gen: sesi generus K1 → tercatat', uji.absen((select t3 from tok)) = 'tercatat');
select uji.cek('Gen: sesi K2 → bukan_peserta', uji.absen((select t2 from tok2)) = 'bukan_peserta');
select uji.cek('Gen: tanda dipalsukan → qr_tidak_sah',
  uji.absen((select regexp_replace(t1, '.$', case when right(t1, 1) = 'A' then 'B' else 'A' end) from tok)) = 'qr_tidak_sah');
select uji.cek('Gen: token ngawur → qr_tidak_sah', uji.absen('halo') = 'qr_tidak_sah');
select uji.cek('Gen: token lebih dari 90 detik → kedaluwarsa',
  uji.absen(uji.token('00000000-0000-0000-0000-0000000000e1', floor(extract(epoch from now()))::bigint - 120)) = 'kedaluwarsa');
select uji.cek('Gen: token 80 detik lalu masih berlaku (sudah)',
  uji.absen(uji.token('00000000-0000-0000-0000-0000000000e1', floor(extract(epoch from now()))::bigint - 80)) = 'sudah');
select public.pin_generus_diganti();
reset role;
select uji.cek('PIN diganti → pin_awal false',
  (select not pin_awal from public.akun_generus where username = 'satu'));

-- Sesi ditutup
update public.sesi_absensi set ditutup = true where id = '00000000-0000-0000-0000-0000000000e3';
delete from public.absensi where sesi_id = '00000000-0000-0000-0000-0000000000e3';
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: sesi ditutup → sesi_ditutup', uji.absen((select t3 from tok)) = 'sesi_ditutup');

-- Admin generus K1 menonaktifkan akun
select uji.sebagai('00000000-0000-0000-0000-0000000000b3');
select uji.harus_berhasil('Admin generus K1: menonaktifkan akun generus',
  $q$ update public.akun_generus set aktif = false where username = 'satu' returning 1 $q$);
update public.akun_generus set aktif = false where username = 'satu';
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen nonaktif: absen_layar → bukan_generus', uji.absen((select t1 from tok)) = 'bukan_generus');
select uji.cek('Gen nonaktif: tidak melihat profil', not exists (select 1 from public.jamaah));
reset role;
set local role anon;
select uji.cek('Anon: akun nonaktif tidak bisa mulai login',
  not exists (select 1 from public.mulai_login_generus('satu')));
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 40, 'Jumlah skenario akun generus');
select * from finish();
rollback;
