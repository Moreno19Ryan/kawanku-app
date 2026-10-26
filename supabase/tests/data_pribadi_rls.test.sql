-- =====================================================================
-- Tes data pribadi jamaah (migrasi 20261021140000_data_pribadi_jamaah).
-- Kontak, data pribadi (orang tua & alamat), identitas (NIK/KK): izin per
-- tabel. Pengembang tidak melihat apa pun di sini; admin generus hanya
-- melihat kontak jamaah generus di wilayahnya.
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
create function uji.harus_ditolak_teks(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;
grant execute on all functions in schema uji to anon, authenticated;


-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000d2'),  -- admin kelompok 1
  ('00000000-0000-0000-0000-0000000000d3'),  -- admin kelompok 2
  ('00000000-0000-0000-0000-0000000000d4'),  -- admin generus kelompok 1
  ('00000000-0000-0000-0000-0000000000d5');  -- pengembang
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000d1', 'Desa'),
  ('00000000-0000-0000-0000-0000000000d2', 'K1'),
  ('00000000-0000-0000-0000-0000000000d3', 'K2'),
  ('00000000-0000-0000-0000-0000000000d4', 'Gen K1'),
  ('00000000-0000-0000-0000-0000000000d5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
select u, p.id, k.id
from (values
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'admin_desa',     null::int),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'admin_kelompok', 1),
  ('00000000-0000-0000-0000-0000000000d3'::uuid, 'admin_kelompok', 2),
  ('00000000-0000-0000-0000-0000000000d4'::uuid, 'admin_generus',  1),
  ('00000000-0000-0000-0000-0000000000d5'::uuid, 'pengembang',     null)
) v(u, kode, nomor)
join public.peran p on p.kode = v.kode
left join public.kelompok k on k.nomor = v.nomor;

-- Jamaah K1: satu generus (SMA), satu bukan generus (berkeluarga).
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode,
                           status_pernikahan, status_sekolah, tahun_lahir,
                           tempat_lahir, pendidikan_terakhir, kegiatan, muballigh, jenis_muballigh)
select '00000000-0000-0000-0000-00000000e001', id, 'Generus K1', 'L', 'x',
       'lajang', 'sma_smk', 2009, 'Bekasi', 'smp', 'Mondok', true, 'setempat'
from public.kelompok where nomor = 1;
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode,
                           status_pernikahan, status_sekolah, tahun_lahir)
select '00000000-0000-0000-0000-00000000e002', id, 'Dewasa K1', 'P', 'x',
       'menikah', 'bekerja', 1985
from public.kelompok where nomor = 1;

insert into public.jamaah_kontak (jamaah_id, no_hp, no_hp_wali, email) values
  ('00000000-0000-0000-0000-00000000e001', '081234567890', '081111111111', 'a@contoh.id'),
  ('00000000-0000-0000-0000-00000000e002', '082222222222', null, null);
insert into public.jamaah_pribadi (jamaah_id, nama_ayah, nama_ibu, ktp_kode_wilayah, ktp_wilayah, ktp_jalan, ktp_rt, ktp_rw, domisili_sama_ktp) values
  ('00000000-0000-0000-0000-00000000e001', 'Ayah', 'Ibu', '32.16.07.1001', 'Wanasari, Cibitung', 'Jl. Contoh', 3, 13, true),
  ('00000000-0000-0000-0000-00000000e002', null, null, null, null, 'Jl. Lain', null, null, false);
insert into public.jamaah_identitas (jamaah_id, nik, no_kk) values
  ('00000000-0000-0000-0000-00000000e001', '3216070101090001', '3216070101090002');

-- ---------------------------------------------------------------------
-- Aturan data (sebagai pemilik DB)
-- ---------------------------------------------------------------------
select uji.cek('View jamaah_dengan_kategori memuat kolom baru',
  (select tempat_lahir = 'Bekasi' and muballigh and jenis_muballigh = 'setempat'
   from public.jamaah_dengan_kategori where id = '00000000-0000-0000-0000-00000000e001'));
