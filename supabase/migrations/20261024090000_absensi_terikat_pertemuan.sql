-- =====================================================================
-- KawanKu: absensi terikat pada pertemuan Kegiatan (24 Okt 2026)
-- =====================================================================
-- Keputusan Reno: "kalau ada absensi ya ada kegiatan", menu Kegiatan dan
-- Absensi harus sinkron dan serba otomatis.
--   1. Setiap sesi absensi lahir dari satu pertemuan (sesi_absensi.pertemuan_id,
--      wajib & unik). Nama, wilayah, sasaran, dan waktu sesi diambil dari
--      pertemuannya, bukan dari isian. Tidak ada lagi "Buat sesi" di menu
--      Absensi: acara di luar jadwal dibuat sebagai agenda di Kegiatan.
--   2. Pertemuan ditandai libur/batal → sesi & catatannya ikut terhapus
--      (pilihan a). Diaktifkan lagi → absensi bisa dibuka ulang dan izin yang
--      sudah disetujui diterapkan otomatis (trigger terapkan_izin).
--   3. Pertemuan dipindah waktunya → waktu sesi ikut pindah. Nama kegiatan
--      diubah → nama sesi ikut berubah.
--   4. Kegiatan / pertemuan yang pernah dibuka absensinya tidak bisa dihapus
--      (nonaktifkan saja).
--   5. Serba otomatis (Reno, 26 Okt 2026): absensi terbuka 30 menit sebelum
--      mulai sampai 30 menit setelah selesai, untuk semua kegiatan. Sesi
--      paling cepat dibuat 30 menit sebelum mulai (cek_waktu_sesi) dan dibuat
--      otomatis oleh aplikasi saat waktunya. Koreksi manual admin
--      (hadir/izin/sakit) tetap boleh kapan saja.
--   6. Data lama: sesi milik pertemuan yang sudah dibatalkan dihapus.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rapikan data lama: sesi milik pertemuan yang sudah libur/batal
-- ---------------------------------------------------------------------
delete from public.sesi_absensi s
using public.pertemuan p
where p.sesi_id = s.id and p.status = 'dibatalkan';

-- ---------------------------------------------------------------------
-- 2. Kolom pengikat
-- ---------------------------------------------------------------------
alter table public.sesi_absensi
  add column pertemuan_id uuid references public.pertemuan (id);

update public.sesi_absensi s set pertemuan_id = p.id
from public.pertemuan p
where p.sesi_id = s.id;

do $$
begin
  if exists (select 1 from public.sesi_absensi where pertemuan_id is null) then
    raise exception 'Masih ada sesi absensi tanpa pertemuan; rapikan dulu sebelum migrasi ini';
  end if;
end;
$$;

alter table public.sesi_absensi
  alter column pertemuan_id set not null,
  add constraint sesi_absensi_pertemuan_unik unique (pertemuan_id);

comment on column public.sesi_absensi.pertemuan_id is
  'Pertemuan Kegiatan pemilik sesi ini (wajib). Nama, wilayah, sasaran, dan waktu sesi mengikuti pertemuannya.';

-- ---------------------------------------------------------------------
-- 3. Sesi mengikuti pertemuannya
-- ---------------------------------------------------------------------

