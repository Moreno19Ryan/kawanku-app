-- =====================================================================
-- Tes migrasi 20261028100000_notifikasi_hp: langganan Web Push & pengingat
-- H-1 / sebentar lagi (pg_cron → pg_net). Satu transaksi, di-rollback.
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

-- Dua generus berakun (K1 & K2), satu admin.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000a1');
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tanggal_lahir)
select '00000000-0000-0000-0000-0000000000f1', id, 'Generus K1', 'L', 'g1', 'lajang', 'sma_smk', current_date - interval '16 years'
from public.kelompok where nomor = 1;
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tanggal_lahir)
select '00000000-0000-0000-0000-0000000000f2', id, 'Generus K2', 'P', 'g2', 'lajang', 'sma_smk', current_date - interval '16 years'
from public.kelompok where nomor = 2;
insert into public.akun_generus (user_id, jamaah_id, username) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'gen.satu'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f2', 'gen.dua');

-- Langganan lewat RPC (dengan sesi), tidak bisa ditulis langsung.
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select public.simpan_langganan_notifikasi('https://push.example/b1', 'kunci', 'auth', 'Android');
select uji.harus_ditolak('Tidak bisa menulis langganan langsung',
  $q$ insert into public.langganan_notifikasi (user_id, endpoint, p256dh, auth_key)
      values (auth.uid(), 'https://push.example/x', 'k', 'a') returning 1 $q$);
select uji.cek('Generus melihat langganannya', (select count(*) = 1 from public.langganan_notifikasi));
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.cek('Generus lain tidak melihatnya', not exists (select 1 from public.langganan_notifikasi));
select public.simpan_langganan_notifikasi('https://push.example/b2', 'kunci', 'auth', null);
select public.matikan_langganan_notifikasi('https://push.example/b1');
reset role;
select uji.cek('Tidak bisa mematikan langganan orang lain',
  (select aktif from public.langganan_notifikasi where endpoint = 'https://push.example/b1'));
set local role anon;
select uji.harus_ditolak('Anon: tidak bisa menyimpan langganan',
  $q$ select public.simpan_langganan_notifikasi('https://push.example/a', 'k', 'a', null) $q$);
reset role;

-- Kegiatan K1 (agenda) 40 menit lagi, kegiatan K2 besok, kegiatan K1 dibatalkan 30 menit lagi.
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit, lokasi)
select '00000000-0000-0000-0000-0000000000c1', 'Pengajian K1', 'agenda', id, 60, 'Masjid' from public.kelompok where nomor = 1;
insert into public.pertemuan (kegiatan_id, tanggal, mulai, pemateri_nama)
values ('00000000-0000-0000-0000-0000000000c1', ((now() + interval '40 minutes') at time zone 'Asia/Jakarta')::date,
        now() + interval '40 minutes', 'Ust. Ahmad');
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit)
select '00000000-0000-0000-0000-0000000000c2', 'Pengajian K2', 'agenda', id, 60 from public.kelompok where nomor = 2;
insert into public.pertemuan (kegiatan_id, tanggal, mulai)
values ('00000000-0000-0000-0000-0000000000c2', ((now() + interval '1 day') at time zone 'Asia/Jakarta')::date,
        ((((now() + interval '1 day') at time zone 'Asia/Jakarta')::date + time '19:30') at time zone 'Asia/Jakarta'));
insert into public.kegiatan (id, nama, jenis, kelompok_id, durasi_menit)
select '00000000-0000-0000-0000-0000000000c3', 'Libur K1', 'agenda', id, 60 from public.kelompok where nomor = 1;
insert into public.pertemuan (kegiatan_id, tanggal, mulai, status, alasan_batal)
values ('00000000-0000-0000-0000-0000000000c3', ((now() + interval '30 minutes') at time zone 'Asia/Jakarta')::date,
        now() + interval '30 minutes', 'dibatalkan', 'Libur');

-- Pukul 19.00 WIB hari ini (untuk H-1 kegiatan K2 besok).
create temp table jam_h1 as
select ((now() at time zone 'Asia/Jakarta')::date + time '19:00') at time zone 'Asia/Jakarta' as t;