select uji.cek('View jamaah_tanpa_kategori masih ada',
  (select count(*) from public.jamaah_tanpa_kategori) = 0);
select uji.harus_ditolak('MT/MS tanpa status muballigh ditolak',
  $q$ update public.jamaah set jenis_muballigh = 'tugasan' where id = '00000000-0000-0000-0000-00000000e002' returning 1 $q$);
select uji.harus_berhasil('Muballigh tanpa pilihan MT/MS boleh',
  $q$ update public.jamaah set muballigh = true where id = '00000000-0000-0000-0000-00000000e002' returning 1 $q$);
select uji.harus_ditolak('No. HP format salah ditolak',
  $q$ update public.jamaah_kontak set no_hp = '+6281234' where jamaah_id = '00000000-0000-0000-0000-00000000e002' returning 1 $q$);
select uji.harus_ditolak('NIK bukan 16 digit ditolak',
  $q$ insert into public.jamaah_identitas (jamaah_id, nik) values ('00000000-0000-0000-0000-00000000e002', '12345') returning 1 $q$);
select uji.harus_ditolak('NIK dobel ditolak',
  $q$ insert into public.jamaah_identitas (jamaah_id, nik) values ('00000000-0000-0000-0000-00000000e002', '3216070101090001') returning 1 $q$);
select uji.harus_berhasil('No. KK boleh sama (satu keluarga)',
  $q$ insert into public.jamaah_identitas (jamaah_id, no_kk) values ('00000000-0000-0000-0000-00000000e002', '3216070101090002') returning 1 $q$);
select uji.harus_ditolak('Kode wilayah format salah ditolak',
  $q$ update public.jamaah_pribadi set ktp_kode_wilayah = '32-16' where jamaah_id = '00000000-0000-0000-0000-00000000e001' returning 1 $q$);
select uji.cek('Data sensitif ikut terhapus bersama jamaah (cascade)',
  (select confdeltype = 'c' from pg_constraint where conrelid = 'public.jamaah_identitas'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute where attrelid = 'public.jamaah_identitas'::regclass and attname = 'jamaah_id')]));

set local role authenticated;

-- ---------------------------------------------------------------------
-- Admin desa: melihat semua, mengubah tidak (wewenang kelompok)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d1');
select uji.cek('Admin desa: lihat kontak', (select count(*) from public.jamaah_kontak) = 2);
select uji.cek('Admin desa: lihat data pribadi', (select count(*) from public.jamaah_pribadi) = 2);
select uji.cek('Admin desa: identitas tidak terbaca langsung', not exists (select 1 from public.jamaah_identitas));
select uji.cek('Admin desa: identitas tampil tersamar',
  (select nik = '••••••••••••0001' and no_kk = '••••••••••••0002'
   from public.identitas_tersamar('00000000-0000-0000-0000-00000000e001')));
select uji.harus_ditolak('Admin desa: tidak lagi mengubah NIK (wewenang kelompok)',
  $q$ select public.simpan_identitas('00000000-0000-0000-0000-00000000e001', '3216070101090009', null) $q$);
select uji.harus_ditolak('Admin desa: lihat NIK lengkap tanpa persetujuan ditolak',
  $q$ select * from public.lihat_identitas('00000000-0000-0000-0000-00000000e001') $q$);
select uji.harus_ditolak('Admin desa: ubah alamat ditolak (wewenang kelompok)',
  $q$ update public.jamaah_pribadi set ktp_rt = 4 where jamaah_id = '00000000-0000-0000-0000-00000000e001' returning 1 $q$);