-- Nama sesi: "Kegiatan" atau "Kegiatan · Kelompok" untuk kegiatan serentak.
create or replace function private.nama_sesi_pertemuan(p_pertemuan_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(k.nama || case when k.per_kelompok then ' · ' || coalesce(g.nama, '') else '' end, 120)
  from public.pertemuan p
  join public.kegiatan k on k.id = p.kegiatan_id
  left join public.kelompok g on g.id = p.kelompok_id
  where p.id = p_pertemuan_id;
$$;
revoke all on function private.nama_sesi_pertemuan(uuid) from public, anon, authenticated;

-- Sebelum sesi dibuat: wajib punya pertemuan yang terjadwal; isian nama,
-- wilayah, sasaran, dan waktu diambil dari pertemuan & kegiatannya.
-- (Nama trigger "atur_sesi" supaya berjalan sebelum cek_waktu_sesi.)
create or replace function private.atur_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pertemuan public.pertemuan;
  v_kegiatan  public.kegiatan;
begin
  if new.pertemuan_id is null then
    raise exception 'Absensi hanya bisa dibuka dari pertemuan di Kegiatan'
      using errcode = '23502', hint = 'tanpa_pertemuan';
  end if;
  select * into v_pertemuan from public.pertemuan where id = new.pertemuan_id;
  if not found then
    raise exception 'Pertemuan tidak ditemukan' using errcode = '23503', hint = 'tanpa_pertemuan';
  end if;
  if v_pertemuan.status = 'dibatalkan' then
    raise exception 'Pertemuan ini dibatalkan' using errcode = '22023', hint = 'dibatalkan';
  end if;
  select * into v_kegiatan from public.kegiatan where id = v_pertemuan.kegiatan_id;
  new.nama := private.nama_sesi_pertemuan(v_pertemuan.id);
  new.kelompok_id := v_pertemuan.kelompok_id;
  new.hanya_generus := v_kegiatan.hanya_generus;
  new.mulai := v_pertemuan.mulai;
  new.selesai := v_pertemuan.mulai + make_interval(mins => v_kegiatan.durasi_menit);
  return new;
end;
$$;
revoke all on function private.atur_sesi() from public, anon, authenticated;

create trigger atur_sesi before insert on public.sesi_absensi
  for each row execute function private.atur_sesi();

-- Setelah sesi dibuat: tautkan di pertemuan (memicu terapkan_izin).
create or replace function private.tautkan_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pertemuan set sesi_id = new.id
  where id = new.pertemuan_id and sesi_id is distinct from new.id;
  return null;
end;
$$;
revoke all on function private.tautkan_sesi() from public, anon, authenticated;

create trigger tautkan_sesi after insert on public.sesi_absensi
  for each row execute function private.tautkan_sesi();

-- Ubah sesi: pengikat, wilayah, dan sasaran tetap; waktu mulai hanya
-- mengikuti pertemuan (diubah lewat Kegiatan). Tutup/buka & jam selesai
-- tetap boleh.
create or replace function private.cek_ubah_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pertemuan_id <> old.pertemuan_id
     or new.kelompok_id is distinct from old.kelompok_id
     or new.hanya_generus <> old.hanya_generus then
    raise exception 'Pertemuan, wilayah, dan sasaran sesi mengikuti kegiatannya dan tidak bisa diubah';
  end if;
  if new.mulai <> old.mulai
     and new.mulai is distinct from (select p.mulai from public.pertemuan p where p.id = new.pertemuan_id) then
    raise exception 'Waktu absensi mengikuti pertemuan; ubah waktunya di Kegiatan'
      using errcode = '22023', hint = 'ikut_pertemuan';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Pertemuan & kegiatan menggerakkan sesinya
-- ---------------------------------------------------------------------

-- atur_pertemuan: sama seperti sebelumnya, ditambah: pertemuan dibatalkan
-- melepas tautan sesinya (sesi dihapus oleh trigger sinkron_sesi).
create or replace function private.atur_pertemuan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kegiatan public.kegiatan;
begin
  select * into v_kegiatan from public.kegiatan where id = new.kegiatan_id;
  if v_kegiatan.per_kelompok then
    if new.kelompok_id is null then
      raise exception 'Pertemuan kegiatan serentak harus punya kelompok pelaksana';
    end if;
  else
    new.kelompok_id := v_kegiatan.kelompok_id;
  end if;
  if tg_op = 'UPDATE' and (new.kegiatan_id <> old.kegiatan_id or new.tanggal <> old.tanggal
                           or new.kelompok_id is distinct from old.kelompok_id) then
    raise exception 'Kegiatan, kelompok, dan tanggal jadwal pertemuan tidak bisa diubah (ubah waktu lewat kolom mulai)';
  end if;
  if new.status = 'terjadwal' then
    new.alasan_batal := null;
  else
    new.sesi_id := null;
  end if;
  return new;
end;
$$;

-- Setelah pertemuan berubah: libur/batal → hapus sesi & catatannya;
-- pindah waktu → geser waktu sesi (durasi tetap).
create or replace function private.sinkron_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'dibatalkan' then
    delete from public.sesi_absensi where pertemuan_id = new.id;
  elsif new.mulai is distinct from old.mulai then
    update public.sesi_absensi
    set mulai = new.mulai,
        selesai = case when selesai is null then null else new.mulai + (selesai - mulai) end
    where pertemuan_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function private.sinkron_sesi() from public, anon, authenticated;

create trigger sinkron_sesi after update of status, mulai on public.pertemuan
  for each row execute function private.sinkron_sesi();

-- Pertemuan yang punya sesi absensi tidak bisa dihapus (tandai libur saja).
create or replace function private.jaga_hapus_pertemuan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.sesi_absensi where pertemuan_id = old.id) then
    raise exception 'Pertemuan ini sudah dibuka absensinya; tandai libur/batal saja'
      using errcode = '23503', hint = 'ada_absensi';
  end if;
  return old;