select uji.cek('Sebentar lagi: generus K1 diingatkan (dengan pemateri & lokasi)',
  exists (select 1 from private.notifikasi_jatuh_tempo()
          where user_id = '00000000-0000-0000-0000-0000000000b1' and kunci like 'jam:%'
            and judul = 'Sebentar lagi: Pengajian K1' and isi like '%Ust. Ahmad di Masjid%'));
select uji.cek('Pertemuan dibatalkan tidak diingatkan',
  not exists (select 1 from private.notifikasi_jatuh_tempo() where judul like '%Libur%'));
select uji.cek('H-1 pukul 19.00: generus K2 diingatkan kegiatan besok',
  exists (select 1 from private.notifikasi_jatuh_tempo((select t from jam_h1))
          where user_id = '00000000-0000-0000-0000-0000000000b2' and judul = 'Besok: Pengajian K2'));
select uji.cek('H-1 hanya malam hari (pukul 10.00 tidak)',
  not exists (select 1 from private.notifikasi_jatuh_tempo((select t from jam_h1) - interval '9 hours')
              where judul = 'Besok: Pengajian K2'));
select uji.cek('Generus K2 tidak diingatkan kegiatan K1',
  not exists (select 1 from private.notifikasi_jatuh_tempo()
              where user_id = '00000000-0000-0000-0000-0000000000b2' and judul like '%K1%'));

insert into public.pengajuan_izin (jamaah_id, kegiatan_id, kelompok_id, tanggal, jenis, alasan_izin, keterangan, status)
select '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', kelompok_id,
       ((now() + interval '1 day') at time zone 'Asia/Jakarta')::date, 'izin', 'sekolah', 'Ujian', 'disetujui'
from public.kegiatan where id = '00000000-0000-0000-0000-0000000000c2';
update public.pengajuan_izin set status = 'disetujui' where jamaah_id = '00000000-0000-0000-0000-0000000000f2';
select uji.cek('Izin disetujui → tidak diingatkan',
  not exists (select 1 from private.notifikasi_jatuh_tempo((select t from jam_h1)) where judul = 'Besok: Pengajian K2'));

-- Kirim: tanpa secret Vault tidak melakukan apa-apa.
select uji.cek('Tanpa secret Vault: tidak mengirim', private.kirim_notifikasi() = 0);
select vault.create_secret('http://contoh.test', 'kawanku_notifikasi_url');
select vault.create_secret('rahasia-uji', 'kawanku_notifikasi_rahasia');
select uji.cek('Kirim: 1 pesan diantrikan ke pg_net', private.kirim_notifikasi() = 1);
select uji.cek('Permintaan HTTP ke /api/notifikasi/kirim dengan rahasia',
  exists (select 1 from net.http_request_queue
          where url = 'http://contoh.test/api/notifikasi/kirim'
            and headers->>'Authorization' = 'Bearer rahasia-uji'
            and convert_from(body, 'UTF8')::jsonb->'pesan'->0->>'endpoint' = 'https://push.example/b1'));
select uji.cek('Dipanggil lagi: tidak dobel', private.kirim_notifikasi() = 0);

-- Hasil kirim: rahasia salah ditolak; 410 mematikan langganan.
set local role anon;
select uji.harus_ditolak('Hasil kirim dengan rahasia salah ditolak',
  $q$ select public.hasil_kirim_notifikasi('salah', null, array['https://push.example/b1']) $q$);
select public.hasil_kirim_notifikasi('rahasia-uji', null, array['https://push.example/b1']);
reset role;
select uji.cek('Langganan kedaluwarsa dimatikan',
  not (select aktif from public.langganan_notifikasi where endpoint = 'https://push.example/b1'));
select uji.cek('pg_cron: tugas kirim notifikasi tiap 5 menit',
  exists (select 1 from cron.job where jobname = 'kawanku-kirim-notifikasi' and schedule = '*/5 * * * *'));

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 17, 'Jumlah skenario notifikasi');
select * from finish();
rollback;
