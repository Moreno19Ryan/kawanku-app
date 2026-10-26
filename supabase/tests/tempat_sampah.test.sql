-- =====================================================================
-- Tes migrasi 20261029100000_tempat_sampah: hapus → tempat sampah 30 hari,
-- kembalikan (beserta yang ikut terhapus), wewenang, kedaluwarsa. Di-rollback.
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

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'K2');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_kelompok', 2);

-- Data K1: keluarga dengan 2 anggota, jamaah ber-kontak, kegiatan berjadwal + pertemuan + izin disetujui.
insert into public.keluarga (id, kelompok_id, nama)
select '00000000-0000-0000-0000-0000000000e1', id, 'Keluarga Budi' from public.kelompok where nomor = 1;
insert into public.jamaah (id, kelompok_id, keluarga_id, hubungan_keluarga, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select x.id::uuid, k.id, '00000000-0000-0000-0000-0000000000e1', x.hub::public.hubungan_keluarga, x.nama, 'L', 'x', 'menikah', 'bekerja', 1980
from public.kelompok k, (values ('00000000-0000-0000-0000-0000000000f1', 'kepala_keluarga', 'Budi Ayah'),
                               ('00000000-0000-0000-0000-0000000000f2', 'pasangan', 'Siti Ibu')) x(id, hub, nama)
where k.nomor = 1;
insert into public.jamaah_kontak (jamaah_id, no_hp) values ('00000000-0000-0000-0000-0000000000f1', '081234567890');
create temp table kode_awal as select kode from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1';
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit, berlaku_mulai)
select '00000000-0000-0000-0000-0000000000c1', 'Pengajian Uji', 'rutin', id, 60, current_date - 30 from public.kelompok where nomor = 1;
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam) values ('00000000-0000-0000-0000-0000000000c1', 2, '19:30');
insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai, pemateri_nama)
select '00000000-0000-0000-0000-0000000000c1', id, current_date + 3, now() + interval '3 days', 'Ust. Hasan'
from public.kelompok where nomor = 1;
insert into public.pengajuan_izin (jamaah_id, kegiatan_id, tanggal, jenis, alasan_izin, keterangan)
values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', current_date + 3, 'izin', 'kerja', 'Lembur');
update public.pengajuan_izin set status = 'disetujui';

select uji.cek('pg_cron: kosongkan tempat sampah tiap hari',
  exists (select 1 from cron.job where jobname = 'kawanku-tempat-sampah'));

