-- =====================================================================
-- Tes migrasi 20261028090000_pemantau_galat: pencatatan galat aplikasi
-- (catat_galat) dan aksesnya (hanya pengembang). Satu transaksi, di-rollback.
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

-- Anon (galat server tanpa sesi) bisa mencatat, tapi tidak bisa membaca/menulis langsung.
set local role anon;
select public.catat_galat('server', 'Gagal memuat', '/dashboard', 'render', 'd1');
select public.catat_galat('server', 'Gagal memuat', '/dashboard', 'render', 'd2');
select public.catat_galat('klien', repeat('x', 900), '/jamaah/[id]', 'klien', null);
select public.catat_galat('lain', 'Sumber asing diabaikan', null, null, null);
select uji.harus_ditolak('Anon: tidak bisa membaca', $q$ select 1 from public.galat_aplikasi $q$);
select uji.harus_ditolak('Anon: tidak bisa menulis langsung',
  $q$ insert into public.galat_aplikasi (sidik, sumber, pesan) values ('s', 'server', 'p') returning 1 $q$);
reset role;

select uji.cek('Galat sama digabung: jumlah 2, digest terakhir',
  (select jumlah = 2 and digest = 'd2' from public.galat_aplikasi where rute = '/dashboard'));
select uji.cek('Pesan dipotong 500 karakter',
  (select length(pesan) = 500 from public.galat_aplikasi where sumber = 'klien'));
select uji.cek('Sumber di luar server/klien diabaikan', (select count(*) = 2 from public.galat_aplikasi));

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin desa: tidak melihat galat', not exists (select 1 from public.galat_aplikasi));
select uji.harus_ditolak('Admin desa: tidak bisa menandai dicek',
  $q$ update public.galat_aplikasi set dicek_at = now() returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Pengembang: melihat galat', (select count(*) = 2 from public.galat_aplikasi));
select uji.harus_berhasil('Pengembang: menandai dicek',
  $q$ update public.galat_aplikasi set dicek_at = now(), dicek_oleh = auth.uid() returning 1 $q$);
update public.galat_aplikasi set dicek_at = now();
select uji.harus_ditolak('Pengembang: tidak bisa mengubah pesan',
  $q$ update public.galat_aplikasi set pesan = 'ubah' returning 1 $q$);
select uji.harus_ditolak('Pengembang: tidak bisa menghapus',
  $q$ delete from public.galat_aplikasi returning 1 $q$);
select public.catat_galat('server', 'Gagal memuat', '/dashboard', 'render', 'd3');
select uji.cek('Galat terulang: dibuka lagi (dicek_at kosong)',
  (select dicek_at is null and jumlah = 3 from public.galat_aplikasi where rute = '/dashboard'));
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 11, 'Jumlah skenario pemantau galat');
select * from finish();
rollback;
