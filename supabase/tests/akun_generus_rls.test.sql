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

-- Sesi absensi selalu lahir dari pertemuan (migrasi 20261024090000):
-- pertemuan_baru membuat agenda + pertemuannya; sesi membuat ketiganya.
create function uji.pertemuan_baru(p_kelompok uuid, p_generus boolean, p_mulai timestamptz default now(),
                                   p_nama text default 'Acara uji')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_kegiatan uuid; v_pertemuan uuid;
begin
  insert into public.kegiatan (nama, jenis, kelompok_id, hanya_generus, berlaku_mulai)
  values (p_nama, 'agenda', p_kelompok, p_generus, (p_mulai at time zone 'Asia/Jakarta')::date)
  returning id into v_kegiatan;
  insert into public.pertemuan (kegiatan_id, tanggal, mulai)
  values (v_kegiatan, (p_mulai at time zone 'Asia/Jakarta')::date, p_mulai)
  returning id into v_pertemuan;
  return v_pertemuan;
end $$;
create function uji.sesi(p_id uuid, p_nama text, p_kelompok uuid, p_generus boolean, p_mulai timestamptz,
                         p_selesai timestamptz default null, p_ditutup boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sesi_absensi (id, pertemuan_id, ditutup)
  values (p_id, uji.pertemuan_baru(p_kelompok, p_generus, p_mulai, p_nama), p_ditutup);
  if p_selesai is not null then
    update public.sesi_absensi set selesai = p_selesai where id = p_id;
  end if;
  return p_id;
end $$;
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
select uji.sesi(v.id::uuid, v.nama, (select id from public.kelompok where nomor = v.nomor), v.generus, now())
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
-- Login generus: PIN diperiksa server (service_role) lewat cek_pin_generus
-- ---------------------------------------------------------------------
insert into private.pin_generus (user_id, pin_hash)
values ('00000000-0000-0000-0000-0000000000c1', extensions.crypt('140310', extensions.gen_salt('bf')));
grant usage on schema uji to service_role;
grant insert, select on uji.hasil to service_role;
grant usage on sequence uji.hasil_no_seq to service_role;
grant execute on all functions in schema uji to service_role;

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memeriksa PIN (cek_pin_generus)',
  $q$ select 1 from public.cek_pin_generus('satu', '140310') $q$);
select uji.harus_ditolak('Anon: RPC login lama ditutup (mulai_login_generus)',
  $q$ select 1 from public.mulai_login_generus('satu') $q$);
select uji.harus_ditolak('Anon: RPC login lama ditutup (gagal_login_generus)',
  $q$ select public.gagal_login_generus('satu') $q$);
select uji.harus_ditolak('Anon: tidak bisa membaca akun_generus', $q$ select 1 from public.akun_generus $q$);
select uji.harus_ditolak('Anon: tidak bisa membuat token layar',
  $q$ select public.token_layar('00000000-0000-0000-0000-0000000000e1') $q$);
reset role;

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.harus_ditolak('Admin: tidak bisa memeriksa PIN langsung',
  $q$ select 1 from public.cek_pin_generus('satu', '140310') $q$);
select uji.harus_ditolak('Admin: tidak bisa membaca hash PIN', $q$ select 1 from private.pin_generus $q$);
reset role;

set local role service_role;
select uji.cek('Server: PIN benar → ok + email sintetis + pin_awal',
  (select hasil = 'ok' and email = 'g-satu@generus.kawanku.invalid' and pin_awal from public.cek_pin_generus(' SATU ', '140310')));
select uji.cek('Server: username tak dikenal → salah (tidak dibedakan)',
  (select hasil = 'salah' and email is null from public.cek_pin_generus('tidakada', '140310')));
select uji.cek('Server: PIN salah → salah', (select hasil = 'salah' from public.cek_pin_generus('satu', '000000')));
do $$ begin for i in 1..3 loop perform public.cek_pin_generus('satu', '000000'); end loop; end $$;
select uji.cek('Server: 4x salah belum terkunci',
  (select terkunci_sampai is null and gagal_login = 4 from public.akun_generus where username = 'satu'));
