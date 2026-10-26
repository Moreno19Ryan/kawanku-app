-- =====================================================================
-- Tes migrasi 20261022090000_usulan_koreksi_terapkan: nilai terstruktur
-- pada laporan koreksi generus dan RPC terapkan_usulan_koreksi (RLS, satu
-- transaksi). Satu transaksi, di-rollback.
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
grant execute on all functions in schema uji to anon, authenticated;

create function uji.kategori(p_id uuid) returns text language sql as $$
  select kategori_jamaah_kode from public.jamaah_dengan_kategori where id = p_id;
$$;
create function uji.usulan(p_jamaah uuid, p_bagian text, p_nilai text, p_kelas smallint default null)
returns uuid language sql as $$
  insert into public.usulan_koreksi (jamaah_id, bagian, isi, nilai, nilai_kelas)
  values (p_jamaah, p_bagian, 'keterangan', p_nilai, p_kelas) returning id;
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000d2', 'gen1@uji.id'),
  ('00000000-0000-0000-0000-0000000000d3', 'kel2@uji.id'),
  ('00000000-0000-0000-0000-0000000000d4', 'kel1@uji.id');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000d1', 'Desa'), ('00000000-0000-0000-0000-0000000000d2', 'Generus K1'),
  ('00000000-0000-0000-0000-0000000000d3', 'Kelompok 2'), ('00000000-0000-0000-0000-0000000000d4', 'Kelompok 1');
select uji.beri('00000000-0000-0000-0000-0000000000d1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000d2', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000d3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000d4', 'admin_kelompok', 1);

-- e1 SMA kelas 12 (K1), e2 lajang bekerja (K1), e3 lajang kuliah (K1)
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir, kelas)
select v.id::uuid, (select id from public.kelompok where nomor = 1), v.nama, 'L', 'x', 'lajang',
       v.sekolah::public.status_sekolah, v.tahun, v.kelas
from (values
  ('00000000-0000-0000-0000-0000000000e1', 'Sma Duabelas', 'sma_smk', 2008, 12),
  ('00000000-0000-0000-0000-0000000000e2', 'Lajang Kerja', 'bekerja', 2000, null),
  ('00000000-0000-0000-0000-0000000000e3', 'Lajang Kuliah', 'kuliah', 2004, null)
) v(id, nama, sekolah, tahun, kelas);

create temp table u as select
  uji.usulan('00000000-0000-0000-0000-0000000000e1', 'status_sekolah', 'kuliah') as lulus,
  uji.usulan('00000000-0000-0000-0000-0000000000e2', 'status_pernikahan', 'menikah') as nikah,
  uji.usulan('00000000-0000-0000-0000-0000000000e3', 'tanggal_lahir', '2004-03-05') as lahir,
  uji.usulan('00000000-0000-0000-0000-0000000000e3', 'lainnya', null) as bebas;
grant select on u to authenticated, anon;

-- Validasi nilai
select uji.harus_ditolak('Nilai status sekolah tidak dikenal ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi, nilai)
      values ('00000000-0000-0000-0000-0000000000e2', 'status_sekolah', 'x', 'kuliahan') returning 1 $q$);
select uji.harus_ditolak('Kelas tidak sesuai jenjang (SMP kelas 11) ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi, nilai, nilai_kelas)
      values ('00000000-0000-0000-0000-0000000000e2', 'status_sekolah', 'x', 'smp', 11) returning 1 $q$);
select uji.harus_ditolak('Nilai pada bagian bebas (nama lengkap) ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi, nilai)
      values ('00000000-0000-0000-0000-0000000000e2', 'nama_lengkap', 'x', 'Budi') returning 1 $q$);
select uji.harus_berhasil('Status sekolah SMA kelas 11 diterima',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi, nilai, nilai_kelas)
      values ('00000000-0000-0000-0000-0000000000e2', 'status_sekolah', 'x', 'sma_smk', 11) returning 1 $q$);
select uji.harus_ditolak('Nilai usulan tidak bisa diubah setelah dikirim',
  $q$ update public.usulan_koreksi set nilai = 'bekerja' where id = (select lulus from u) returning 1 $q$);