-- Hapus jamaah (K1) → tempat sampah, beserta kontaknya.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.harus_berhasil('K1: hapus jamaah',
  $q$ delete from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1' returning 1 $q$);
delete from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1';
select uji.cek('K1: entri tempat sampah jamaah + ikut terhapus',
  (select jenis = 'jamaah' and label like 'Budi Ayah (KW-%' and jumlah_ikut >= 1
          and kedaluwarsa_at > now() + interval '29 days' and dihapus_oleh = auth.uid()
   from public.tempat_sampah where baris_id = '00000000-0000-0000-0000-0000000000f1'));
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.cek('K2: tidak melihat tempat sampah K1', not exists (select 1 from public.tempat_sampah));
select uji.harus_ditolak('K2: tidak bisa mengembalikan',
  $q$ select public.kembalikan_dari_sampah((select id from public.tempat_sampah limit 1)) $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin desa: tidak melihat (data jamaah dikelola kelompok)', not exists (select 1 from public.tempat_sampah));
reset role;

-- Hapus keluarga (K1) → anggota dilepas & dicatat.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
delete from public.keluarga where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
select uji.cek('Keluarga dihapus: anggota tersisa dilepas',
  (select keluarga_id is null from public.jamaah where id = '00000000-0000-0000-0000-0000000000f2'));

-- Jamaah dikembalikan sebelum keluarganya → ditolak (induk tidak ada).
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.harus_ditolak('Kembalikan jamaah sebelum keluarganya: ditolak',
  $q$ select public.kembalikan_dari_sampah((select id from public.tempat_sampah where jenis = 'jamaah')) $q$);
select uji.cek('Kembalikan keluarga',
  (public.kembalikan_dari_sampah((select id from public.tempat_sampah where jenis = 'keluarga'))->>'dikembalikan')::int = 1);
select uji.cek('Kembalikan jamaah (+ kontak)',
  (public.kembalikan_dari_sampah((select id from public.tempat_sampah where jenis = 'jamaah'))->>'dikembalikan')::int >= 2);
reset role;
select uji.cek('Jamaah kembali dengan kode yang sama & di keluarganya',
  (select kode = (select kode from kode_awal) and keluarga_id = '00000000-0000-0000-0000-0000000000e1'
   from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Kontaknya kembali', exists (select 1 from public.jamaah_kontak where jamaah_id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('Anggota keluarga yang dilepas dipasang lagi',
  (select keluarga_id = '00000000-0000-0000-0000-0000000000e1' and hubungan_keluarga = 'pasangan'
   from public.jamaah where id = '00000000-0000-0000-0000-0000000000f2'));
select uji.cek('Tempat sampah kosong lagi', not exists (select 1 from public.tempat_sampah));

-- Kegiatan: hapus → jadwal, pertemuan, izin ikut; kembalikan → apa adanya.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
delete from public.kegiatan where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select uji.cek('Kegiatan terhapus beserta pertemuan & izin',
  not exists (select 1 from public.pertemuan where kegiatan_id = '00000000-0000-0000-0000-0000000000c1')
  and not exists (select 1 from public.pengajuan_izin where kegiatan_id = '00000000-0000-0000-0000-0000000000c1'));
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select public.kembalikan_dari_sampah((select id from public.tempat_sampah where jenis = 'kegiatan'));
reset role;
select uji.cek('Kegiatan kembali: jadwal, pertemuan (pemateri), izin tetap disetujui',
  exists (select 1 from public.kegiatan_jadwal where kegiatan_id = '00000000-0000-0000-0000-0000000000c1')
  and exists (select 1 from public.pertemuan where kegiatan_id = '00000000-0000-0000-0000-0000000000c1' and pemateri_nama = 'Ust. Hasan')
  and exists (select 1 from public.pengajuan_izin where kegiatan_id = '00000000-0000-0000-0000-0000000000c1' and status = 'disetujui'));

-- Hapus anak saja (bukan lewat akar) tidak masuk tempat sampah.
delete from public.jamaah_kontak where jamaah_id = '00000000-0000-0000-0000-0000000000f1';
select uji.cek('Hapus kontak saja: tidak masuk tempat sampah', not exists (select 1 from public.tempat_sampah));

-- Hapus permanen & kedaluwarsa.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
delete from public.jamaah where id = '00000000-0000-0000-0000-0000000000f2';
reset role;
create temp table sampah_k1 as select id from public.tempat_sampah;
grant select on sampah_k1 to authenticated;
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.harus_ditolak('K2: tidak bisa hapus permanen milik K1',
  $q$ select public.hapus_permanen_sampah((select id from sampah_k1)) $q$);
reset role;
select uji.cek('Entri K1 masih ada', exists (select 1 from public.tempat_sampah));
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select public.hapus_permanen_sampah((select id from public.tempat_sampah limit 1));
select uji.cek('K1: hapus permanen', not exists (select 1 from public.tempat_sampah));
delete from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
update public.tempat_sampah set kedaluwarsa_at = now() - interval '1 minute';
select uji.cek('Lewat 30 hari: dikosongkan otomatis', private.kosongkan_tempat_sampah() = 1);
select uji.cek('Isi ikut terhapus', not exists (select 1 from private.tempat_sampah_isi));

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca', $q$ select 1 from public.tempat_sampah $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 20, 'Jumlah skenario tempat sampah');
select * from finish();
rollback;
