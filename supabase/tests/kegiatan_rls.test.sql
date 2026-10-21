-- =====================================================================
-- Tes Fase 3a (migrasi 20261021220000_kegiatan_rutin): kegiatan, jadwal,
-- pertemuan per wilayah & sasaran, kegiatan serentak per kelompok,
-- buka absensi dari pertemuan, akses generus & pengembang.
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
create function uji.kel(p_nomor int) returns uuid language sql stable as $$
  select id from public.kelompok where nomor = p_nomor;
$$;
create function uji.keg(p_nama text) returns uuid language sql stable security definer as $$
  select id from public.kegiatan where nama = p_nama;
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000a5'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'K2'), ('00000000-0000-0000-0000-0000000000a4', 'Gen K1'),
  ('00000000-0000-0000-0000-0000000000a5', 'Dev');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000a4', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a5', 'pengembang', null);
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
values ('00000000-0000-0000-0000-0000000000f1', uji.kel(1), 'Generus K1', 'L', 'x', 'lajang', 'smp', 2012);
insert into public.akun_generus (user_id, jamaah_id, username)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'genk1');

-- Seed
select uji.cek('Seed: dua kegiatan rutin awal',
  (select count(*) from public.kegiatan where jenis = 'rutin' and created_by is null) = 2);
select uji.cek('Seed: sambung kelompok serentak, Minggu (libur pekan 3) & Selasa 20:00',
  (select array_agg(j.hari || ':' || j.jam || ':' || j.kecuali_pekan_ke::text order by j.hari)
   from public.kegiatan_jadwal j join public.kegiatan k on k.id = j.kegiatan_id
   where k.nama = 'Pengajian Rutin Sambung Kelompok' and k.per_kelompok)
  = array['0:20:00:00:{3}', '2:20:00:00:{}']);
select uji.cek('Seed: sambung desa Kamis 20:00',
  (select j.hari = 4 and j.jam = '20:00' from public.kegiatan_jadwal j join public.kegiatan k on k.id = j.kegiatan_id
   where k.nama = 'Pengajian Rutin Sambung Desa'));
select uji.cek('Seed: izin kegiatan untuk admin & pengembang lihat',
  (select array_agg(p.kode || ':' || pi.izin_kode order by p.kode, pi.izin_kode)
   from public.peran_izin pi join public.peran p on p.id = pi.peran_id where pi.izin_kode like 'kegiatan.%')
  = array['admin_desa:kegiatan.kelola', 'admin_desa:kegiatan.lihat', 'admin_generus:kegiatan.kelola',
          'admin_generus:kegiatan.lihat', 'admin_kelompok:kegiatan.kelola', 'admin_kelompok:kegiatan.lihat',
          'pengembang:kegiatan.lihat']);
select uji.harus_ditolak('Constraint: per_kelompok wajib tingkat desa',
  $q$ insert into public.kegiatan (nama, kelompok_id, per_kelompok) values ('X', uji.kel(1), true) returning 1 $q$);
select uji.harus_ditolak('Constraint: pekan libur hanya 1-5',
  $q$ insert into public.kegiatan_jadwal (kegiatan_id, hari, jam, kecuali_pekan_ke)
      values (uji.keg('Pengajian Rutin Sambung Desa'), 1, '20:00', '{6}') returning 1 $q$);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Admin kelompok 1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.cek('K1: melihat dua kegiatan desa', (select count(*) from public.kegiatan) = 2);
select uji.cek('K1: melihat jadwal', (select count(*) from public.kegiatan_jadwal) = 3);
select uji.harus_berhasil('K1: membuat kegiatan K1',
  $q$ insert into public.kegiatan (nama, kelompok_id) values ('Caberawit K1', uji.kel(1)) returning 1 $q$);
insert into public.kegiatan (nama, kelompok_id) values ('Caberawit K1', uji.kel(1));
insert into public.kegiatan (nama, kelompok_id, jenis) values ('Kerja Bakti K1', uji.kel(1), 'agenda');
select uji.harus_ditolak('K1: membuat kegiatan desa ditolak',
  $q$ insert into public.kegiatan (nama) values ('X') returning 1 $q$);
select uji.harus_ditolak('K1: mengubah kegiatan desa ditolak',
  $q$ update public.kegiatan set nama = 'Y' where nama = 'Pengajian Rutin Sambung Desa' returning 1 $q$);
select uji.harus_berhasil('K1: mengisi pemateri pertemuan serentak di K1',
  $q$ insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai, pemateri_nama, materi)
      values (uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(1), '2026-10-25', '2026-10-25 20:00+07', 'Ust. A', 'Bab Sholat')
      returning 1 $q$);
insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai, pemateri_nama, materi)
values (uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(1), '2026-10-25', '2026-10-25 20:00+07', 'Ust. A', 'Bab Sholat');
select uji.harus_ditolak('K1: pertemuan serentak untuk K2 ditolak',
  $q$ insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai)
      values (uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(2), '2026-10-25', '2026-10-25 20:00+07') returning 1 $q$);
select uji.harus_ditolak('K1: pertemuan sambung desa ditolak',
  $q$ insert into public.pertemuan (kegiatan_id, tanggal, mulai)
      values (uji.keg('Pengajian Rutin Sambung Desa'), '2026-10-22', '2026-10-22 20:00+07') returning 1 $q$);
create temp table sesi_k1 on commit drop as
  select public.buka_absensi_pertemuan(uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(1), '2026-10-27', '2026-10-27 20:00+07') id;
