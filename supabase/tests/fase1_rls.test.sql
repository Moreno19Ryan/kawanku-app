-- =====================================================================
-- Tes RLS & aturan Fase 1 (pgTAP). Dijalankan `supabase test db` di stack
-- Supabase lokal/CI. Semua dalam satu transaksi yang di-rollback.
-- Sumber: docs/schema-proposal.md Lampiran A, disesuaikan untuk Supabase
-- (auth.users asli, request.jwt.claims, tanpa session_replication_role).
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

-- Lulus bila p_sql GAGAL (dan pesannya cocok dengan p_pola bila diisi).
-- Bila p_sql ternyata berhasil, efeknya dibatalkan lalu dicatat GAGAL.
create function uji.harus_gagal(p_nama text, p_sql text, p_pola text default null)
returns void language plpgsql as $$
declare v_pesan text;
begin
  begin
    execute p_sql;
    raise exception 'TIDAK_GAGAL';
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (
    p_nama,
    v_pesan <> 'TIDAK_GAGAL' and (p_pola is null or v_pesan ilike '%' || p_pola || '%'),
    v_pesan);
end $$;

-- Lulus bila p_sql BERHASIL (efeknya dibatalkan).
create function uji.harus_berhasil(p_nama text, p_sql text)
returns void language plpgsql as $$
declare v_pesan text;
begin
  begin
    execute p_sql;
    raise exception 'BERHASIL';
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (p_nama, v_pesan = 'BERHASIL', v_pesan);
end $$;

create function uji.sebagai(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, true);
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- Kategori jamaah menurut view (dipakai banyak tes).
create function uji.kategori(p_nama text) returns text language sql as $$
  select kategori_jamaah_kode from public.jamaah_dengan_kategori where nama_lengkap = p_nama;
$$;
grant execute on function uji.kategori(text) to authenticated;

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB, seperti SQL Editor)
-- ---------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- admin desa
  ('00000000-0000-0000-0000-00000000000b'),  -- admin kelompok 1
  ('00000000-0000-0000-0000-00000000000c'),  -- admin generus desa
  ('00000000-0000-0000-0000-00000000000e'),  -- admin generus kelompok 1
  ('00000000-0000-0000-0000-00000000000d'),  -- admin tanpa penugasan
  ('00000000-0000-0000-0000-00000000000f');  -- pengguna login biasa (calon akun generus)
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-00000000000a', 'Desa'),
  ('00000000-0000-0000-0000-00000000000b', 'Kelompok 1'),
  ('00000000-0000-0000-0000-00000000000c', 'Generus Desa'),
  ('00000000-0000-0000-0000-00000000000e', 'Generus K1'),
  ('00000000-0000-0000-0000-00000000000d', 'Tanpa Peran');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-00000000000a', id, null from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-00000000000b', p.id, k.id from public.peran p, public.kelompok k
  where p.kode = 'admin_kelompok' and k.nomor = 1;
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-00000000000c', id, null from public.peran where kode = 'admin_generus';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-00000000000e', p.id, k.id from public.peran p, public.kelompok k
  where p.kode = 'admin_generus' and k.nomor = 1;

-- 13 jamaah; 6 di antaranya generus (K1: 3, K2: 1, K3: 1, K4: 1).
insert into public.jamaah
  (kelompok_id, nama_lengkap, tanggal_lahir, tahun_lahir, jenis_kelamin,
   status_pernikahan, status_sekolah, kode)
select k.id, v.nama, v.tgl, v.thn, v.jk::public.jenis_kelamin,
       v.nikah::public.status_pernikahan, v.sekolah::public.status_sekolah, 'KW-ABCDEF'