select uji.cek('Server: 5x salah → terkunci',
  (select hasil = 'terkunci' and terkunci_sampai > now() + interval '14 minutes' from public.cek_pin_generus('satu', '000000')));
select uji.cek('Server: terkunci → PIN benar pun ditolak',
  (select hasil = 'terkunci' from public.cek_pin_generus('satu', '140310')));
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
reset role;
update public.jamaah set tanggal_lahir = '2012-03-25' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.harus_ditolak('K1: PIN bebas untuk akun yang sudah punya PIN ditolak',
  $q$ select public.atur_pin_generus('00000000-0000-0000-0000-0000000000c1', '250311') $q$);
select uji.harus_ditolak('K1: kembalikan PIN tanpa alasan ditolak',
  $q$ select public.kembalikan_pin_awal('00000000-0000-0000-0000-0000000000f1', '') $q$);
select uji.harus_ditolak('K1: alasan "lainnya" tanpa catatan ditolak',
  $q$ select public.kembalikan_pin_awal('00000000-0000-0000-0000-0000000000f1', 'lainnya') $q$);
select uji.harus_ditolak('K1: kembalikan PIN generus K2 ditolak',
  $q$ select public.kembalikan_pin_awal('00000000-0000-0000-0000-0000000000f3', 'lupa') $q$);
select public.kembalikan_pin_awal('00000000-0000-0000-0000-0000000000f1', 'lupa');
select uji.cek('K1: pengembalian PIN tercatat (oleh admin ini, alasan lupa)',
  (select count(*) = 1 and bool_and(oleh = '00000000-0000-0000-0000-0000000000b2' and alasan = 'lupa') from public.riwayat_pin));
select uji.cek('K1: kembalikan PIN awal → kunci dibuka & PIN awal',
  (select terkunci_sampai is null and pin_awal from public.akun_generus where username = 'satu'));
select uji.harus_ditolak('K1: atur PIN akun di luar wewenang ditolak',
  $q$ select public.atur_pin_generus('00000000-0000-0000-0000-0000000000b1', '123456') $q$);
select uji.harus_ditolak('K1: PIN bukan 6 angka ditolak',
  $q$ select public.atur_pin_generus('00000000-0000-0000-0000-0000000000c1', '12ab') $q$);
reset role;
set local role service_role;
select uji.cek('Server: PIN awal (tanggal lahir DDMMYY) berlaku',
  (select hasil = 'ok' from public.cek_pin_generus('satu', '250312')));
reset role;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');

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
select uji.harus_ditolak('Gen: RPC login lama ditutup (login_generus_berhasil)',
  $q$ select public.login_generus_berhasil() $q$);
select uji.harus_ditolak('Gen: atur PIN lewat jalur admin ditolak',
  $q$ select public.atur_pin_generus('00000000-0000-0000-0000-0000000000c1', '111222') $q$);
select uji.cek('Gen: melihat riwayat pengembalian PIN miliknya', (select count(*) from public.riwayat_pin) = 1);
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
select uji.harus_ditolak('Gen: PIN baru sama dengan lama ditolak',
  $q$ select public.ganti_pin_saya('250312') $q$);
select public.ganti_pin_saya('739182');
reset role;
select uji.cek('PIN diganti → pin_awal false',
  (select not pin_awal from public.akun_generus where username = 'satu'));
set local role service_role;
select uji.cek('Server: PIN baru generus berlaku, lama tidak',
  (select hasil = 'ok' from public.cek_pin_generus('satu', '739182'))
  and (select hasil = 'salah' from public.cek_pin_generus('satu', '250311')));
reset role;

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
set local role service_role;
select uji.cek('Server: akun nonaktif → salah walau PIN benar',
  (select hasil = 'salah' from public.cek_pin_generus('satu', '739182')));
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 40, 'Jumlah skenario akun generus');
select * from finish();
rollback;
