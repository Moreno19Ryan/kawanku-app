-- =====================================================================
-- Tes migrasi 20261022120000_profil_mandiri_generus: generus mengubah data
-- dirinya sendiri (ubah_data_diri_saya), pengaman tetap generus, jejak
-- perubahan (perubahan_data_generus) & RLS-nya. Satu transaksi, di-rollback.
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

-- Lulus bila p_sql GAGAL atau tidak mengubah baris apa pun.
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

create function uji.sebagai(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, true);
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create function uji.beri(p_user uuid, p_peran text, p_nomor int) returns void language sql as $$
  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select p_user, p.id, (select id from public.kelompok where nomor = p_nomor)
  from public.peran p where p.kode = p_peran;
$$;

-- Panggil RPC dengan isian lengkap; argumen yang tidak disebut = nilai sekarang.
create function uji.simpan(
  p_tanggal date default '2008-04-14', p_sekolah text default 'sma_smk', p_kelas smallint default 11,
  p_panggilan text default 'Fajar', p_hp text default '081234567890', p_ayah text default 'Ahmad'
) returns void language sql as $$
  select public.ubah_data_diri_saya(
    p_panggilan, 'Kediri', p_tanggal, p_sekolah, p_kelas, 'smp', 'Pelajar',
    p_hp, 'fajar@contoh.id', '081298765432', p_ayah, 'Siti');
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000a2', 'kel2@uji.id'),
  ('00000000-0000-0000-0000-0000000000b1', 'fajar@generus.uji'),
  ('00000000-0000-0000-0000-0000000000b2', 'baru@generus.uji');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'Kelompok 2');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 2);

-- f1 Fajar (K1, SMA kelas 10, lajang), f2 generus dengan PIN awal (K1)
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan,
                           status_sekolah, tanggal_lahir, tahun_lahir, kelas)
values
  ('00000000-0000-0000-0000-0000000000f1', (select id from public.kelompok where nomor = 1), 'Fajar Ramadhan',
   'L', 'x', 'lajang', 'sma_smk', '2008-03-14', 2008, 10),
  ('00000000-0000-0000-0000-0000000000f2', (select id from public.kelompok where nomor = 1), 'Generus Baru',
   'L', 'x', 'lajang', 'smp', '2011-01-01', 2011, 8);
insert into public.akun_generus (user_id, jamaah_id, username, pin_awal) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'fajar', false),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f2', 'baru', true);

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.simpan();
reset role;

