-- =====================================================================
-- Tes migrasi 20261024090000_absensi_terikat_pertemuan: sesi absensi lahir
-- dari pertemuan, ikut libur/pindah waktu/ganti nama, kegiatan berriwayat
-- tidak bisa dihapus, buka/tutup otomatis atau manual, dan buat_acara_absensi.
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
create function uji.catat(p_sesi uuid, p_kode text) returns text language sql as $$
  select public.catat_absensi_kode(p_sesi, p_kode) ->> 'hasil';
$$;
grant execute on all functions in schema uji to anon, authenticated;


insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000d1', 'Desa'), ('00000000-0000-0000-0000-0000000000d2', 'Kelompok 1');
select uji.beri('00000000-0000-0000-0000-0000000000d1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000d2', 'admin_kelompok', 1);

insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select '00000000-0000-0000-0000-0000000000f1', id, 'Dewasa K1', 'L', 'x', 'menikah', 'bekerja', 1985
from public.kelompok where nomor = 1;
create table uji.kode_j as select id, kode from public.jamaah;
grant select on uji.kode_j to anon, authenticated;

-- Kegiatan rutin serentak (per kelompok) & pertemuan K1 hari ini.
insert into public.kegiatan (id, nama, jenis, per_kelompok, durasi_menit)
values ('00000000-0000-0000-0000-0000000000a1', 'Pengajian Rutin', 'rutin', true, 120);
insert into public.pertemuan (id, kegiatan_id, kelompok_id, tanggal, mulai)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', id,
       (now() at time zone 'Asia/Jakarta')::date, now() - interval '10 minutes'
from public.kelompok where nomor = 1;

select uji.cek('Sesi tanpa pertemuan ditolak (pemilik DB pun)',
  (select count(*) from public.sesi_absensi) = 0);
do $$ begin
  insert into public.sesi_absensi (nama, mulai) values ('Liar', now());
  insert into uji.hasil (nama, lulus) values ('Insert sesi tanpa pertemuan gagal', false);
exception when others then
  insert into uji.hasil (nama, lulus, catatan) values ('Insert sesi tanpa pertemuan gagal', sqlerrm like 'Absensi hanya bisa dibuka dari pertemuan%', sqlerrm);
end $$;

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');

create temp table s1 on commit drop as
  select public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), (now() at time zone 'Asia/Jakarta')::date, now()) as id;
grant select on s1 to authenticated;
select uji.cek('Buka absensi: sesi tertaut dua arah',
  (select pertemuan_id from public.sesi_absensi where id = (select id from s1)) = '00000000-0000-0000-0000-0000000000b1'
  and (select sesi_id from public.pertemuan where id = '00000000-0000-0000-0000-0000000000b1') = (select id from s1));
select uji.cek('Sesi diisi dari pertemuan: nama "Kegiatan · Kelompok", wilayah, waktu, durasi',
  (select nama = 'Pengajian Rutin · ' || (select nama from public.kelompok where nomor = 1)
          and kelompok_id = (select id from public.kelompok where nomor = 1)
          and not hanya_generus
          and mulai = (select mulai from public.pertemuan where id = '00000000-0000-0000-0000-0000000000b1')
          and selesai = mulai + interval '120 minutes'
   from public.sesi_absensi where id = (select id from s1)));
select uji.cek('Buka absensi lagi → sesi yang sama',
  public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), (now() at time zone 'Asia/Jakarta')::date, now()) = (select id from s1));
select uji.harus_ditolak('Sesi kedua untuk pertemuan yang sama ditolak',
  $q$ insert into public.sesi_absensi (pertemuan_id) values ('00000000-0000-0000-0000-0000000000b1') returning 1 $q$);
select uji.harus_ditolak('Waktu mulai sesi tidak bisa diubah langsung',
  $q$ update public.sesi_absensi set mulai = mulai + interval '1 hour' where id = (select id from s1) returning 1 $q$);
