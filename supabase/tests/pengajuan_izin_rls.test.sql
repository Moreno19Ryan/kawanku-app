-- =====================================================================
-- Tes migrasi 20261022030000_pengajuan_izin: generus mengajukan izin/sakit
-- untuk satu pertemuan, admin menyetujui, dan tercatat ke absensi.
-- Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
-- Tes ini membuka sesi untuk tanggal mendatang; aturan "paling cepat 2 jam
-- sebelum mulai" diuji tersendiri di absensi_tepat_waktu.test.sql.
alter table public.sesi_absensi disable trigger cek_waktu_sesi;
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

create function uji.hari(n int) returns date language sql as $$
  select (now() at time zone 'Asia/Jakarta')::date + n;
$$;
create function uji.aju(p_kegiatan uuid, p_hari int, p_jenis text, p_alasan text, p_ket text default null)
returns void language sql as $$
  insert into public.pengajuan_izin (jamaah_id, kegiatan_id, tanggal, jenis, alasan_izin, keterangan)
  values ('00000000-0000-0000-0000-0000000000f1', p_kegiatan, uji.hari(p_hari),
          p_jenis::public.status_absensi, p_alasan::public.alasan_izin, p_ket);
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000b2', 'kel1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b3', 'kel2@uji.id'),
  ('00000000-0000-0000-0000-0000000000c1', 'g-satu@generus.kawanku.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'g-dua@generus.kawanku.invalid');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000b2', 'Kelompok 1'), ('00000000-0000-0000-0000-0000000000b3', 'Kelompok 2');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
select v.u::uuid, p.id, k.id from (values
  ('00000000-0000-0000-0000-0000000000b2', 1), ('00000000-0000-0000-0000-0000000000b3', 2)) v(u, n)
join public.kelompok k on k.nomor = v.n join public.peran p on p.kode = 'admin_kelompok';
insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000b1', 'Desa');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.peran where kode = 'admin_desa';

insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select v.id::uuid, (select id from public.kelompok where nomor = v.n), v.nama, 'L', 'x', 'lajang', 'sma_smk', 2009
from (values
  ('00000000-0000-0000-0000-0000000000f1', 1, 'Generus K1'),
  ('00000000-0000-0000-0000-0000000000f2', 2, 'Generus K2')
) v(id, n, nama);
insert into public.akun_generus (user_id, jamaah_id, username, pin_awal) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'satu', false),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2', 'dua', false);

-- a1: khusus K1 setiap hari; a2: khusus K2 setiap hari; a3: desa, hanya hari besok
insert into public.kegiatan (id, nama, kelompok_id, per_kelompok, berlaku_mulai)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Pengajian K1', (select id from public.kelompok where nomor = 1), false, uji.hari(-30)),
  ('00000000-0000-0000-0000-0000000000a2', 'Pengajian K2', (select id from public.kelompok where nomor = 2), false, uji.hari(-30)),
  ('00000000-0000-0000-0000-0000000000a3', 'Hanya Besok', null, false, uji.hari(-30));
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam)
select k, h, time '20:00' from unnest(array['00000000-0000-0000-0000-0000000000a1'::uuid,
  '00000000-0000-0000-0000-0000000000a2'::uuid]) k, generate_series(0, 6) h;
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam)
values ('00000000-0000-0000-0000-0000000000a3', extract(dow from uji.hari(1))::smallint, time '20:00');

set local role authenticated;

-- ---------------------------------------------------------------------
-- Generus K1 mengajukan
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
insert into public.pengajuan_izin (id, jamaah_id, kegiatan_id, tanggal, jenis, alasan_izin, keterangan, status)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-0000000000a1', uji.hari(1), 'izin', 'kuliah', 'Praktikum', 'disetujui');
select uji.cek('Gen: pengajuan baru selalu menunggu, kelompok pelaksana terisi K1',
  (select status = 'menunggu' and kelompok_id = (select id from public.kelompok where nomor = 1)
   from public.pengajuan_izin where id = '00000000-0000-0000-0000-0000000000d1'));
select uji.harus_ditolak('Gen: pengajuan ganda untuk pertemuan yang sama',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 1, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: tanggal kemarin ditolak',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', -1, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: lebih dari 60 hari ditolak',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 61, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: kegiatan kelompok lain ditolak',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a2', 1, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: tanggal tanpa jadwal ditolak',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a3', 0, 'sakit', null) $q$);
select uji.harus_berhasil('Gen: tanggal yang ada jadwalnya diterima',
  $q$ insert into public.pengajuan_izin (jamaah_id, kegiatan_id, tanggal, jenis)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', uji.hari(1), 'sakit')
      returning 1 $q$);
select uji.harus_ditolak('Gen: sakit dengan keterangan ditolak (data kesehatan tidak disimpan)',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 2, 'sakit', null, 'Demam') $q$);
select uji.harus_ditolak('Gen: izin tanpa alasan ditolak',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 2, 'izin', null) $q$);
select uji.harus_ditolak('Gen: pengajuan untuk jamaah lain ditolak',
  $q$ insert into public.pengajuan_izin (jamaah_id, kegiatan_id, tanggal, jenis)
      values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', uji.hari(1), 'sakit')
      returning 1 $q$);
select uji.harus_ditolak('Gen: tidak bisa menyetujui sendiri',
  $q$ update public.pengajuan_izin set status = 'disetujui' returning 1 $q$);
select uji.aju('00000000-0000-0000-0000-0000000000a1', 2, 'sakit', null);
select uji.aju('00000000-0000-0000-0000-0000000000a1', 3, 'sakit', null);
select uji.aju('00000000-0000-0000-0000-0000000000a1', 4, 'izin', 'lainnya', 'Acara keluarga');
select uji.cek('Gen: melihat 4 pengajuannya', (select count(*) from public.pengajuan_izin) = 4);

