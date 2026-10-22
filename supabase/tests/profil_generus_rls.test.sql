-- =====================================================================
-- Tes migrasi 20261022020000_profil_generus: generus mengubah nama panggilan,
-- no. HP & email sendiri; usulan koreksi data ke admin.
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

-- Sejak 20261022120000 profil diubah lewat ubah_data_diri_saya (RPC lama ditutup).
create function uji.profil(p_panggilan text, p_hp text, p_email text) returns void language sql as $$
  select public.ubah_data_diri_saya(p_panggilan, null, null, 'smp', null, null, null, p_hp, p_email,
                                    '082222222222', null, null);
$$;
grant execute on function uji.profil(text, text, text) to anon, authenticated;

insert into auth.users (id, email) values
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

-- f1 generus K1 (akun c1), f2 generus K1 (akun c2, PIN awal), f3 generus K1 tanpa akun
insert into public.jamaah (id, kelompok_id, nama_lengkap, nama_panggilan, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select v.id::uuid, (select id from public.kelompok where nomor = 1), v.nama, 'Lama', 'L', 'x', 'lajang', 'smp', 2012
from (values
  ('00000000-0000-0000-0000-0000000000f1', 'Generus Satu'),
  ('00000000-0000-0000-0000-0000000000f2', 'Generus Dua'),
  ('00000000-0000-0000-0000-0000000000f3', 'Generus Tiga')
) v(id, nama);
insert into public.akun_generus (user_id, jamaah_id, username, pin_awal) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'satu', false),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2', 'dua', true);
insert into public.jamaah_kontak (jamaah_id, no_hp, no_hp_wali) values
  ('00000000-0000-0000-0000-0000000000f1', '081111111111', '082222222222'),
  ('00000000-0000-0000-0000-0000000000f3', '083333333333', null);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Generus satu: profil
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: melihat kontaknya sendiri saja',
  (select array_agg(no_hp) from public.jamaah_kontak) = array['081111111111']);
select uji.harus_ditolak('Gen: tidak bisa update kontak langsung',
  $q$ update public.jamaah_kontak set no_hp = '089999999999' returning 1 $q$);
select uji.harus_ditolak('Gen: tidak bisa update jamaah langsung',
  $q$ update public.jamaah set nama_lengkap = 'Ganti' returning 1 $q$);
select uji.profil('  Satu   Baru ', '085555555555', 'Satu@Contoh.ID');
select uji.cek('Gen: nama panggilan berubah (dirapikan)',
  (select nama_panggilan = 'Satu Baru' and nama_lengkap = 'Generus Satu' from public.jamaah));
select uji.cek('Gen: no HP & email berubah, HP wali tetap',
  (select no_hp = '085555555555' and email = 'satu@contoh.id' and no_hp_wali = '082222222222'
   from public.jamaah_kontak));
select uji.profil('', '', '');
select uji.cek('Gen: mengosongkan isian',
  (select nama_panggilan is null from public.jamaah)
  and (select no_hp is null and email is null and no_hp_wali = '082222222222' from public.jamaah_kontak));
select uji.harus_ditolak('Gen: no HP tidak valid ditolak',
  $q$ select uji.profil('x', '12345', '') $q$);
select uji.harus_ditolak('Gen: nama panggilan > 40 ditolak',
  $q$ select uji.profil(repeat('a', 41), '', '') $q$);

-- Usulan koreksi
select uji.harus_berhasil('Gen: kirim usulan untuk dirinya',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi)
      values ('00000000-0000-0000-0000-0000000000f1', 'tanggal_lahir', 'Lahir 5 Maret 2012') returning 1 $q$);
insert into public.usulan_koreksi (id, jamaah_id, bagian, isi, status, tanggapan)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
        'tanggal_lahir', 'Lahir 5 Maret 2012', 'selesai', 'curang');
select uji.cek('Gen: usulan baru selalu menunggu tanpa tanggapan',
  (select status = 'menunggu' and tanggapan is null from public.usulan_koreksi));