select uji.harus_ditolak('Pengikat sesi tidak bisa dipindah',
  $q$ update public.sesi_absensi set pertemuan_id = uji.pertemuan_baru((select id from public.kelompok where nomor = 1), false)
      where id = (select id from s1) returning 1 $q$);
select uji.harus_berhasil('Jam selesai sesi boleh diubah',
  $q$ update public.sesi_absensi set selesai = selesai + interval '30 minutes' where id = (select id from s1) returning 1 $q$);

-- Scan dalam jendela waktu
select uji.cek('Scan saat pertemuan berjalan → tercatat',
  uji.catat((select id from s1), (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'tercatat');

-- Pindah waktu → sesi ikut
update public.pertemuan set mulai = mulai + interval '1 day' where id = '00000000-0000-0000-0000-0000000000b1';
select uji.cek('Pindah waktu: mulai & selesai sesi ikut bergeser (durasi tetap)',
  (select s.mulai = p.mulai and s.selesai = p.mulai + interval '120 minutes'
   from public.sesi_absensi s join public.pertemuan p on p.id = s.pertemuan_id where s.id = (select id from s1)));
select uji.cek('Pertemuan dipindah ke besok → scan belum_waktunya',
  uji.catat((select id from s1), (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'belum_waktunya');
update public.pertemuan set mulai = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000b1';
select uji.cek('Pertemuan sudah lewat lama → scan lewat_waktu',
  uji.catat((select id from s1), (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'lewat_waktu');
select uji.harus_berhasil('Koreksi manual admin tetap boleh di luar jendela scan',
  $q$ update public.absensi set status = 'sakit' where sesi_id = (select id from s1) returning 1 $q$);
select uji.cek('QR layar tidak dibuat di luar jendela scan', public.token_layar((select id from s1)) is null);

-- Ganti nama kegiatan → nama sesi ikut
reset role;
update public.kegiatan set nama = 'Pengajian Sambung' where id = '00000000-0000-0000-0000-0000000000a1';
select uji.cek('Nama kegiatan diubah → nama sesi ikut',
  (select nama like 'Pengajian Sambung · %' from public.sesi_absensi where id = (select id from s1)));
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');

-- Hapus kegiatan / pertemuan berriwayat ditolak
select uji.harus_ditolak('Pertemuan yang sudah dibuka absensinya tidak bisa dihapus',
  $q$ delete from public.pertemuan where id = '00000000-0000-0000-0000-0000000000b1' returning 1 $q$);
reset role;
do $$ begin
  delete from public.kegiatan where id = '00000000-0000-0000-0000-0000000000a1';
  insert into uji.hasil (nama, lulus) values ('Kegiatan berriwayat absensi tidak bisa dihapus', false);
exception when others then
  insert into uji.hasil (nama, lulus, catatan) values ('Kegiatan berriwayat absensi tidak bisa dihapus',
    sqlerrm like 'Kegiatan ini sudah punya riwayat absensi%', sqlerrm);
end $$;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');

-- Libur → sesi & catatan ikut terhapus
select uji.cek('Sebelum libur: ada 1 catatan', (select count(*) from public.absensi where sesi_id = (select id from s1)) = 1);
update public.pertemuan set status = 'dibatalkan', alasan_batal = 'Libur'
where id = '00000000-0000-0000-0000-0000000000b1';
select uji.cek('Libur: sesi terhapus', not exists (select 1 from public.sesi_absensi where id = (select id from s1)));
select uji.cek('Libur: catatan terhapus', not exists (select 1 from public.absensi where sesi_id = (select id from s1)));
select uji.cek('Libur: tautan sesi di pertemuan kosong',
  (select sesi_id is null from public.pertemuan where id = '00000000-0000-0000-0000-0000000000b1'));
select uji.harus_ditolak('Libur: absensi tidak bisa dibuka',
  $q$ insert into public.sesi_absensi (pertemuan_id) values ('00000000-0000-0000-0000-0000000000b1') returning 1 $q$);

-- Aktif lagi → bisa dibuka ulang
update public.pertemuan set status = 'terjadwal', mulai = now() where id = '00000000-0000-0000-0000-0000000000b1';
select uji.cek('Aktif lagi: absensi bisa dibuka ulang',
  public.buka_absensi_pertemuan('00000000-0000-0000-0000-0000000000a1',
    (select id from public.kelompok where nomor = 1), (now() at time zone 'Asia/Jakarta')::date, now()) is not null);

-- Acara di luar jadwal
create temp table acara on commit drop as
  select public.buat_acara_absensi('  Bakti   Sosial ', (select id from public.kelompok where nomor = 1), false, now(), 60::smallint,
                                   false, 15::smallint, 60::smallint) as id;
grant select on acara to authenticated;
select uji.cek('Acara baru: agenda + pertemuan + sesi sekaligus',
  (select s.nama = 'Bakti Sosial' and k.jenis = 'agenda' and k.durasi_menit = 60
          and s.selesai = s.mulai + interval '60 minutes' and p.sesi_id = s.id
   from public.sesi_absensi s join public.pertemuan p on p.id = s.pertemuan_id
   join public.kegiatan k on k.id = p.kegiatan_id where s.id = (select id from acara)));
select uji.cek('Acara baru: pengaturan buka/tutup tersimpan (manual, 15/60)',
  (select not k.absensi_otomatis and k.buka_sebelum_menit = 15 and k.tutup_setelah_menit = 60 and s.dibuka_manual
   from public.sesi_absensi s join public.pertemuan p on p.id = s.pertemuan_id
   join public.kegiatan k on k.id = p.kegiatan_id where s.id = (select id from acara)));
select uji.harus_ditolak('Acara baru di kelompok lain ditolak',
  $q$ select public.buat_acara_absensi('X', (select id from public.kelompok where nomor = 2), false, now(), 60::smallint) $q$);
select uji.harus_ditolak('Acara baru tanpa nama ditolak',
  $q$ select public.buat_acara_absensi('  ', (select id from public.kelompok where nomor = 1), false, now(), 60::smallint) $q$);
select uji.harus_ditolak('Acara baru 1 hari lagi ditolak (absensi paling cepat 2 jam sebelum)',
  $q$ select public.buat_acara_absensi('X', (select id from public.kelompok where nomor = 1), false, now() + interval '1 day', 60::smallint) $q$);
select uji.cek('Acara gagal tidak meninggalkan kegiatan', not exists (select 1 from public.kegiatan where nama = 'X'));

-- Hapus sesi langsung (salah buka) → pertemuan tetap, kegiatan bisa dihapus
delete from public.sesi_absensi where id = (select id from acara);
select uji.cek('Hapus sesi: tautan pertemuan dilepas',
  (select count(*) from public.pertemuan p join public.kegiatan k on k.id = p.kegiatan_id
   where k.nama = 'Bakti Sosial' and p.sesi_id is null) = 1);
select uji.harus_berhasil('Kegiatan tanpa riwayat absensi bisa dihapus',
  $q$ delete from public.kegiatan where nama = 'Bakti Sosial' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Buka/tutup absensi: otomatis (15/30/45/60 menit) atau manual
-- ---------------------------------------------------------------------
reset role;
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit, absensi_otomatis, buka_sebelum_menit, tutup_setelah_menit)
select v.id::uuid, v.nama, 'agenda', k.id, 90, v.oto, v.buka, v.tutup
from (values
  ('00000000-0000-0000-0000-0000000000a2', 'Otomatis 40 menit lagi', true,  30, 30, interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000a3', 'Otomatis sudah selesai', true,  30, 30, interval '-130 minutes'),
  ('00000000-0000-0000-0000-0000000000a4', 'Manual lama',            false, 30, 30, interval '-2 days')
) v(id, nama, oto, buka, tutup, geser)
cross join public.kelompok k where k.nomor = 1;
insert into public.pertemuan (kegiatan_id, tanggal, mulai)
select v.id::uuid, ((now() + v.geser) at time zone 'Asia/Jakarta')::date, now() + v.geser
from (values
  ('00000000-0000-0000-0000-0000000000a2', interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000a3', interval '-130 minutes'),
  ('00000000-0000-0000-0000-0000000000a4', interval '-2 days')
) v(id, geser);
do $$ begin
  update public.kegiatan set buka_sebelum_menit = 20 where id = '00000000-0000-0000-0000-0000000000a2';
  insert into uji.hasil (nama, lulus) values ('Pilihan menit selain 15/30/45/60 ditolak', false);
exception when check_violation then
  insert into uji.hasil (nama, lulus) values ('Pilihan menit selain 15/30/45/60 ditolak', true);
end $$;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');

create temp table sx on commit drop as
  select p.kegiatan_id as k, public.buka_absensi_pertemuan(p.kegiatan_id, null, p.tanggal, p.mulai) as id
  from public.pertemuan p
  where p.kegiatan_id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
                          '00000000-0000-0000-0000-0000000000a4');
grant select on sx to authenticated;
create function pg_temp.scan(p_k text) returns text language sql as $$
  select uji.catat((select id from sx where k = p_k::uuid),
                   (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1'));
$$;

select uji.cek('Sesi menyalin pengaturan kegiatan (otomatis, 30/30)',
  (select buka_otomatis and buka_sebelum_menit = 30 and tutup_setelah_menit = 30 and not dibuka_manual
   from public.sesi_absensi where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a2')));
select uji.cek('Otomatis 30 menit: 40 menit sebelum mulai → belum_waktunya',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a2') = 'belum_waktunya');
select uji.cek('QR layar belum tampil sebelum jendela buka',
  public.token_layar((select id from sx where k = '00000000-0000-0000-0000-0000000000a2')) is null);
update public.kegiatan set buka_sebelum_menit = 45 where id = '00000000-0000-0000-0000-0000000000a2';
select uji.cek('Ubah kegiatan ke 45 menit → sesi ikut',
  (select buka_sebelum_menit = 45 from public.sesi_absensi where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a2')));
select uji.cek('Otomatis 45 menit: 40 menit sebelum mulai → tercatat',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a2') = 'tercatat');
select uji.cek('QR layar tampil di dalam jendela',
  public.token_layar((select id from sx where k = '00000000-0000-0000-0000-0000000000a2')) is not null);

select uji.cek('Otomatis tutup 30 menit: 40 menit setelah selesai → lewat_waktu',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a3') = 'lewat_waktu');
update public.sesi_absensi set dibuka_manual = true where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a3');
select uji.cek('Admin "Buka sekarang" → scan diterima walau lewat jendela',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a3') = 'tercatat');
update public.sesi_absensi set dibuka_manual = false, ditutup = true where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a3');
select uji.cek('Admin "Tutup sekarang" → sesi_ditutup',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a3') = 'sesi_ditutup');

select uji.cek('Mode manual: Buka absensi langsung membuka (tanpa melihat jam)',
  (select dibuka_manual and not buka_otomatis from public.sesi_absensi where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a4'))
  and pg_temp.scan('00000000-0000-0000-0000-0000000000a4') = 'tercatat');
update public.sesi_absensi set dibuka_manual = false, ditutup = true where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a4');
select uji.cek('Mode manual: ditutup admin → sesi_ditutup',
  pg_temp.scan('00000000-0000-0000-0000-0000000000a4') = 'sesi_ditutup');

update public.kegiatan set absensi_otomatis = false where id = '00000000-0000-0000-0000-0000000000a2';
select uji.cek('Kegiatan diubah ke manual → sesi yang belum ditutup ikut dibuka manual',
  (select dibuka_manual and not buka_otomatis from public.sesi_absensi where id = (select id from sx where k = '00000000-0000-0000-0000-0000000000a2')));

reset role;
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 45, 'Jumlah skenario');
select * from finish();
rollback;