select uji.harus_ditolak('Admin desa: ubah kontak ditolak (wewenang kelompok)',
  $q$ update public.jamaah_kontak set email = 'x@uji.id' where jamaah_id = '00000000-0000-0000-0000-00000000e001' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin kelompok 1: kontak & pribadi kelompoknya, TANPA identitas
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.cek('Admin K1: lihat kontak K1', (select count(*) from public.jamaah_kontak) = 2);
select uji.cek('Admin K1: lihat data pribadi K1', (select count(*) from public.jamaah_pribadi) = 2);
select uji.cek('Admin K1: identitas tidak terbaca langsung', not exists (select 1 from public.jamaah_identitas));
select uji.cek('Admin K1: identitas K1 tampil tersamar',
  (select nik like '%0001' and nik not like '3216%' from public.identitas_tersamar('00000000-0000-0000-0000-00000000e001')));
select uji.harus_berhasil('Admin K1: ubah no. HP',
  $q$ update public.jamaah_kontak set no_hp = '081299999999' where jamaah_id = '00000000-0000-0000-0000-00000000e002' returning 1 $q$);
select uji.harus_berhasil('Admin K1: isi alamat',
  $q$ update public.jamaah_pribadi set dom_jalan = 'Jl. Baru' where jamaah_id = '00000000-0000-0000-0000-00000000e002' returning 1 $q$);
select uji.harus_ditolak('Admin K1: tulis langsung ke tabel identitas ditolak',
  $q$ insert into public.jamaah_identitas (jamaah_id, nik) values ('00000000-0000-0000-0000-00000000e002', '3216070101850001') returning 1 $q$);
select public.simpan_identitas('00000000-0000-0000-0000-00000000e002', '3216070101850001', null);
select uji.cek('Admin K1: mengisi NIK lewat simpan_identitas',
  (select nik = '••••••••••••0001' and no_kk is null
   from public.identitas_tersamar('00000000-0000-0000-0000-00000000e002')));
select uji.harus_ditolak('Admin K1: NIK dobel ditolak',
  $q$ select public.simpan_identitas('00000000-0000-0000-0000-00000000e002', '3216070101090001', null) $q$);
select uji.harus_ditolak('Admin K1: NIK bukan 16 angka ditolak',
  $q$ select public.simpan_identitas('00000000-0000-0000-0000-00000000e002', '1234', null) $q$);

-- ---------------------------------------------------------------------
-- Admin kelompok 2: tidak melihat data kelompok 1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d3');
select uji.cek('Admin K2: tidak melihat kontak K1', not exists (select 1 from public.jamaah_kontak));
select uji.cek('Admin K2: tidak melihat data pribadi K1', not exists (select 1 from public.jamaah_pribadi));
select uji.harus_ditolak('Admin K2: tidak bisa mengubah kontak K1',
  $q$ update public.jamaah_kontak set no_hp = '081200000000' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin generus K1: hanya LIHAT kontak jamaah generus
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d4');
select uji.cek('Generus K1: lihat kontak jamaah generus saja',
  (select array_agg(jamaah_id) from public.jamaah_kontak) = array['00000000-0000-0000-0000-00000000e001'::uuid]);
select uji.cek('Generus K1: tidak melihat data pribadi', not exists (select 1 from public.jamaah_pribadi));
select uji.cek('Generus K1: tidak melihat identitas', not exists (select 1 from public.jamaah_identitas));
select uji.harus_ditolak('Generus K1: tidak bisa mengubah kontak',
  $q$ update public.jamaah_kontak set no_hp = '081200000001' returning 1 $q$);
select uji.harus_ditolak('Generus K1: tidak bisa menghapus kontak',
  $q$ delete from public.jamaah_kontak returning 1 $q$);

-- ---------------------------------------------------------------------
-- Pengembang: profil biasa saja (jamaah.lihat), tanpa data sensitif
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d5');
select uji.cek('Pengembang: melihat profil jamaah', (select count(*) from public.jamaah) = 2);
select uji.cek('Pengembang: melihat kolom baru di view',
  (select count(*) from public.jamaah_dengan_kategori where tempat_lahir is not null) = 1);
select uji.cek('Pengembang: tidak melihat kontak', not exists (select 1 from public.jamaah_kontak));
select uji.cek('Pengembang: tidak melihat data pribadi', not exists (select 1 from public.jamaah_pribadi));
select uji.cek('Pengembang: tidak melihat identitas', not exists (select 1 from public.jamaah_identitas));
select uji.harus_ditolak('Pengembang: tidak bisa mengisi kontak',
  $q$ insert into public.jamaah_kontak (jamaah_id, no_hp) values ('00000000-0000-0000-0000-00000000e001', '081200000002') returning 1 $q$);
select uji.harus_ditolak('Pengembang: tidak bisa mengubah status muballigh',
  $q$ update public.jamaah set muballigh = false returning 1 $q$);
select uji.cek('Pengembang: tidak melihat identitas tersamar sekalipun',
  not exists (select 1 from public.identitas_tersamar('00000000-0000-0000-0000-00000000e001')));

-- ---------------------------------------------------------------------
-- Permintaan lihat NIK/KK lengkap (disetujui pengembang, berlaku 1 jam)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d3');
select uji.harus_ditolak('Admin K2: tidak bisa meminta NIK jamaah K1',
  $q$ insert into public.permintaan_identitas (jamaah_id, alasan) values ('00000000-0000-0000-0000-00000000e001', 'Pendataan BPJS') returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d4');
select uji.harus_ditolak('Admin generus: tidak bisa meminta NIK',
  $q$ insert into public.permintaan_identitas (jamaah_id, alasan) values ('00000000-0000-0000-0000-00000000e001', 'Pendataan BPJS') returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.harus_ditolak('Admin K1: permintaan langsung berstatus disetujui ditolak',
  $q$ insert into public.permintaan_identitas (jamaah_id, alasan, status) values ('00000000-0000-0000-0000-00000000e001', 'Pendataan BPJS', 'disetujui') returning 1 $q$);
insert into public.permintaan_identitas (jamaah_id, alasan) values ('00000000-0000-0000-0000-00000000e001', 'Pendataan BPJS kelompok');
select uji.harus_ditolak('Admin K1: belum disetujui → NIK lengkap ditolak',
  $q$ select * from public.lihat_identitas('00000000-0000-0000-0000-00000000e001') $q$);
select uji.harus_ditolak('Admin K1: tidak bisa menyetujui sendiri',
  $q$ select public.tangani_permintaan_identitas((select id from public.permintaan_identitas limit 1), true) $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d1');
select uji.cek('Admin desa: tidak melihat permintaan admin lain', not exists (select 1 from public.permintaan_identitas));
select uji.sebagai('00000000-0000-0000-0000-0000000000d5');
select uji.cek('Pengembang: melihat permintaan yang menunggu',
  (select count(*) = 1 from public.permintaan_identitas where status = 'menunggu'));
select public.tangani_permintaan_identitas((select id from public.permintaan_identitas limit 1), true, 'Silakan');
select uji.harus_ditolak('Pengembang: permintaan yang sudah ditangani tidak bisa ditangani lagi',
  $q$ select public.tangani_permintaan_identitas((select id from public.permintaan_identitas limit 1), false) $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.cek('Admin K1: disetujui → NIK & KK lengkap terbaca',
  (select nik = '3216070101090001' and no_kk = '3216070101090002' and berlaku_sampai > now()
   from public.lihat_identitas('00000000-0000-0000-0000-00000000e001')));
select uji.cek('Admin K1: setiap pembukaan NIK tercatat', (select count(*) = 1 from public.akses_identitas));
select uji.cek('Admin K1: persetujuan hanya untuk jamaah yang diminta',
  uji.harus_ditolak_teks($q$ select * from public.lihat_identitas('00000000-0000-0000-0000-00000000e002') $q$));
reset role;
update public.permintaan_identitas set berlaku_sampai = now() - interval '1 minute';
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.harus_ditolak('Admin K1: lewat 1 jam → NIK lengkap ditolak lagi',
  $q$ select * from public.lihat_identitas('00000000-0000-0000-0000-00000000e001') $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d5');
select uji.cek('Pengembang: melihat catatan pembukaan NIK', (select count(*) = 1 from public.akses_identitas));

reset role;

-- ---------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 50, 'Jumlah skenario data pribadi');
select * from finish();
rollback;