from public.kelompok k
join (values
  (1, 'K1 Menikah Bekerja 40',  (current_date - interval '40 years')::date, null::smallint, 'L', 'menikah', 'bekerja'),
  (1, 'K1 SMP',                 (current_date - interval '15 years')::date, null, 'P', 'lajang',  'smp'),
  (1, 'K1 Lajang Bekerja 25',   (current_date - interval '25 years')::date, null, 'L', 'lajang',  'bekerja'),
  (1, 'K1 Lansia 65 Bekerja',   (current_date - interval '65 years')::date, null, 'P', 'lajang',  'bekerja'),
  (1, 'K1 SD',                  (current_date - interval '8 years')::date,  null, 'L', null,      'sd'),
  (1, 'K1 SMA Tahun Saja',      null, (extract(year from current_date)::int - 16)::smallint, 'P', 'lajang', 'sma_smk'),
  (1, 'K1 Tanpa Kategori',      (current_date - interval '30 years')::date, null, 'L', 'lajang',  null),
  (1, 'K1 Duda 45',             (current_date - interval '45 years')::date, null, 'L', 'janda_duda', null),
  (2, 'K2 SMA',                 (current_date - interval '17 years')::date, null, 'L', 'lajang',  'sma_smk'),
  (2, 'K2 Janda 50',            (current_date - interval '50 years')::date, null, 'P', 'janda_duda', null),
  (2, 'K2 Lansia Tahun Saja',   null, (extract(year from current_date)::int - 70)::smallint, 'L', null, null),
  (3, 'K3 SMP Tanpa Lahir',     null, null, 'P', 'lajang',  'smp'),
  (4, 'K4 Kuliah',              (current_date - interval '22 years')::date, null, 'L', 'lajang',  'kuliah')
) as v(nomor, nama, tgl, thn, jk, nikah, sekolah) on v.nomor = k.nomor;

insert into public.jamaah_janda_duda (jamaah_id, jenis)
  select id, 'cerai_mati'::public.jenis_janda_duda from public.jamaah where nama_lengkap = 'K2 Janda 50';
insert into public.jamaah_janda_duda (jamaah_id, jenis)
  select id, 'cerai_hidup'::public.jenis_janda_duda from public.jamaah where nama_lengkap = 'K1 Duda 45';

insert into public.jamaah_keringanan (jamaah_id)
  select id from public.jamaah where nama_lengkap = 'K1 SMP';

-- ---------------------------------------------------------------------
-- Tes struktur (sebagai pemilik DB)
-- ---------------------------------------------------------------------
select uji.cek('Kode: semua jamaah punya kode KW- + 6 karakter tanpa 0/O/1/I/L',
  (select bool_and(kode ~ '^KW-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$') from public.jamaah));
select uji.cek('Kode: unik untuk 13 jamaah (nilai dari klien "KW-ABCDEF" diabaikan)',
  (select count(distinct kode) = 13 from public.jamaah));
select uji.harus_gagal('Kode: update kode ditolak trigger',
  $q$ update public.jamaah set kode = 'KW-ZZZZZZ' where nama_lengkap = 'K1 SD' $q$, 'tidak boleh diubah');
select uji.harus_gagal('Tahun lahir: tahun beda dengan tanggal lahir ditolak (check)',
  $q$ insert into public.jamaah (kelompok_id, nama_lengkap, tanggal_lahir, tahun_lahir, jenis_kelamin)
      select id, 'Tes', '2010-05-01', 2011, 'L' from public.kelompok where nomor = 1 $q$, 'jamaah_tahun_sesuai_tanggal');
select uji.harus_berhasil('Tahun lahir: tahun sama dengan tanggal lahir diterima',
  $q$ insert into public.jamaah (kelompok_id, nama_lengkap, tanggal_lahir, tahun_lahir, jenis_kelamin)
      select id, 'Tes', '2010-05-01', 2010, 'L' from public.kelompok where nomor = 1 $q$);
select uji.cek('Janda/duda: keterangan cerai_mati & cerai_hidup tersimpan di tabel terpisah',
  (select count(*) = 2 from public.jamaah_janda_duda));
