-- =====================================================================
-- Tes migrasi 20261022080000_kategori_kebal_urutan: kategori generus hanya
-- untuk lajang (constraint) dan RPC atur_urutan_kategori (RLS, lengkap).
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
grant execute on all functions in schema uji to anon, authenticated;

create function uji.kategori(p_nama text) returns text language sql as $$
  select kategori_jamaah_kode from public.jamaah_dengan_kategori where nama_lengkap = p_nama;
$$;
create function uji.urutan_dibalik() returns void language sql as $$
  select public.atur_urutan_kategori(array(select id from public.kategori_jamaah order by urutan desc));
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000c2', 'kel1@uji.id');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000c1', 'Desa'), ('00000000-0000-0000-0000-0000000000c2', 'Kelompok 1');
select uji.beri('00000000-0000-0000-0000-0000000000c1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000c2', 'admin_kelompok', 1);

insert into public.jamaah (kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select (select id from public.kelompok where nomor = 1), v.nama, 'L', 'x',
       v.nikah::public.status_pernikahan, v.sekolah::public.status_sekolah,
       (extract(year from current_date)::int - v.usia)::smallint
from (values
  ('Menikah Bekerja 48', 'menikah', 'bekerja', 48),
  ('Lajang Bekerja 25',  'lajang',  'bekerja', 25),
  ('Lajang SMP 14',      'lajang',  'smp',     14)
) v(nama, nikah, sekolah, usia);

-- Constraint
select uji.cek('Semua kategori generus khusus lajang',
  (select bool_and(status_pernikahan_berlaku = '{lajang}') from public.kategori_jamaah where termasuk_generus));
select uji.harus_ditolak('Kategori generus tanpa syarat lajang ditolak',
  $q$ update public.kategori_jamaah set status_pernikahan_berlaku = null where kode = 'remaja_dewasa' returning 1 $q$);
select uji.harus_ditolak('Kategori generus yang memuat menikah ditolak',
  $q$ insert into public.kategori_jamaah (kode, nama, status_pernikahan_berlaku, termasuk_generus, urutan)
      values ('x', 'X', '{lajang,menikah}', true, 99) returning 1 $q$);
select uji.harus_berhasil('Kategori bukan generus tetap bebas syarat pernikahan',
  $q$ insert into public.kategori_jamaah (kode, nama, status_pernikahan_berlaku, urutan)
      values ('y', 'Y', '{menikah}', 99) returning 1 $q$);
select uji.cek('Kategori awal: menikah bekerja → berkeluarga, lajang bekerja → remaja_dewasa',
  uji.kategori('Menikah Bekerja 48') = 'berkeluarga' and uji.kategori('Lajang Bekerja 25') = 'remaja_dewasa');

-- RPC atur_urutan_kategori
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000c2');
select uji.harus_ditolak('Admin kelompok: tidak bisa mengatur urutan', $q$ select uji.urutan_dibalik() $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.harus_ditolak('Daftar tidak lengkap ditolak',
  $q$ select public.atur_urutan_kategori(array(select id from public.kategori_jamaah limit 2)) $q$);
select uji.harus_ditolak('Daftar ganda ditolak',
  $q$ select public.atur_urutan_kategori(array(select id from public.kategori_jamaah, generate_series(1, 2) order by urutan limit 6)) $q$);
select uji.urutan_dibalik();
select uji.cek('Admin desa: urutan dibalik (Remaja Dewasa paling atas)',
  (select kode from public.kategori_jamaah order by urutan limit 1) = 'remaja_dewasa'
  and (select min(urutan) = 1 and max(urutan) = 6 from public.kategori_jamaah));
reset role;
select uji.cek('Urutan dibalik pun: jamaah menikah tetap berkeluarga, bukan generus',
  uji.kategori('Menikah Bekerja 48') = 'berkeluarga'
  and not (select termasuk_generus from public.jamaah_dengan_kategori where nama_lengkap = 'Menikah Bekerja 48'));
select uji.cek('Lajang SMP tetap pra_remaja', uji.kategori('Lajang SMP 14') = 'pra_remaja');

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa memanggil atur_urutan_kategori',
  $q$ select public.atur_urutan_kategori('{}') $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 12, 'Jumlah skenario kategori');
select * from finish();
rollback;
