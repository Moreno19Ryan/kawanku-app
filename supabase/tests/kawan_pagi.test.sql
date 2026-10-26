-- =====================================================================
-- Tes migrasi 20261030090000_kawan_pagi_rapor: ringkasan hari ini (admin),
-- notifikasi pagi, dan rapor bulanan generus. Satu transaksi, di-rollback.
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
create function uji.kel(p_nomor int) returns uuid language sql as $$
  select id from public.kelompok where nomor = p_nomor;
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- Waktu uji tetap: Senin 2 November 2026 06.00 WIB.
create temp table jam (t timestamptz);
insert into jam values ('2026-11-02 06:00:00+07');
grant select on jam to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000b1');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'K2'), ('00000000-0000-0000-0000-0000000000a4', 'Gen K1');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000a4', 'admin_generus', 1);

update public.kegiatan set aktif = false;

-- Jamaah: generus K1 (milad hari ini, berakun), jamaah dewasa K1 (milad hari ini), generus K2.
insert into public.jamaah (id, kelompok_id, nama_lengkap, nama_panggilan, jenis_kelamin, kode, status_pernikahan, status_sekolah, tanggal_lahir) values
  ('00000000-0000-0000-0000-0000000000f1', uji.kel(1), 'Fajar Generus', 'Fajar', 'L', 'g1', 'lajang', 'sma_smk', '2010-11-02'),
  ('00000000-0000-0000-0000-0000000000f2', uji.kel(1), 'Bapak Dewasa', null, 'L', 'd1', 'menikah', 'bekerja', '1980-11-02'),
  ('00000000-0000-0000-0000-0000000000f3', uji.kel(2), 'Generus K2', null, 'P', 'g2', 'lajang', 'sma_smk', '2010-05-05');
insert into public.akun_generus (user_id, jamaah_id, username, created_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'fajar', '2026-09-01');

-- Kegiatan: K1 rutin Senin 19.30 (tanpa pemateri), K2 agenda hari ini (ada pemateri),
-- desa agenda besok (tanpa pemateri), K1 rutin generus Senin 16.00 dibatalkan hari ini.
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit, berlaku_mulai) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pengajian K1', 'rutin', uji.kel(1), 90, '2026-10-01'),
  ('00000000-0000-0000-0000-0000000000c2', 'Pengajian K2', 'agenda', uji.kel(2), 90, '2026-10-01'),
  ('00000000-0000-0000-0000-0000000000c3', 'Pengajian Desa', 'agenda', null, 90, '2026-10-01');
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit, berlaku_mulai, hanya_generus) values
  ('00000000-0000-0000-0000-0000000000c4', 'Generus K1', 'rutin', uji.kel(1), 90, '2026-10-01', true);
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam) values
  ('00000000-0000-0000-0000-0000000000c1', 1, '19:30'), ('00000000-0000-0000-0000-0000000000c4', 1, '16:00');
insert into public.pertemuan (kegiatan_id, tanggal, mulai, pemateri_nama) values
  ('00000000-0000-0000-0000-0000000000c2', '2026-11-02', '2026-11-02 19:30+07', 'Ust. Ahmad');
insert into public.pertemuan (kegiatan_id, tanggal, mulai) values
  ('00000000-0000-0000-0000-0000000000c3', '2026-11-03', '2026-11-03 19:30+07');
insert into public.pertemuan (kegiatan_id, tanggal, mulai, status, alasan_batal) values
  ('00000000-0000-0000-0000-0000000000c4', '2026-11-02', '2026-11-02 16:00+07', 'dibatalkan', 'Libur');

select uji.cek('Kalender: rutin + agenda + batal (hari ini & besok)',
  (select count(*) = 4 from private.kejadian_antara('2026-11-02', '2026-11-03')));
select uji.cek('Kalender: pertemuan dibatalkan tetap satu baris berstatus dibatalkan',
  (select status = 'dibatalkan' from private.kejadian_antara('2026-11-02', '2026-11-02')
   where kegiatan_id = '00000000-0000-0000-0000-0000000000c4'));

-- Pengajuan izin menunggu: generus K1 untuk pengajian K1 hari ini.
insert into public.pengajuan_izin (jamaah_id, kegiatan_id, kelompok_id, tanggal, jenis, alasan_izin, keterangan)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', uji.kel(1),
        '2026-11-02', 'izin', 'sekolah', 'Ujian');

select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
create temp table r_k1 as select private.ringkasan_hari((select t from jam)) as r;
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
create temp table r_k2 as select private.ringkasan_hari((select t from jam)) as r;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
create temp table r_desa as select private.ringkasan_hari((select t from jam)) as r;
select uji.sebagai('00000000-0000-0000-0000-0000000000a4');
create temp table r_gen as select private.ringkasan_hari((select t from jam)) as r;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
create temp table r_generus as select private.ringkasan_hari((select t from jam)) as r;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.harus_ditolak('Fungsi private tidak bisa dipanggil langsung lewat API',
  $q$ select 1 from private.ringkasan_hari(now()) $q$);
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

select uji.cek('K1: 1 pertemuan hari ini (pengajian K1 rutin)',
  (select (r->>'pertemuan')::int = 1 from r_k1));
select uji.cek('K1: pemateri kosong = K1 rutin hari ini', (select (r->>'tanpa_pemateri')::int = 1 from r_k1));
select uji.cek('K1: 1 izin menunggu', (select (r->>'izin')::int = 1 from r_k1));
select uji.cek('K1: milad Fajar & Bapak Dewasa',
  (select r->'milad' = '["Bapak Dewasa", "Fajar"]'::jsonb from r_k1));