end;
$$;
revoke all on function private.jaga_hapus_pertemuan() from public, anon, authenticated;

create trigger jaga_hapus_pertemuan before delete on public.pertemuan
  for each row execute function private.jaga_hapus_pertemuan();

-- Kegiatan yang punya riwayat absensi tidak bisa dihapus (nonaktifkan saja).
create or replace function private.jaga_hapus_kegiatan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.sesi_absensi s
    join public.pertemuan p on p.id = s.pertemuan_id
    where p.kegiatan_id = old.id
  ) then
    raise exception 'Kegiatan ini sudah punya riwayat absensi; nonaktifkan saja'
      using errcode = '23503', hint = 'ada_absensi';
  end if;
  return old;
end;
$$;
revoke all on function private.jaga_hapus_kegiatan() from public, anon, authenticated;

create trigger jaga_hapus_kegiatan before delete on public.kegiatan
  for each row execute function private.jaga_hapus_kegiatan();

-- Nama kegiatan diubah → nama sesinya ikut.
create or replace function private.sinkron_nama_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sesi_absensi s
  set nama = private.nama_sesi_pertemuan(s.pertemuan_id)
  from public.pertemuan p
  where p.id = s.pertemuan_id and p.kegiatan_id = new.id;
  return null;
end;
$$;
revoke all on function private.sinkron_nama_sesi() from public, anon, authenticated;

create trigger sinkron_nama_sesi after update of nama on public.kegiatan
  for each row when (new.nama is distinct from old.nama)
  execute function private.sinkron_nama_sesi();

-- ---------------------------------------------------------------------
-- 5. Membuka absensi
-- ---------------------------------------------------------------------

-- Buka absensi untuk satu pertemuan (rutin: dibuat bila belum ada).
-- Security invoker → RLS berlaku. Sesi diisi otomatis dari pertemuannya.
create or replace function public.buka_absensi_pertemuan(
  p_kegiatan_id uuid, p_kelompok_id uuid, p_tanggal date, p_mulai timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kegiatan  public.kegiatan;
  v_pertemuan public.pertemuan;
  v_sesi      uuid;
begin
  select * into v_kegiatan from public.kegiatan where id = p_kegiatan_id;
  if not found then
    raise exception 'Kegiatan tidak ditemukan' using errcode = '42501';
  end if;
  insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai)
  values (p_kegiatan_id, case when v_kegiatan.per_kelompok then p_kelompok_id end, p_tanggal, p_mulai)
  on conflict (kegiatan_id, kelompok_id, tanggal) do nothing;
  select * into v_pertemuan from public.pertemuan
  where kegiatan_id = p_kegiatan_id
    and kelompok_id is not distinct from (case when v_kegiatan.per_kelompok then p_kelompok_id else v_kegiatan.kelompok_id end)
    and tanggal = p_tanggal;
  if not found then
    raise exception 'Pertemuan tidak ditemukan' using errcode = '42501';
  end if;
  select id into v_sesi from public.sesi_absensi where pertemuan_id = v_pertemuan.id;
  if found then
    return v_sesi;
  end if;
  if v_pertemuan.status = 'dibatalkan' then
    raise exception 'Pertemuan ini dibatalkan' using errcode = '22023', hint = 'dibatalkan';
  end if;
  insert into public.sesi_absensi (pertemuan_id) values (v_pertemuan.id)
  returning id into v_sesi;
  return v_sesi;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Jendela absensi: 30 menit sebelum mulai s.d. 30 menit setelah selesai