select uji.cek('Janda/duda: tabel jamaah tidak punya kolom keterangan janda/duda',
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'jamaah' and column_name like '%janda%'));
select uji.harus_gagal('Janda/duda: keterangan untuk jamaah yang bukan janda_duda ditolak (trigger)',
  $q$ insert into public.jamaah_janda_duda (jamaah_id, jenis)
      select id, 'cerai_hidup' from public.jamaah where nama_lengkap = 'K1 SD' $q$, 'hanya untuk jamaah berstatus janda_duda');
select uji.harus_gagal('Janda/duda: jenis wajib diisi bila barisnya ada',
  $q$ insert into public.jamaah_janda_duda (jamaah_id, jenis)
      select id, null from public.jamaah where nama_lengkap = 'K2 Janda 50' $q$, 'null value');
select uji.harus_gagal('Kategori: usia_max < usia_min ditolak (check)',
  $q$ insert into public.kategori_jamaah (kode, nama, usia_min, usia_max, urutan)
      values ('x', 'X', 30, 20, 99) $q$, 'kategori_jamaah_rentang_usia');
select uji.harus_gagal('Penugasan: admin_kelompok tanpa kelompok_id ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-00000000000d', id from public.peran where kode = 'admin_kelompok' $q$, 'wajib memiliki kelompok_id');
select uji.harus_gagal('Penugasan: admin_desa dengan kelompok_id ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-00000000000d', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_desa' and k.nomor = 2 $q$, 'tidak boleh memiliki kelompok_id');
select uji.harus_berhasil('Penugasan: admin_generus tanpa kelompok_id diterima',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-00000000000d', id from public.peran where kode = 'admin_generus' $q$);
select uji.harus_berhasil('Penugasan: admin_generus dengan kelompok_id diterima',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-00000000000d', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 3 $q$);
select uji.cek('Policy: tidak ada policy FOR ALL',
  (select count(*) = 0 from pg_policies where schemaname = 'public' and cmd = 'ALL'));
select uji.cek('Policy: maksimal satu policy per tabel per perintah',
  (select coalesce(max(n), 0) = 1 from (select count(*) n from pg_policies
     where schemaname = 'public' group by tablename, cmd) s));
select uji.cek('RLS: aktif di semua tabel public',
  (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'));
select uji.cek('GRANT: anon tidak punya hak apa pun di tabel/view public',
  (select count(*) = 0 from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'));
select uji.cek('GRANT: authenticated hanya SELECT pada kedua view',
  (select array_agg(distinct privilege_type::text) = array['SELECT']
   from information_schema.role_table_grants
   where grantee = 'authenticated'
     and table_name in ('jamaah_dengan_kategori', 'jamaah_tanpa_kategori')));

-- Kategori (langsung dari view sebagai pemilik)
select uji.cek('Kategori: lajang SMP → pra_remaja',
  uji.kategori('K1 SMP') = 'pra_remaja');
select uji.cek('Kategori: SMP tanpa tanggal & tahun lahir tetap pra_remaja (umur tidak dipakai)',
  uji.kategori('K3 SMP Tanpa Lahir') = 'pra_remaja');
select uji.cek('Kategori: lajang bekerja (25) → remaja_dewasa (generus)',
  (select kategori_jamaah_kode = 'remaja_dewasa' and termasuk_generus
   from public.jamaah_dengan_kategori where nama_lengkap = 'K1 Lajang Bekerja 25'));
select uji.cek('Kategori: umur 65 bekerja → lansia (urutan 1 menang atas remaja_dewasa urutan 6)',
  uji.kategori('K1 Lansia 65 Bekerja') = 'lansia');
select uji.cek('Kategori: menikah + bekerja → berkeluarga (urutan 2 menang atas remaja_dewasa urutan 6)',
  uji.kategori('K1 Menikah Bekerja 40') = 'berkeluarga');
select uji.cek('Kategori: janda_duda, status sekolah kosong → berkeluarga',
  uji.kategori('K2 Janda 50') = 'berkeluarga');
select uji.cek('Kategori: SD → caberawit',
  uji.kategori('K1 SD') = 'caberawit');
select uji.cek('Tahun lahir: dipakai bila tanggal_lahir kosong (usia 16 dari tahun lahir)',
  (select usia = 16 and kategori_jamaah_kode = 'remaja_muda'
   from public.jamaah_dengan_kategori where nama_lengkap = 'K1 SMA Tahun Saja'));
select uji.cek('Tahun lahir: umur 70 dari tahun lahir saja → lansia',
  uji.kategori('K2 Lansia Tahun Saja') = 'lansia');
select uji.cek('Tanpa kategori: sekolah kosong, lajang, umur 30 → tidak punya kategori',
  (select kategori_jamaah_id is null and not termasuk_generus
   from public.jamaah_dengan_kategori where nama_lengkap = 'K1 Tanpa Kategori'));
select uji.cek('jamaah_tanpa_kategori: berisi tepat jamaah aktif yang tak cocok kategori mana pun',
  (select array_agg(nama_lengkap) = array['K1 Tanpa Kategori'] from public.jamaah_tanpa_kategori));

-- Trigger status_sekolah_diperbarui
select uji.cek('status_sekolah_diperbarui: diisi hari ini saat insert dengan status sekolah',
  (select status_sekolah_diperbarui = current_date from public.jamaah where nama_lengkap = 'K1 SD'));
select uji.cek('status_sekolah_diperbarui: kosong saat insert tanpa status sekolah',
  (select status_sekolah_diperbarui is null from public.jamaah where nama_lengkap = 'K1 Tanpa Kategori'));
-- Simulasikan data lama (lewati trigger hanya untuk menyiapkan tanggal lampau).
alter table public.jamaah disable trigger jamaah_status_sekolah_diperbarui;
update public.jamaah set status_sekolah_diperbarui = date '2020-07-15' where nama_lengkap = 'K2 SMA';
alter table public.jamaah enable trigger jamaah_status_sekolah_diperbarui;
update public.jamaah set nama_panggilan = 'Adi' where nama_lengkap = 'K2 SMA';
select uji.cek('status_sekolah_diperbarui: tidak berubah bila status_sekolah tidak berubah',
  (select status_sekolah_diperbarui = date '2020-07-15' from public.jamaah where nama_lengkap = 'K2 SMA'));
update public.jamaah set status_sekolah_diperbarui = date '1999-01-01' where nama_lengkap = 'K2 SMA';
select uji.cek('status_sekolah_diperbarui: nilai manual dari klien diabaikan',
  (select status_sekolah_diperbarui = date '2020-07-15' from public.jamaah where nama_lengkap = 'K2 SMA'));

-- ---------------------------------------------------------------------
-- Tes RLS per peran
-- ---------------------------------------------------------------------
set role authenticated;

-- Admin desa
select uji.sebagai('00000000-0000-0000-0000-00000000000a');
select uji.cek('Admin desa: melihat 13/13 jamaah dan 1 penanda keringanan',
  (select count(*) = 13 from public.jamaah) and (select count(*) = 1 from public.jamaah_keringanan));
select uji.cek('Admin desa: melihat 2 keterangan janda/duda (default izin hanya admin desa)',
  (select count(*) = 2 from public.jamaah_janda_duda));
select uji.cek('Admin desa: jamaah_tanpa_kategori berisi 1 baris',
  (select count(*) = 1 from public.jamaah_tanpa_kategori));

-- Admin kelompok 1
select uji.sebagai('00000000-0000-0000-0000-00000000000b');
select uji.cek('Admin kelompok 1: hanya melihat 8 jamaah Kelompok 1',
  (select count(*) = 8 and bool_and(nama_lengkap like 'K1 %') from public.jamaah));
select uji.cek('Admin kelompok 1: melihat duda di kelompoknya, tapi TIDAK melihat keterangan janda/duda',
  (select count(*) = 1 from public.jamaah where nama_lengkap = 'K1 Duda 45')
  and (select count(*) = 0 from public.jamaah_janda_duda));
select uji.harus_gagal('Admin kelompok 1: mengisi keterangan janda/duda ditolak',
  $q$ insert into public.jamaah_janda_duda (jamaah_id, jenis)
      select id, 'cerai_mati' from public.jamaah where nama_lengkap = 'K1 Duda 45' $q$, 'row-level security');
select uji.harus_gagal('Admin kelompok 1: menambah jamaah ke Kelompok 2 ditolak',
  $q$ insert into public.jamaah (kelompok_id, nama_lengkap, jenis_kelamin)
      select id, 'Penyusup', 'L' from public.kelompok where nomor = 2 $q$, 'row-level security');
select uji.harus_gagal('Admin kelompok 1: memindahkan jamaah ke Kelompok 2 ditolak',
  $q$ update public.jamaah set kelompok_id = (select id from public.kelompok where nomor = 2)
      where nama_lengkap = 'K1 SD' $q$, 'row-level security');
select uji.harus_gagal('Admin kelompok 1: memberi dirinya peran admin_desa ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-00000000000b', id from public.peran where kode = 'admin_desa' $q$, 'row-level security');
select uji.cek('Admin kelompok 1: tetap bisa membaca peran/izin (admin aktif)',
  (select count(*) = 3 from public.peran) and (select count(*) > 0 from public.izin));

-- Admin generus tingkat desa
select uji.sebagai('00000000-0000-0000-0000-00000000000c');
select uji.cek('Admin generus desa: melihat 6 jamaah generus di 4 kelompok',
  (select count(*) = 6 and count(distinct kelompok_id) = 4 from public.jamaah));
select uji.cek('Admin generus desa: tidak melihat jamaah non-generus',
  (select bool_and(termasuk_generus) from public.jamaah_dengan_kategori));
select uji.cek('Admin generus desa: jamaah tanpa kategori tidak terlihat (juga di jamaah_tanpa_kategori)',
  (select count(*) = 0 from public.jamaah where nama_lengkap = 'K1 Tanpa Kategori')
  and (select count(*) = 0 from public.jamaah_tanpa_kategori));
select uji.cek('Admin generus desa: melihat penanda keringanan jamaah generus',
  (select count(*) = 1 from public.jamaah_keringanan));
select uji.cek('Admin generus desa: tidak melihat keterangan janda/duda',
  (select count(*) = 0 from public.jamaah_janda_duda));
select uji.cek('Admin generus desa: tidak melihat keluarga (tanpa izin keluarga)',
  (select count(*) = 0 from public.keluarga));
select uji.harus_gagal('Admin generus: mengubah status_sekolah hingga keluar cakupan ditolak (WITH CHECK)',
  $q$ update public.jamaah set status_sekolah = 'sd' where nama_lengkap = 'K2 SMA' $q$, 'row-level security');
select uji.harus_gagal('Admin generus: mengosongkan status_sekolah hingga keluar cakupan ditolak (WITH CHECK)',
  $q$ update public.jamaah set status_sekolah = null where nama_lengkap = 'K2 SMA' $q$, 'row-level security');
select uji.harus_gagal('Admin generus: mengubah status_pernikahan menjadi menikah ditolak (WITH CHECK)',
  $q$ update public.jamaah set status_pernikahan = 'menikah' where nama_lengkap = 'K4 Kuliah' $q$, 'row-level security');
select uji.harus_berhasil('Admin generus: mengubah status_sekolah yang tetap generus (sma_smk → kuliah) diterima',
  $q$ update public.jamaah set status_sekolah = 'kuliah' where nama_lengkap = 'K2 SMA' $q$);

-- Admin generus Kelompok 1
select uji.sebagai('00000000-0000-0000-0000-00000000000e');
select uji.cek('Admin generus Kelompok 1: hanya melihat 3 generus Kelompok 1',
  (select count(*) = 3 and bool_and(nama_lengkap like 'K1 %') from public.jamaah));
select uji.cek('Admin generus Kelompok 1: tidak melihat generus kelompok lain',
  (select count(*) = 0 from public.jamaah where nama_lengkap not like 'K1 %'));

-- Izin global tidak pernah lolos untuk peran hanya_generus
reset role;
insert into public.peran_izin (peran_id, izin_kode)
  select id, 'kelompok.kelola' from public.peran where kode = 'admin_generus';
set role authenticated;
select uji.sebagai('00000000-0000-0000-0000-00000000000c');
select uji.harus_gagal('Admin generus desa + izin global kelompok.kelola tetap tidak bisa menambah kelompok',
  $q$ insert into public.kelompok (nomor, nama) values (9, 'Kelompok 9') $q$, 'row-level security');
reset role;
delete from public.peran_izin
  where izin_kode = 'kelompok.kelola' and peran_id = (select id from public.peran where kode = 'admin_generus');

-- Perubahan status sekolah & pernikahan oleh admin desa
set role authenticated;
select uji.sebagai('00000000-0000-0000-0000-00000000000a');
update public.jamaah set status_sekolah = 'sma_smk' where nama_lengkap = 'K1 SMP';
select uji.cek('Status sekolah SMP → SMA/SMK: kategori pra_remaja → remaja_muda (umur tidak berubah)',
  uji.kategori('K1 SMP') = 'remaja_muda');
select uji.cek('status_sekolah_diperbarui: menjadi hari ini saat status_sekolah berubah',
  (select status_sekolah_diperbarui = current_date from public.jamaah where nama_lengkap = 'K1 SMP'));
update public.jamaah set status_pernikahan = 'menikah' where nama_lengkap = 'K1 Lajang Bekerja 25';
select uji.cek('Lajang bekerja → menikah: kategori remaja_dewasa → berkeluarga',
  uji.kategori('K1 Lajang Bekerja 25') = 'berkeluarga');
select uji.cek('updated_by terisi otomatis dengan admin yang mengubah',
  (select updated_by = '00000000-0000-0000-0000-00000000000a' from public.jamaah where nama_lengkap = 'K1 Lajang Bekerja 25'));
select uji.sebagai('00000000-0000-0000-0000-00000000000c');
select uji.cek('... dan jamaah itu hilang dari cakupan admin generus desa (6 → 5)',
  (select count(*) = 5 from public.jamaah)
  and (select count(*) = 0 from public.jamaah where nama_lengkap = 'K1 Lajang Bekerja 25'));

-- Duda menikah lagi: admin kelompok mengubah status tanpa melihat keterangan;
-- keterangan terhapus otomatis.
select uji.sebagai('00000000-0000-0000-0000-00000000000b');
select uji.harus_berhasil('Admin kelompok 1: mengubah status duda menjadi menikah diterima tanpa error',
  $q$ update public.jamaah set status_pernikahan = 'menikah' where nama_lengkap = 'K1 Duda 45' $q$);
update public.jamaah set status_pernikahan = 'menikah' where nama_lengkap = 'K1 Duda 45';
reset role;
select uji.cek('Duda menikah lagi (sungguhan): keterangan terhapus, keterangan K2 tetap ada',
  (select array_agg(j.nama_lengkap) = array['K2 Janda 50'] from public.jamaah_janda_duda jd
   join public.jamaah j on j.id = jd.jamaah_id));

-- Izin bisa diberikan lewat data: admin_kelompok diberi janda_duda.lihat
insert into public.jamaah (kelompok_id, nama_lengkap, jenis_kelamin, status_pernikahan)
  select id, 'K1 Janda 55', 'P', 'janda_duda' from public.kelompok where nomor = 1;
insert into public.jamaah_janda_duda (jamaah_id, jenis)
  select id, 'cerai_hidup' from public.jamaah where nama_lengkap = 'K1 Janda 55';
insert into public.peran_izin (peran_id, izin_kode)
  select id, 'janda_duda.lihat' from public.peran where kode = 'admin_kelompok';
set role authenticated;
select uji.sebagai('00000000-0000-0000-0000-00000000000b');
select uji.cek('Izin janda_duda.lihat diberi ke admin_kelompok lewat data: admin K1 melihat keterangan K1 saja, bukan K2',
  (select array_agg(j.nama_lengkap) = array['K1 Janda 55'] from public.jamaah_janda_duda jd
   join public.jamaah j on j.id = jd.jamaah_id));
reset role;
delete from public.peran_izin
  where izin_kode = 'janda_duda.lihat' and peran_id = (select id from public.peran where kode = 'admin_kelompok');
delete from public.jamaah where nama_lengkap = 'K1 Janda 55';
set role authenticated;

-- Admin tanpa penugasan
select uji.sebagai('00000000-0000-0000-0000-00000000000d');
select uji.cek('Login tanpa penugasan: tidak bisa membaca peran/izin/peran_izin',
  (select count(*) = 0 from public.peran) and (select count(*) = 0 from public.izin)
  and (select count(*) = 0 from public.peran_izin));
select uji.cek('Login tanpa penugasan: bisa membaca 4 kelompok dan 6 kategori jamaah',
  (select count(*) = 4 from public.kelompok) and (select count(*) = 6 from public.kategori_jamaah));
select uji.cek('Login tanpa penugasan: 0 jamaah, 0 keringanan, 0 keterangan janda/duda, 0 baris jamaah_tanpa_kategori',
  (select count(*) = 0 from public.jamaah) and (select count(*) = 0 from public.jamaah_keringanan)
  and (select count(*) = 0 from public.jamaah_janda_duda)
  and (select count(*) = 0 from public.jamaah_tanpa_kategori));

-- Pengguna login tanpa baris admin (calon akun generus Fase 2)
select uji.sebagai('00000000-0000-0000-0000-00000000000f');
select uji.cek('Pengguna login non-admin: tidak bisa membaca peran/izin, 0 jamaah',
  (select count(*) = 0 from public.peran) and (select count(*) = 0 from public.izin)
  and (select count(*) = 0 from public.jamaah));
select uji.cek('Pengguna login non-admin: bisa membaca kelompok & kategori jamaah',
  (select count(*) = 4 from public.kelompok) and (select count(*) = 6 from public.kategori_jamaah));
reset role;

-- Anon
set role anon;
select uji.harus_gagal('Anon: membaca jamaah ditolak', $q$ select * from public.jamaah $q$, 'permission denied');
select uji.harus_gagal('Anon: membaca view jamaah_dengan_kategori ditolak', $q$ select * from public.jamaah_dengan_kategori $q$, 'permission denied');
select uji.harus_gagal('Anon: membaca view jamaah_tanpa_kategori ditolak', $q$ select * from public.jamaah_tanpa_kategori $q$, 'permission denied');
select uji.harus_gagal('Anon: membaca keterangan janda/duda ditolak', $q$ select * from public.jamaah_janda_duda $q$, 'permission denied');
select uji.harus_gagal('Anon: membaca kelompok ditolak', $q$ select * from public.kelompok $q$, 'permission denied');
select uji.harus_gagal('Anon: memanggil fungsi private ditolak', $q$ select private.boleh('jamaah.lihat', null) $q$, 'permission denied');
reset role;

-- ---------------------------------------------------------------------
-- Laporan pgTAP
-- ---------------------------------------------------------------------
select ok(lulus, no || '. ' || nama || coalesce(' :: ' || catatan, ''))
from uji.hasil order by no;
select ok((select count(*) from uji.hasil) >= 70, 'jumlah skenario lengkap');
select * from finish();
rollback;
