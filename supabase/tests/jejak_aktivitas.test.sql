-- =====================================================================
-- Tes migrasi 20261101120000_jejak_aktivitas: pencatatan otomatis
-- perubahan data penting (nama kolom saja) & aksesnya (hanya pengembang).
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

grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';

-- Perubahan oleh pengguna (auth.uid terisi)
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
insert into public.kelompok (nama, nomor) values ('Kelompok Jejak', 92);
insert into public.jamaah (nama_lengkap, jenis_kelamin, kelompok_id, tahun_lahir, status_pernikahan, status_sekolah)
select 'Ahmad Jejak', 'L', id, 1980, 'menikah', 'bekerja' from public.kelompok where nomor = 92;
update public.jamaah set tahun_lahir = 1981 where nama_lengkap = 'Ahmad Jejak';
update public.jamaah set tahun_lahir = 1981 where nama_lengkap = 'Ahmad Jejak'; -- tanpa perubahan
insert into public.jamaah_identitas (jamaah_id, nik)
select id, '3201010101010001' from public.jamaah where nama_lengkap = 'Ahmad Jejak';

select uji.cek('Tambah jamaah tercatat dengan label & pelaku',
  exists (select 1 from public.jejak_aktivitas where tabel = 'jamaah' and aksi = 'insert'
          and label = 'Ahmad Jejak' and oleh = '00000000-0000-0000-0000-0000000000a1'
          and jamaah_id = (select id from public.jamaah where nama_lengkap = 'Ahmad Jejak')));
select uji.cek('Ubah jamaah: kolom yang berubah saja',
  (select 'tahun_lahir' = any (kolom) and not ('updated_at' = any (kolom))
   from public.jejak_aktivitas where tabel = 'jamaah' and aksi = 'update' limit 1));
select uji.cek('Update tanpa perubahan tidak dicatat',
  (select count(*) = 1 from public.jejak_aktivitas where tabel = 'jamaah' and aksi = 'update'));
select uji.cek('Data identitas: label dari nama jamaah, isi NIK tidak tersimpan',
  (select label = 'Ahmad Jejak' and kolom is null and not (to_jsonb(j)::text like '%3201010101010001%')
   from public.jejak_aktivitas j where tabel = 'jamaah_identitas'));

select uji.cek('Peran admin: label nama admin',
  exists (select 1 from public.jejak_aktivitas where tabel = 'penugasan_peran' and label = 'Dev'));

-- Absensi: insert tidak dicatat, update dicatat (cek pemicu terpasang)
select uji.cek('Absensi: pemicu hanya ubah & hapus',
  (select tgtype & 4 = 0 and tgtype & 16 = 16 and tgtype & 8 = 8 from pg_trigger
   where tgrelid = 'public.absensi'::regclass and tgname = 'catat_jejak'));
select uji.cek('Tabel penting punya pemicu jejak',
  (select count(*) >= 28 from pg_trigger where tgname = 'catat_jejak'));

-- Akses
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin desa: tidak melihat jejak', not exists (select 1 from public.jejak_aktivitas));
select uji.harus_ditolak('Admin desa: tidak bisa menulis jejak',
  $q$ insert into public.jejak_aktivitas (tabel, aksi) values ('x', 'insert') returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Pengembang: melihat jejak', exists (select 1 from public.jejak_aktivitas));
select uji.harus_ditolak('Pengembang: tidak bisa mengubah jejak',
  $q$ update public.jejak_aktivitas set label = 'x' returning 1 $q$);
select uji.harus_ditolak('Pengembang: tidak bisa menghapus jejak',
  $q$ delete from public.jejak_aktivitas returning 1 $q$);
reset role;

-- Pembersihan 180 hari
insert into public.jejak_aktivitas (tabel, aksi, created_at) values ('lama', 'update', now() - interval '200 days');
select private.bersihkan_riwayat();
select uji.cek('Jejak > 180 hari dibersihkan', not exists (select 1 from public.jejak_aktivitas where tabel = 'lama'));
select uji.cek('Jejak baru tetap ada', exists (select 1 from public.jejak_aktivitas where tabel = 'jamaah'));

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 14, 'Jumlah skenario jejak aktivitas');
select * from finish();
rollback;