-- ---------------------------------------------------------------------

-- Sesi paling cepat dibuat 30 menit sebelum mulai (sebelumnya 2 jam,
-- migrasi 20261022130000). Sesi yang sudah lewat tetap boleh (susulan).
create or replace function private.cek_waktu_sesi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mulai > now() + interval '30 minutes' then
    raise exception 'Absensi baru terbuka 30 menit sebelum mulai'
      using errcode = '22023', hint = 'belum_waktunya';
  end if;
  return new;
end;
$$;


-- null = boleh scan sekarang; selain itu 'belum_waktunya' / 'lewat_waktu'.
create or replace function private.waktu_scan(p_mulai timestamptz, p_selesai timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when now() < p_mulai - interval '30 minutes' then 'belum_waktunya'
    when now() > coalesce(p_selesai, p_mulai) + interval '30 minutes' then 'lewat_waktu'
  end;
$$;
grant execute on function private.waktu_scan(timestamptz, timestamptz) to authenticated;

-- Scan kartu / ketik kode (sama seperti 20261022010000, ditambah jendela scan).
create or replace function public.catat_absensi_kode(p_sesi_id uuid, p_kode text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kode      text := upper(regexp_replace(coalesce(p_kode, ''), '\s', '', 'g'));
  v_sesi      public.sesi_absensi;
  v_kartu     public.kartu_qr;
  v_jamaah_id uuid;
  v_jalur     public.jalur_absensi;
  v_lama      public.absensi;
  v_hasil     text;
  v_hint      text;
  v_waktu     text;
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'tidak_berhak');
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup');
  end if;
  v_waktu := private.waktu_scan(v_sesi.mulai, v_sesi.selesai);
  if v_waktu is not null then
    return jsonb_build_object('hasil', v_waktu);
  end if;

  if v_kode ~ '^KW-[2-9A-HJKMNP-Z]{6}$' then
    select id into v_jamaah_id from public.jamaah where kode = v_kode;
    v_jalur := 'manual';
  elsif v_kode ~ '^[2-9A-HJKMNP-Z]{16}$' then
    select * into v_kartu from public.kartu_qr where token = v_kode;
    if found and not v_kartu.aktif then
      return jsonb_build_object('hasil', 'kartu_dicabut', 'jamaah_id', v_kartu.jamaah_id);
    end if;
    if found and not private.boleh_kartu_fisik(v_kartu.jamaah_id) then
      return jsonb_build_object('hasil', 'pakai_akun', 'jamaah_id', v_kartu.jamaah_id);
    end if;
    v_jamaah_id := v_kartu.jamaah_id;
    v_jalur := 'kartu';
  end if;
  if v_jamaah_id is null then
    return jsonb_build_object('hasil', 'tidak_dikenal');
  end if;

  select * into v_lama from public.absensi where sesi_id = p_sesi_id and jamaah_id = v_jamaah_id;
  if found and v_lama.status = 'hadir' then
    v_hasil := 'sudah';
  else
    begin
      insert into public.absensi (sesi_id, jamaah_id, status, jalur)
      values (p_sesi_id, v_jamaah_id, 'hadir', v_jalur)
      on conflict (sesi_id, jamaah_id) do update
        set status = 'hadir', alasan_izin = null, jalur = excluded.jalur, dicatat_at = now();
      v_hasil := 'tercatat';
    exception
      when insufficient_privilege then
        return jsonb_build_object('hasil', 'tidak_berhak');
      when raise_exception then
        get stacked diagnostics v_hint = pg_exception_hint;
        return jsonb_build_object('hasil', coalesce(nullif(v_hint, ''), 'tidak_berhak'),
                                  'jamaah_id', v_jamaah_id);
    end;
  end if;
  return jsonb_build_object('hasil', v_hasil, 'jamaah_id', v_jamaah_id, 'jalur', v_jalur);
end;
$$;

-- Token QR layar: null bila sesi ditutup atau di luar jendela scan.
create or replace function public.token_layar(p_sesi_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sesi    public.sesi_absensi;
  v_rahasia bytea;
  v_detik   bigint := floor(extract(epoch from now()));
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found or not private.boleh_lihat_sesi('absensi.kelola', v_sesi.kelompok_id) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if v_sesi.ditutup or private.waktu_scan(v_sesi.mulai, v_sesi.selesai) is not null then
    return null;
  end if;
  insert into public.sesi_layar (sesi_id) values (p_sesi_id) on conflict (sesi_id) do nothing;
  select rahasia into v_rahasia from public.sesi_layar where sesi_id = p_sesi_id;
  return p_sesi_id::text || '.' || v_detik || '.' ||
    translate(encode(substr(extensions.hmac(convert_to(p_sesi_id::text || '.' || v_detik, 'UTF8'),
                                            v_rahasia, 'sha256'), 1, 16), 'base64'), '+/=', '-_');
end;
$$;

-- Generus absen dari QR layar (sama seperti 20261021200000, ditambah
-- jendela scan).
create or replace function public.absen_layar(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_bagian  text[] := string_to_array(coalesce(p_token, ''), '.');
  v_sesi_id uuid;
  v_detik   bigint;
  v_rahasia bytea;
  v_tanda   text;
  v_jamaah  uuid := private.jamaah_saya();
  v_sesi    public.sesi_absensi;
  v_lama    public.absensi;
  v_hint    text;
  v_waktu   text;
begin
  if v_jamaah is null then
    return jsonb_build_object('hasil', 'bukan_generus');
  end if;
  if cardinality(v_bagian) <> 3 or v_bagian[1] !~ '^[0-9a-f-]{36}$' or v_bagian[2] !~ '^[0-9]{1,12}$' then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;
  v_sesi_id := v_bagian[1]::uuid;
  v_detik := v_bagian[2]::bigint;
  select rahasia into v_rahasia from public.sesi_layar where sesi_id = v_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;
  v_tanda := translate(encode(substr(extensions.hmac(convert_to(v_sesi_id::text || '.' || v_detik, 'UTF8'),
                                                     v_rahasia, 'sha256'), 1, 16), 'base64'), '+/=', '-_');
  if v_tanda <> v_bagian[3] then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;

  select * into v_sesi from public.sesi_absensi where id = v_sesi_id;
  if floor(extract(epoch from now())) - v_detik > 90 or v_detik - floor(extract(epoch from now())) > 10 then
    return jsonb_build_object('hasil', 'kedaluwarsa', 'sesi', v_sesi.nama);
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup', 'sesi', v_sesi.nama);
  end if;
  v_waktu := private.waktu_scan(v_sesi.mulai, v_sesi.selesai);
  if v_waktu is not null then
    return jsonb_build_object('hasil', v_waktu, 'sesi', v_sesi.nama);
  end if;

  select * into v_lama from public.absensi where sesi_id = v_sesi_id and jamaah_id = v_jamaah;
  if found and v_lama.status = 'hadir' then
    return jsonb_build_object('hasil', 'sudah', 'sesi', v_sesi.nama, 'dicatat_at', v_lama.dicatat_at);
  end if;
  begin
    insert into public.absensi (sesi_id, jamaah_id, status, jalur)
    values (v_sesi_id, v_jamaah, 'hadir', 'layar')
    on conflict (sesi_id, jamaah_id) do update
      set status = 'hadir', alasan_izin = null, jalur = 'layar', dicatat_at = now();
  exception when raise_exception then
    get stacked diagnostics v_hint = pg_exception_hint;
    return jsonb_build_object('hasil', coalesce(nullif(v_hint, ''), 'bukan_peserta'), 'sesi', v_sesi.nama);
  end;
  return jsonb_build_object('hasil', 'tercatat', 'sesi', v_sesi.nama, 'dicatat_at', now());
end;
$$;
