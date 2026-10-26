-- =====================================================================
-- Tes migrasi 20261022040000_beranda_generus: pengumuman bersasaran
-- (admin/generus/semua + wilayah) dan riwayat kehadiran_saya().
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

create function uji.umum(p_sasaran text, p_kelompok int) returns text language sql as $$
  insert into public.pengumuman (pesan, sasaran, kelompok_id)
  values ('uji', p_sasaran, (select id from public.kelompok where nomor = p_kelompok)) returning 'ok';
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000b2', 'kel1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b4', 'gen1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b5', 'dev@uji.id'),
  ('00000000-0000-0000-0000-0000000000c1', 'g-satu@generus.kawanku.invalid');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000b1', 'Desa'), ('00000000-0000-0000-0000-0000000000b2', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000b4', 'Generus K1'), ('00000000-0000-0000-0000-0000000000b5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
select v.u::uuid, p.id, (select id from public.kelompok where nomor = v.n) from (values
  ('00000000-0000-0000-0000-0000000000b1', 'admin_desa', null),
  ('00000000-0000-0000-0000-0000000000b2', 'admin_kelompok', 1),
  ('00000000-0000-0000-0000-0000000000b4', 'admin_generus', 1),
  ('00000000-0000-0000-0000-0000000000b5', 'pengembang', null)) v(u, kode, n)
join public.peran p on p.kode = v.kode;

insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir, created_at)
select '00000000-0000-0000-0000-0000000000f1', id, 'Generus K1', 'L', 'x', 'lajang', 'sma_smk', 2009, now() - interval '60 days'
from public.kelompok where nomor = 1;
insert into public.akun_generus (user_id, jamaah_id, username, pin_awal)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'satu', false);

-- Sesi: e1 K1 hadir, e2 K1 ditutup tanpa catatan (alpa), e3 K1 sedang berjalan,
-- e4 K2 (bukan peserta), e5 desa izin, e6 khusus generus K1, e7 besok, e8 sebelum profil ada
select uji.sesi(v.id::uuid, v.nama, (select id from public.kelompok where nomor = v.n), v.gen,
       now() + v.geser, now() + v.geser + interval '90 minutes', v.tutup)
from (values
  ('00000000-0000-0000-0000-0000000000e1', 'K1 hadir',   1,    false, interval '-10 days',  true),
  ('00000000-0000-0000-0000-0000000000e2', 'K1 alpa',    1,    false, interval '-7 days',   true),
  ('00000000-0000-0000-0000-0000000000e3', 'K1 jalan',   1,    false, interval '-10 minutes', false),
  ('00000000-0000-0000-0000-0000000000e4', 'K2',         2,    false, interval '-5 days',   true),
  ('00000000-0000-0000-0000-0000000000e5', 'Desa izin',  null, false, interval '-3 days',   true),
  ('00000000-0000-0000-0000-0000000000e6', 'Generus K1', 1,    true,  interval '-2 days',   true),
  ('00000000-0000-0000-0000-0000000000e7', 'Besok',      1,    false, interval '1 day',     false),
  ('00000000-0000-0000-0000-0000000000e8', 'Lama',       1,    false, interval '-90 days',  true)
) v(id, nama, n, gen, geser, tutup);
insert into public.absensi (sesi_id, jamaah_id, status, alasan_izin) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 'hadir', null),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f1', 'izin', 'kuliah'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000f1', 'hadir', null);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Pengumuman
-- ---------------------------------------------------------------------
-- pengumuman.kelola (sistem) = pengembang: admin & semua.
select uji.sebagai('00000000-0000-0000-0000-0000000000b5');
select uji.cek('Pengembang: pengumuman admin', uji.umum('admin', null) = 'ok');
select uji.cek('Pengembang: pengumuman untuk semua', uji.umum('semua', null) = 'ok');

-- Admin desa (kegiatan.kelola seluruh desa): generus di mana pun, bukan admin.
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.cek('Desa: pengumuman generus seluruh desa', uji.umum('generus', null) = 'ok');
select uji.cek('Desa: pengumuman generus K2', uji.umum('generus', 2) = 'ok');
select uji.harus_ditolak('Desa: pengumuman admin ditolak (khusus pengumuman.kelola)',
  $q$ select uji.umum('admin', null) $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('K1: pengumuman generus K1', uji.umum('generus', 1) = 'ok');
select uji.harus_ditolak('K1: pengumuman generus seluruh desa ditolak', $q$ select uji.umum('generus', null) $q$);
select uji.harus_ditolak('K1: pengumuman generus K2 ditolak', $q$ select uji.umum('generus', 2) $q$);
select uji.harus_ditolak('K1: pengumuman admin ditolak', $q$ select uji.umum('admin', 1) $q$);
select uji.harus_ditolak('K1: tidak bisa menyembunyikan pengumuman desa',
  $q$ update public.pengumuman set aktif = false where kelompok_id is null returning 1 $q$);
select uji.cek('K1 (admin): melihat semua pengumuman', (select count(*) from public.pengumuman) = 5);

select uji.sebagai('00000000-0000-0000-0000-0000000000b4');
select uji.harus_berhasil('Admin generus K1: pengumuman generus K1',
  $q$ select uji.umum('generus', 1) $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Generus K1: hanya melihat generus desa, generus K1, dan semua',
  (select array_agg(sasaran || ':' || coalesce((select nomor::text from public.kelompok k where k.id = p.kelompok_id), 'desa')
                    order by sasaran, kelompok_id nulls first) from public.pengumuman p)
  = array['generus:desa', 'generus:1', 'semua:desa']);
select uji.harus_ditolak('Generus: tidak bisa membuat pengumuman', $q$ select uji.umum('generus', 1) $q$);

-- ---------------------------------------------------------------------
-- kehadiran_saya()
-- ---------------------------------------------------------------------
select uji.cek('Generus: riwayat berisi sesi peserta yang sudah dimulai (5 sesi)',
  (select array_agg(nama || '=' || status order by mulai) from public.kehadiran_saya())
  = array['K1 hadir=hadir', 'K1 alpa=alpa', 'Desa izin=izin', 'Generus K1=hadir', 'K1 jalan=berjalan']);
select uji.cek('Generus: alasan izin ikut', (select alasan_izin = 'kuliah' from public.kehadiran_saya() where nama = 'Desa izin'));
select uji.cek('Generus: batas jumlah dihormati', (select count(*) from public.kehadiran_saya(2)) = 2);

select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.cek('Admin: kehadiran_saya kosong', not exists (select 1 from public.kehadiran_saya()));

reset role;
set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memanggil kehadiran_saya', $q$ select 1 from public.kehadiran_saya() $q$);
select uji.harus_ditolak('Anon: tidak bisa membaca pengumuman', $q$ select 1 from public.pengumuman $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 20, 'Jumlah skenario beranda generus');
select * from finish();
rollback;