grant select on sesi_k1 to authenticated;
select uji.cek('K1: buka absensi → sesi K1 bernama kegiatan · kelompok',
  (select nama = 'Pengajian Rutin Sambung Kelompok · Kelompok 1' and kelompok_id = uji.kel(1) and not ditutup
   from public.sesi_absensi where id = (select id from sesi_k1)));
select uji.cek('K1: buka absensi kedua kali → sesi yang sama',
  public.buka_absensi_pertemuan(uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(1), '2026-10-27', '2026-10-27 20:00+07')
  = (select id from sesi_k1));
select uji.cek('K1: pertemuan tertaut ke sesi',
  exists (select 1 from public.pertemuan where sesi_id = (select id from sesi_k1) and tanggal = '2026-10-27'));
select uji.harus_ditolak('K1: tanggal jadwal pertemuan tidak bisa diubah',
  $q$ update public.pertemuan set tanggal = '2026-10-26' where tanggal = '2026-10-25' returning 1 $q$);
select uji.harus_berhasil('K1: membatalkan pertemuan dengan alasan',
  $q$ update public.pertemuan set status = 'dibatalkan', alasan_batal = 'Musyawarah' where tanggal = '2026-10-25' returning 1 $q$);
select uji.harus_berhasil('K1: memindah jam pertemuan',
  $q$ update public.pertemuan set mulai = '2026-10-25 19:30+07' where tanggal = '2026-10-25' returning 1 $q$);
update public.pertemuan set status = 'dibatalkan', alasan_batal = 'Libur' where tanggal = '2026-10-25';
select uji.harus_ditolak('K1: buka absensi pertemuan yang dibatalkan',
  $q$ select public.buka_absensi_pertemuan(uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(1), '2026-10-25', '2026-10-25 20:00+07') $q$);

-- ---------------------------------------------------------------------
-- Admin kelompok 2
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.cek('K2: tidak melihat kegiatan & pertemuan K1',
  not exists (select 1 from public.kegiatan where nama like '%K1')
  and not exists (select 1 from public.pertemuan));
select uji.harus_berhasil('K2: pertemuan serentak untuk K2 sendiri',
  $q$ insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai, pemateri_nama)
      values (uji.keg('Pengajian Rutin Sambung Kelompok'), uji.kel(2), '2026-10-25', '2026-10-25 20:00+07', 'Ust. B') returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin desa
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Desa: melihat semua kegiatan', (select count(*) from public.kegiatan) = 4);
select uji.harus_ditolak('Desa: pertemuan serentak tanpa kelompok ditolak',
  $q$ insert into public.pertemuan (kegiatan_id, tanggal, mulai)
      values (uji.keg('Pengajian Rutin Sambung Kelompok'), '2026-11-01', '2026-11-01 20:00+07') returning 1 $q$);
select uji.harus_berhasil('Desa: pertemuan sambung desa',
  $q$ insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai)
      values (uji.keg('Pengajian Rutin Sambung Desa'), uji.kel(3), '2026-10-22', '2026-10-22 20:00+07')
      returning kelompok_id is null $q$);
insert into public.pertemuan (kegiatan_id, tanggal, mulai) values (uji.keg('Pengajian Rutin Sambung Desa'), '2026-10-22', '2026-10-22 20:00+07');
select uji.cek('Desa: kelompok pertemuan desa dipaksa null (bukan dari isian)',
  (select kelompok_id is null from public.pertemuan where tanggal = '2026-10-22'));
select uji.harus_ditolak('Desa: ubah jadi bukan serentak setelah ada pertemuan ditolak',
  $q$ update public.kegiatan set per_kelompok = false where nama = 'Pengajian Rutin Sambung Kelompok' returning 1 $q$);
select uji.harus_berhasil('Desa: ubah jam jadwal (hasil musyawarah) boleh',
  $q$ update public.kegiatan_jadwal set jam = '19:30' where hari = 4 returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin generus K1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a4');
select uji.harus_ditolak('Gen K1: kegiatan umum ditolak',
  $q$ insert into public.kegiatan (nama, kelompok_id) values ('X', uji.kel(1)) returning 1 $q$);
select uji.harus_berhasil('Gen K1: kegiatan generus K1',
  $q$ insert into public.kegiatan (nama, kelompok_id, hanya_generus) values ('Muda-mudi K1', uji.kel(1), true) returning 1 $q$);
select uji.harus_ditolak('Gen K1: mengubah pertemuan kegiatan umum ditolak',
  $q$ update public.pertemuan set materi = 'X' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Akun generus & pengembang
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Generus: melihat kegiatan desa & K1, bukan K2/kelompok lain',
  (select count(*) from public.kegiatan) = 4);
select uji.cek('Generus: melihat pertemuan K1 & desa, tidak K2',
  not exists (select 1 from public.pertemuan where kelompok_id = uji.kel(2))
  and exists (select 1 from public.pertemuan where kelompok_id = uji.kel(1)));
select uji.harus_ditolak('Generus: tidak bisa mengubah pertemuan',
  $q$ update public.pertemuan set materi = 'X' returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Dev: melihat semua kegiatan', (select count(*) from public.kegiatan) >= 4);
select uji.harus_ditolak('Dev: membuat kegiatan ditolak',
  $q$ insert into public.kegiatan (nama) values ('X') returning 1 $q$);
reset role;
set local role anon;
select uji.harus_ditolak('Anon: membaca kegiatan ditolak', $q$ select 1 from public.kegiatan $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 35, 'Jumlah skenario kegiatan');
select * from finish();
rollback;