select uji.cek('K2: 1 pertemuan, tanpa pemateri 0, izin 0, milad kosong',
  (select (r->>'pertemuan')::int = 1 and (r->>'tanpa_pemateri')::int = 0 and (r->>'izin')::int = 0
          and r->'milad' = '[]'::jsonb from r_k2));
select uji.cek('Desa: melihat 2 pertemuan hari ini, pemateri kosong hanya kegiatan desa (besok)',
  (select (r->>'pertemuan')::int = 2 and (r->>'tanpa_pemateri')::int = 1 from r_desa));
select uji.cek('Desa: izin kelompok bukan wewenangnya', (select (r->>'izin')::int = 0 from r_desa));
select uji.cek('Admin generus K1: milad hanya generus', (select r->'milad' = '["Fajar"]'::jsonb from r_gen));
select uji.cek('Akun generus: bukan admin → kosong', (select r is null from r_generus));
select uji.cek('Kalimat ringkasan',
  (select private.kalimat_ringkasan(r) = '1 pertemuan hari ini · 1 izin menunggu persetujuan · 1 pertemuan belum ada pemateri · Milad hari ini: Bapak Dewasa, Fajar' from r_k1));
select uji.cek('Kalimat kosong → null',
  private.kalimat_ringkasan('{"pertemuan":0,"izin":0,"tanpa_pemateri":0,"milad":[]}'::jsonb) is null);

-- Notifikasi pagi: hanya admin yang berlangganan, di jendela pagi, identitas dikembalikan.
insert into public.langganan_notifikasi (user_id, endpoint, p256dh, auth_key) values
  ('00000000-0000-0000-0000-0000000000a2', 'https://push.example/k1', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000a3', 'https://push.example/k2', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000000b1', 'https://push.example/b1', 'k', 'a');
create temp table pagi as select * from private.notifikasi_jatuh_tempo((select t from jam));
select uji.cek('Pagi: K1 menerima ringkasannya',
  exists (select 1 from pagi where user_id = '00000000-0000-0000-0000-0000000000a2'
          and kunci = 'pagi:2026-11-02' and judul = 'Ringkasan hari ini' and isi like '1 pertemuan hari ini%'
          and url = '/dashboard'));
select uji.cek('Pagi: K2 menerima ringkasan wilayahnya sendiri',
  exists (select 1 from pagi where user_id = '00000000-0000-0000-0000-0000000000a3' and isi = '1 pertemuan hari ini'));
select uji.cek('Pagi: admin tanpa langganan tidak dikirimi',
  not exists (select 1 from pagi where user_id = '00000000-0000-0000-0000-0000000000a1'));
select uji.cek('Pagi: identitas JWT dikembalikan setelah menghitung',
  coalesce(current_setting('request.jwt.claim.sub', true), '') = '');
select uji.cek('Pagi: di luar 05.30–09.00 tidak dikirim',
  not exists (select 1 from private.notifikasi_jatuh_tempo((select t from jam) + interval '4 hours')
              where kunci like 'pagi:%'));
insert into public.notifikasi_terkirim (user_id, kunci) values ('00000000-0000-0000-0000-0000000000a2', 'pagi:2026-11-02');
select uji.cek('Pagi: sudah terkirim hari ini → tidak dihitung lagi',
  not exists (select 1 from private.notifikasi_jatuh_tempo((select t from jam) + interval '1 hour')
              where user_id = '00000000-0000-0000-0000-0000000000a2' and kunci like 'pagi:%'));

-- Rapor bulanan: tanggal 1 November 10.00 WIB, generus hadir 1× di Oktober.
insert into public.pertemuan (id, kegiatan_id, tanggal, mulai) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '2026-10-26', '2026-10-26 19:30+07');
set local session_replication_role = replica;
insert into public.sesi_absensi (id, nama, kelompok_id, mulai, selesai, pertemuan_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'Pengajian K1', uji.kel(1), '2026-10-26 19:30+07', '2026-10-26 21:00+07',
   '00000000-0000-0000-0000-0000000000e1');
insert into public.absensi (sesi_id, jamaah_id, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1', 'hadir');
set local session_replication_role = origin;
select uji.cek('Rapor: generus diberi tahu rapor Oktober',
  exists (select 1 from private.notifikasi_jatuh_tempo('2026-11-01 10:00+07')
          where user_id = '00000000-0000-0000-0000-0000000000b1' and kunci = 'rapor:2026-10'
            and judul = 'Rapor kehadiran Oktober' and isi like '%hadir 1 kali%' and url = '/saya/rapor'));
select uji.cek('Rapor: bukan tanggal 1 → tidak',
  not exists (select 1 from private.notifikasi_jatuh_tempo('2026-11-02 10:00+07') where kunci like 'rapor:%'));
select uji.cek('Rapor: malam hari (21.00) → tidak',
  not exists (select 1 from private.notifikasi_jatuh_tempo('2026-11-01 21:00+07') where kunci like 'rapor:%'));
update public.akun_generus set created_at = '2026-11-01 08:00+07';
select uji.cek('Rapor: akun baru bulan ini → tidak',
  not exists (select 1 from private.notifikasi_jatuh_tempo('2026-11-01 10:00+07') where kunci like 'rapor:%'));

-- RPC publik untuk Beranda.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.cek('RPC ringkasan_hari_ini: admin mendapat objek', public.ringkasan_hari_ini() ? 'pertemuan');
reset role;
set local role anon;
select uji.harus_ditolak('Anon: RPC ringkasan ditolak', $q$ select 1 from public.ringkasan_hari_ini() $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 26, 'Jumlah skenario kawan');
select * from finish();
rollback;