set local role authenticated;
-- Admin generus K1: menerapkan "menikah" membuat jamaah keluar dari generus → ditolak
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.harus_ditolak('Admin generus: menerapkan menikah (keluar generus) ditolak',
  $q$ select public.terapkan_usulan_koreksi((select nikah from u)) $q$);
-- Admin kelompok 2: jamaah K1 di luar wilayahnya
select uji.sebagai('00000000-0000-0000-0000-0000000000d3');
select uji.harus_ditolak('Admin K2: tidak bisa menerapkan laporan jamaah K1',
  $q$ select public.terapkan_usulan_koreksi((select lulus from u)) $q$);
reset role;
select uji.cek('Setelah ditolak: jamaah tetap lajang & laporan tetap menunggu',
  (select status_pernikahan = 'lajang' from public.jamaah where id = '00000000-0000-0000-0000-0000000000e2')
  and (select status = 'menunggu' from public.usulan_koreksi where id = (select nikah from u)));

set local role authenticated;
-- Menerapkan = mengubah data jamaah: wewenang kelompok (20261026100000).
select uji.sebagai('00000000-0000-0000-0000-0000000000d1');
select uji.harus_ditolak('Admin desa: tidak bisa menerapkan laporan (wewenang kelompok)',
  $q$ select public.terapkan_usulan_koreksi((select lulus from u)) $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000d4');
select uji.cek('Admin K1: terapkan lulus SMA → kuliah',
  public.terapkan_usulan_koreksi((select lulus from u)) = 'status_sekolah');
select uji.cek('Admin K1: terapkan menikah', public.terapkan_usulan_koreksi((select nikah from u), 'Barakallah') = 'status_pernikahan');
select uji.cek('Admin K1: terapkan tanggal lahir', public.terapkan_usulan_koreksi((select lahir from u)) = 'tanggal_lahir');
select uji.harus_ditolak('Laporan tanpa nilai tidak bisa diterapkan',
  $q$ select public.terapkan_usulan_koreksi((select bebas from u)) $q$);
select uji.harus_ditolak('Laporan yang sudah selesai tidak bisa diterapkan lagi',
  $q$ select public.terapkan_usulan_koreksi((select lulus from u)) $q$);
reset role;

select uji.cek('Hasil: SMA 12 → kuliah, kelas kosong, kategori remaja_dewasa',
  (select status_sekolah = 'kuliah' and kelas is null from public.jamaah where id = '00000000-0000-0000-0000-0000000000e1')
  and uji.kategori('00000000-0000-0000-0000-0000000000e1') = 'remaja_dewasa');
select uji.cek('Hasil: menikah → kategori berkeluarga (keluar generus)',
  uji.kategori('00000000-0000-0000-0000-0000000000e2') = 'berkeluarga');
select uji.cek('Hasil: tanggal lahir & tahun lahir diperbarui',
  (select tanggal_lahir = '2004-03-05' and tahun_lahir = 2004 from public.jamaah where id = '00000000-0000-0000-0000-0000000000e3'));
select uji.cek('Laporan selesai, tanggapan bawaan & tanggapan admin tersimpan, penanganan tercatat',
  (select status = 'selesai' and tanggapan = 'Sudah diperbarui sesuai laporanmu.'
          and ditangani_by = '00000000-0000-0000-0000-0000000000d4' and ditangani_at is not null
   from public.usulan_koreksi where id = (select lulus from u))
  and (select tanggapan = 'Barakallah' from public.usulan_koreksi where id = (select nikah from u)));

-- Tanggal lahir di masa depan ditolak saat diterapkan
select uji.harus_ditolak('Tanggal lahir di masa depan tidak bisa diterapkan',
  $q$ select public.terapkan_usulan_koreksi(uji.usulan('00000000-0000-0000-0000-0000000000e1', 'tanggal_lahir', '2999-01-01')) $q$);

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memanggil terapkan_usulan_koreksi',
  $q$ select public.terapkan_usulan_koreksi(gen_random_uuid()) $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 18, 'Jumlah skenario terapkan usulan');
select * from finish();
rollback;