select uji.sebagai('00000000-0000-0000-0000-0000000000c2');
select uji.cek('Gen K2: tidak melihat pengajuan orang lain', not exists (select 1 from public.pengajuan_izin));

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000b3');
select uji.cek('Admin K2: tidak melihat pengajuan K1', not exists (select 1 from public.pengajuan_izin));
select uji.harus_ditolak('Admin K2: tidak bisa menyetujui pengajuan K1',
  $q$ update public.pengajuan_izin set status = 'disetujui' returning 1 $q$);

-- Kegiatan kelompok: izin disetujui pengurus kelompok itu (20261026100000).
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.cek('Admin desa: melihat pengajuan K1', (select count(*) from public.pengajuan_izin) = 4);
select uji.harus_ditolak('Admin desa: tidak bisa menyetujui izin kegiatan K1',
  $q$ update public.pengajuan_izin set status = 'disetujui' returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('Admin K1: melihat 4 pengajuan', (select count(*) from public.pengajuan_izin) = 4);
update public.pengajuan_izin set status = 'disetujui', tanggapan = 'Semangat kuliahnya'
where id = '00000000-0000-0000-0000-0000000000d1';
select uji.cek('Admin K1: penanganan tercatat',
  (select ditangani_by = '00000000-0000-0000-0000-0000000000b2' and ditangani_at is not null
   from public.pengajuan_izin where id = '00000000-0000-0000-0000-0000000000d1'));
select uji.cek('Disetujui sebelum absensi dibuka: belum ada catatan', not exists (select 1 from public.absensi));
select uji.harus_ditolak('Admin K1: isi pengajuan tidak bisa diubah',
  $q$ update public.pengajuan_izin set alasan_izin = 'kerja' returning 1 $q$);

-- Buka absensi H+1 → izin yang sudah disetujui otomatis tercatat.
create temp table sesi1 on commit drop as
  select public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), uji.hari(1), now() + interval '1 day') id;
grant select on sesi1 to authenticated;
select uji.cek('Buka absensi: izin disetujui langsung tercatat (izin, kuliah)',
  (select status = 'izin' and alasan_izin = 'kuliah' and jalur = 'manual' from public.absensi
   where sesi_id = (select id from sesi1) and jamaah_id = '00000000-0000-0000-0000-0000000000f1'));

-- H+2: generus sudah hadir, lalu sakitnya disetujui → hadir tidak ditimpa.
create temp table sesi2 on commit drop as
  select public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), uji.hari(2), now() + interval '2 day') id;
grant select on sesi2 to authenticated;
insert into public.absensi (sesi_id, jamaah_id, status) values ((select id from sesi2), '00000000-0000-0000-0000-0000000000f1', 'hadir');
update public.pengajuan_izin set status = 'disetujui' where tanggal = uji.hari(2);
select uji.cek('Disetujui setelah hadir: catatan hadir tidak ditimpa',
  (select status = 'hadir' from public.absensi where sesi_id = (select id from sesi2)));

-- H+3: absensi sudah dibuka, sakit disetujui → langsung tercatat.
create temp table sesi3 on commit drop as
  select public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), uji.hari(3), now() + interval '3 day') id;
grant select on sesi3 to authenticated;
update public.pengajuan_izin set status = 'disetujui' where tanggal = uji.hari(3);
select uji.cek('Disetujui saat absensi sudah dibuka: langsung tercatat sakit',
  (select status = 'sakit' and alasan_izin is null from public.absensi where sesi_id = (select id from sesi3)));

-- H+4: ditolak → tidak tercatat.
update public.pengajuan_izin set status = 'ditolak', tanggapan = 'Mohon hadir' where tanggal = uji.hari(4);

-- H+5 dibatalkan, H+6 absensinya sudah ditutup.
insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai, status, alasan_batal)
values ('00000000-0000-0000-0000-0000000000a1', (select id from public.kelompok where nomor = 1),
        uji.hari(5), now() + interval '5 day', 'dibatalkan', 'Libur');
create temp table sesi6 on commit drop as
  select public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), uji.hari(6), now() + interval '6 day') id;
grant select on sesi6 to authenticated;
update public.sesi_absensi set ditutup = true where id = (select id from sesi6);

-- ---------------------------------------------------------------------
-- Generus lagi
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: melihat tanggapan admin',
  (select tanggapan = 'Semangat kuliahnya' from public.pengajuan_izin where id = '00000000-0000-0000-0000-0000000000d1'));
select uji.harus_ditolak('Gen: pertemuan dibatalkan tidak perlu izin',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 5, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: absensi sudah ditutup',
  $q$ select uji.aju('00000000-0000-0000-0000-0000000000a1', 6, 'sakit', null) $q$);
select uji.harus_ditolak('Gen: tidak bisa membatalkan yang sudah disetujui',
  $q$ delete from public.pengajuan_izin where id = '00000000-0000-0000-0000-0000000000d1' returning 1 $q$);
select uji.harus_berhasil('Gen: setelah ditolak boleh mengajukan lagi',
  $q$ insert into public.pengajuan_izin (jamaah_id, kegiatan_id, tanggal, jenis)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', uji.hari(4), 'sakit')
      returning 1 $q$);
select uji.aju('00000000-0000-0000-0000-0000000000a1', 7, 'sakit', null);
select uji.harus_berhasil('Gen: membatalkan yang masih menunggu',
  $q$ delete from public.pengajuan_izin where tanggal = uji.hari(7) returning 1 $q$);

reset role;
set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca pengajuan', $q$ select 1 from public.pengajuan_izin $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 28, 'Jumlah skenario pengajuan izin');
select * from finish();
rollback;