select uji.harus_ditolak('Gen: usulan bagian yang sama saat masih menunggu ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi)
      values ('00000000-0000-0000-0000-0000000000f1', 'tanggal_lahir', 'lagi') returning 1 $q$);
select uji.harus_ditolak('Gen: usulan untuk jamaah lain ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi)
      values ('00000000-0000-0000-0000-0000000000f3', 'nama_lengkap', 'x') returning 1 $q$);
select uji.harus_ditolak('Gen: tidak bisa menandai usulannya selesai',
  $q$ update public.usulan_koreksi set status = 'selesai' returning 1 $q$);
select uji.harus_ditolak('Gen: bagian tidak dikenal ditolak',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi)
      values ('00000000-0000-0000-0000-0000000000f1', 'nik', 'x') returning 1 $q$);
insert into public.usulan_koreksi (id, jamaah_id, bagian, isi)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', 'status_sekolah', 'Sudah SMA');

-- ---------------------------------------------------------------------
-- Generus dua (PIN awal)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c2');
select uji.harus_ditolak('Gen PIN awal: ubah profil ditolak',
  $q$ select uji.profil('x', '', '') $q$);
select uji.cek('Gen2: tidak melihat usulan orang lain', not exists (select 1 from public.usulan_koreksi));

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000b3');
select uji.cek('Admin K2: tidak melihat usulan K1', not exists (select 1 from public.usulan_koreksi));
select uji.harus_ditolak('Admin K2: tidak bisa menangani usulan K1',
  $q$ update public.usulan_koreksi set status = 'selesai' returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('Admin K1: melihat 2 usulan', (select count(*) from public.usulan_koreksi) = 2);
update public.usulan_koreksi set status = 'selesai', tanggapan = 'Sudah dibetulkan'
where id = '00000000-0000-0000-0000-0000000000a1';
select uji.cek('Admin K1: penanganan tercatat otomatis',
  (select status = 'selesai' and ditangani_by = '00000000-0000-0000-0000-0000000000b2' and ditangani_at is not null
   from public.usulan_koreksi where id = '00000000-0000-0000-0000-0000000000a1'));
select uji.harus_ditolak('Admin K1: isi usulan tidak bisa diubah',
  $q$ update public.usulan_koreksi set isi = 'lain' returning 1 $q$);
select uji.harus_ditolak('Admin K1: tidak bisa menghapus usulan',
  $q$ delete from public.usulan_koreksi returning 1 $q$);
select uji.cek('Admin K1: melihat kontak generus K1 (izin kontak.lihat)',
  (select count(*) from public.jamaah_kontak) = 2);

-- ---------------------------------------------------------------------
-- Generus satu: batalkan & lihat tanggapan
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: melihat tanggapan admin',
  (select tanggapan = 'Sudah dibetulkan' from public.usulan_koreksi where id = '00000000-0000-0000-0000-0000000000a1'));
select uji.harus_ditolak('Gen: tidak bisa menghapus usulan yang sudah ditangani',
  $q$ delete from public.usulan_koreksi where id = '00000000-0000-0000-0000-0000000000a1' returning 1 $q$);
select uji.harus_berhasil('Gen: membatalkan usulan yang masih menunggu',
  $q$ delete from public.usulan_koreksi where id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_berhasil('Gen: setelah selesai, boleh kirim lagi bagian yang sama',
  $q$ insert into public.usulan_koreksi (jamaah_id, bagian, isi)
      values ('00000000-0000-0000-0000-0000000000f1', 'tanggal_lahir', 'Masih salah') returning 1 $q$);

reset role;
set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca usulan', $q$ select 1 from public.usulan_koreksi $q$);
select uji.harus_ditolak('Anon: tidak bisa memanggil ubah_profil_saya', $q$ select uji.profil('', '', '') $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 25, 'Jumlah skenario profil generus');
select * from finish();
rollback;
