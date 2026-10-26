-- =====================================================================
-- Tes migrasi 20261022010000_kartu_fisik_keringanan: kartu QR fisik untuk
-- generus hanya bila berpenanda keringanan; selain generus tetap boleh.
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

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'kel1@uji.id'),
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id');
insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000b2', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Desa');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
select '00000000-0000-0000-0000-0000000000b2', p.id, k.id
from public.peran p, public.kelompok k where p.kode = 'admin_kelompok' and k.nomor = 1;

-- f1 generus, f2 generus keringanan, f3 dewasa (bukan generus), f4 generus (kartu lama)
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select v.id::uuid, (select id from public.kelompok where nomor = 1), v.nama, 'L', 'x',
  v.nikah::public.status_pernikahan, v.sekolah::public.status_sekolah, v.tahun
from (values
  ('00000000-0000-0000-0000-0000000000f1', 'Generus Biasa',      'lajang',  'smp',     2012),
  ('00000000-0000-0000-0000-0000000000f2', 'Generus Keringanan', 'lajang',  'smp',     2012),
  ('00000000-0000-0000-0000-0000000000f3', 'Dewasa',             'menikah', 'bekerja', 1985),
  ('00000000-0000-0000-0000-0000000000f4', 'Generus Kartu Lama', 'lajang',  'sma_smk', 2009)
) v(id, nama, nikah, sekolah, tahun);
insert into public.jamaah_keringanan (jamaah_id) values ('00000000-0000-0000-0000-0000000000f2');
-- Kartu lama f4 dibuat saat ia masih tercatat bukan generus.
update public.jamaah set status_sekolah = 'bekerja', status_pernikahan = 'menikah'
where id = '00000000-0000-0000-0000-0000000000f4';
insert into public.kartu_qr (jamaah_id, token) values ('00000000-0000-0000-0000-0000000000f4', '');
update public.jamaah set status_sekolah = 'sma_smk', status_pernikahan = 'lajang'
where id = '00000000-0000-0000-0000-0000000000f4';
select uji.sesi('00000000-0000-0000-0000-0000000000e1', 'Pengajian K1', id, false, now())
from public.kelompok where nomor = 1;

set local role authenticated;
-- Kartu QR dikelola tingkat kelompok saja (20261026100000, izin kartu.kelola).
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.harus_ditolak('Desa: membuat kartu ditolak (wewenang kelompok)',
  $q$ select (public.ganti_kartu_qr('00000000-0000-0000-0000-0000000000f3')).id $q$);
select uji.cek('Desa: buat massal tidak membuat kartu',
  public.buat_kartu_qr_kelompok((select id from public.kelompok where nomor = 1)) = 0);
select uji.harus_ditolak('Desa: mencabut kartu ditolak',
  $q$ update public.kartu_qr set aktif = false where jamaah_id = '00000000-0000-0000-0000-0000000000f4' returning 1 $q$);
select uji.cek('Desa: tetap melihat kartu (untuk scan sesi desa)', (select count(*) from public.kartu_qr) = 1);
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');

select uji.cek('boleh_kartu_fisik: generus biasa = false',
  not private.boleh_kartu_fisik('00000000-0000-0000-0000-0000000000f1'));
select uji.cek('boleh_kartu_fisik: generus keringanan = true',
  private.boleh_kartu_fisik('00000000-0000-0000-0000-0000000000f2'));
select uji.cek('boleh_kartu_fisik: bukan generus = true',
  private.boleh_kartu_fisik('00000000-0000-0000-0000-0000000000f3'));

select uji.harus_ditolak('Kartu generus tanpa keringanan ditolak',
  $q$ select (public.ganti_kartu_qr('00000000-0000-0000-0000-0000000000f1')).id $q$);
select uji.harus_berhasil('Kartu generus keringanan boleh',
  $q$ select (public.ganti_kartu_qr('00000000-0000-0000-0000-0000000000f2')).id $q$);
select uji.cek('Buat massal: hanya f2 & f3 (generus biasa dilewati)',
  public.buat_kartu_qr_kelompok((select id from public.kelompok where nomor = 1)) = 2);
select uji.cek('Generus biasa tetap tanpa kartu',
  not exists (select 1 from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1'));

create temp table tok on commit drop as
  select jamaah_id, token from public.kartu_qr where aktif;
select uji.cek('Scan kartu dewasa: tercatat',
  public.catat_absensi_kode('00000000-0000-0000-0000-0000000000e1',
    (select token from tok where jamaah_id = '00000000-0000-0000-0000-0000000000f3')) ->> 'hasil' = 'tercatat');
select uji.cek('Scan kartu lama generus tanpa keringanan: pakai_akun',
  public.catat_absensi_kode('00000000-0000-0000-0000-0000000000e1',
    (select token from tok where jamaah_id = '00000000-0000-0000-0000-0000000000f4')) ->> 'hasil' = 'pakai_akun');
select uji.cek('Ketik kode KW- generus tetap bisa dicatat admin',
  public.catat_absensi_kode('00000000-0000-0000-0000-0000000000e1',
    (select kode from public.jamaah where id = '00000000-0000-0000-0000-0000000000f1')) ->> 'hasil' = 'tercatat');

-- Cabut keringanan → kartu ikut dicabut.
update public.jamaah_keringanan set aktif = false where jamaah_id = '00000000-0000-0000-0000-0000000000f2';
select uji.cek('Keringanan dicabut → kartu f2 dicabut',
  not exists (select 1 from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f2' and aktif));
select uji.cek('Kartu dewasa tidak tersentuh',
  exists (select 1 from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f3' and aktif));
select uji.harus_ditolak('Mengaktifkan lagi kartu yang dicabut ditolak',
  $q$ update public.kartu_qr set aktif = true, dicabut_at = null
      where jamaah_id = '00000000-0000-0000-0000-0000000000f2' returning 1 $q$);

reset role;
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 12, 'Jumlah skenario kartu fisik');
select * from finish();
rollback;