select uji.cek('Data jamaah tersimpan (tanggal & tahun lahir, kelas, tempat lahir, kegiatan, pendidikan)',
  (select tanggal_lahir = '2008-04-14' and tahun_lahir = 2008 and kelas = 11 and tempat_lahir = 'Kediri'
          and kegiatan = 'Pelajar' and pendidikan_terakhir = 'smp' and nama_panggilan = 'Fajar'
   from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Kontak tersimpan (HP, email huruf kecil, HP wali)',
  (select no_hp = '081234567890' and email = 'fajar@contoh.id' and no_hp_wali = '081298765432'
   from public.jamaah_kontak where jamaah_id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Nama orang tua tersimpan',
  (select nama_ayah = 'Ahmad' and nama_ibu = 'Siti'
   from public.jamaah_pribadi where jamaah_id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Jejak: tanggal lahir & kelas dicatat dengan nilai lama/baru',
  exists (select 1 from public.perubahan_data_generus where jamaah_id = '00000000-0000-0000-0000-0000000000f1'
          and bagian = 'tanggal_lahir' and nilai_lama = '2008-03-14' and nilai_baru = '2008-04-14')
  and exists (select 1 from public.perubahan_data_generus where jamaah_id = '00000000-0000-0000-0000-0000000000f1'
              and bagian = 'kelas' and nilai_lama = '10' and nilai_baru = '11'));
select uji.cek('Jejak: no. HP & nama ayah dicatat tanpa isinya; tidak ada catatan alamat',
  exists (select 1 from public.perubahan_data_generus where jamaah_id = '00000000-0000-0000-0000-0000000000f1'
          and bagian = 'no_hp' and nilai_lama is null and nilai_baru is null)
  and exists (select 1 from public.perubahan_data_generus where jamaah_id = '00000000-0000-0000-0000-0000000000f1'
              and bagian = 'nama_ayah' and nilai_baru is null)
  and not exists (select 1 from public.perubahan_data_generus where bagian = 'alamat'));

-- Simpan ulang tanpa perubahan → tidak ada catatan baru.
create temp table jumlah as select count(*) as n from public.perubahan_data_generus;
grant select on jumlah to authenticated;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.simpan();
reset role;
select uji.cek('Simpan tanpa perubahan tidak menambah catatan',
  (select count(*) from public.perubahan_data_generus) = (select n from jumlah));

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
-- Pengaman
select uji.harus_ditolak('Tanggal lahir 1950 (jadi lansia, keluar generus) ditolak',
  $q$ select uji.simpan(p_tanggal => '1950-01-01') $q$);
select uji.harus_ditolak('Tanggal lahir di masa depan ditolak',
  $q$ select uji.simpan(p_tanggal => '2999-01-01') $q$);
select uji.harus_ditolak('Kelas tidak sesuai jenjang (SMA kelas 7) ditolak',
  $q$ select uji.simpan(p_kelas => 7::smallint) $q$);
select uji.harus_ditolak('Status sekolah tidak dikenal ditolak',
  $q$ select uji.simpan(p_sekolah => 'kuliahan') $q$);
select uji.harus_ditolak('No. HP tidak sah ditolak',
  $q$ select uji.simpan(p_hp => '12345') $q$);
select uji.harus_ditolak('Nama panggilan lebih dari 40 karakter ditolak',
  $q$ select uji.simpan(p_panggilan => repeat('a', 41)) $q$);
-- Tanggal lahir & status sekolah kosong = tetap (tidak terhapus)
select uji.simpan(p_tanggal => null, p_sekolah => '');
reset role;
select uji.cek('Tanggal lahir & status sekolah kosong tidak menghapus data',
  (select tanggal_lahir = '2008-04-14' and status_sekolah = 'sma_smk'
   from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Setelah ditolak: data tetap generus (bukan lansia)',
  (select tahun_lahir = 2008 from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1'));

-- Lulus SMA → kuliah: kelas dikosongkan otomatis, tetap generus
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.simpan(p_sekolah => 'kuliah', p_kelas => null);
reset role;
select uji.cek('Lulus SMA → kuliah: kelas kosong & tetap generus',
  (select status_sekolah = 'kuliah' and kelas is null and termasuk_generus
   from public.jamaah_dengan_kategori where id = '00000000-0000-0000-0000-0000000000f1'));

-- PIN awal & bukan generus
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.harus_ditolak('Generus dengan PIN awal tidak bisa mengubah data',
  $q$ select uji.simpan(p_sekolah => 'smp', p_kelas => 9::smallint) $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.harus_ditolak('Admin (bukan akun generus) tidak bisa memakai RPC generus',
  $q$ select uji.simpan() $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.harus_ditolak('RPC lama ubah_profil_saya sudah ditutup',
  $q$ select public.ubah_profil_saya('A', null, null) $q$);
select uji.harus_ditolak('Generus tidak bisa menulis catatan sendiri',
  $q$ insert into public.perubahan_data_generus (jamaah_id, bagian)
      values ('00000000-0000-0000-0000-0000000000f1', 'alamat') returning 1 $q$);
select uji.harus_ditolak('Generus tidak bisa menandai catatannya sudah dicek',
  $q$ update public.perubahan_data_generus set diperiksa_at = now() returning 1 $q$);
select uji.cek('Generus melihat catatan miliknya sendiri',
  (select count(*) > 0 from public.perubahan_data_generus));

-- Alamat lewat RPC lama ikut tercatat
select public.ubah_alamat_saya('35.06', 'Kediri', 'Jl. Melati 1', 1::smallint, 2::smallint, null, true,
  null, null, null, null, null, null);
reset role;
select uji.cek('Alamat yang diubah generus tercatat (tanpa isinya)',
  exists (select 1 from public.perubahan_data_generus
          where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and bagian = 'alamat' and nilai_baru is null));

-- Admin: melihat & menandai sesuai wilayah
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.cek('Admin kelompok 2 tidak melihat catatan jamaah K1',
  not exists (select 1 from public.perubahan_data_generus));
select uji.harus_ditolak('Admin kelompok 2 tidak bisa menandai catatan jamaah K1',
  $q$ update public.perubahan_data_generus set diperiksa_at = now() returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin desa melihat catatan', (select count(*) > 0 from public.perubahan_data_generus));
select uji.harus_ditolak('Admin tidak bisa mengubah isi catatan',
  $q$ update public.perubahan_data_generus set nilai_baru = 'x' where bagian = 'kelas' returning 1 $q$);
update public.perubahan_data_generus set diperiksa_at = now();
reset role;
select uji.cek('Admin desa menandai sudah dicek, pemeriksa tercatat',
  not exists (select 1 from public.perubahan_data_generus
              where diperiksa_at is null or diperiksa_by is distinct from '00000000-0000-0000-0000-0000000000a1'));

-- Alamat yang diubah admin tidak dicatat sebagai perubahan generus
create temp table jumlah2 as select count(*) as n from public.perubahan_data_generus;
grant select on jumlah2 to authenticated;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
update public.jamaah_pribadi set ktp_jalan = 'Jl. Mawar 2' where jamaah_id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select uji.cek('Perubahan alamat oleh admin tidak dicatat',
  (select count(*) from public.perubahan_data_generus) = (select n from jumlah2));

select uji.cek('Realtime: perubahan_data_generus disiarkan',
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = 'perubahan_data_generus'));

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memanggil ubah_data_diri_saya', $q$ select uji.simpan() $q$);
select uji.harus_ditolak('Anon: tidak bisa membaca catatan',
  $q$ select 1 from public.perubahan_data_generus $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 28, 'Jumlah skenario profil mandiri generus');
select * from finish();
rollback;
