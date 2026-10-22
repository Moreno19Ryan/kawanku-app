-- =====================================================================
-- KawanKu: generus mengelola data dirinya sendiri (22 Okt 2026)
-- =====================================================================
-- Keputusan Reno: profil generus berisi data diri lengkap yang diubah
-- langsung (tanpa laporan koreksi), supaya database cepat lengkap.
--   - Langsung tersimpan: nama panggilan, tempat & tanggal lahir, status
--     sekolah & kelas, pendidikan terakhir, pekerjaan/kegiatan, no. HP,
--     email, no. HP wali, nama ayah & ibu, alamat (RPC lama).
--   - Pengaman: perubahan yang membuat jamaah keluar dari kategori generus
--     ditolak (hint bukan_generus_lagi); tanggal lahir & status sekolah
--     tidak bisa dikosongkan.
--   - Tetap lewat laporan ke admin: nama lengkap, jenis kelamin, status
--     pernikahan, kelompok, keluarga. NIK & No. KK tidak tersentuh.
--   - Setiap perubahan dicatat di perubahan_data_generus; admin melihatnya
--     di Perlu dicek dan menandai sudah dicek.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Jejak perubahan oleh generus
-- ---------------------------------------------------------------------
-- nilai_lama/nilai_baru hanya diisi untuk data di tabel jamaah (yang
-- memang terbaca admin jamaah.lihat). Kontak, orang tua, dan alamat hanya
-- dicatat bagiannya, supaya isinya tetap mengikuti izin tabel masing-masing.
create table public.perubahan_data_generus (
  id             uuid primary key default gen_random_uuid(),
  jamaah_id      uuid not null references public.jamaah (id) on delete cascade,
  bagian         text not null check (bagian in (
                   'nama_panggilan', 'tempat_lahir', 'tanggal_lahir', 'status_sekolah', 'kelas',
                   'pendidikan_terakhir', 'kegiatan', 'no_hp', 'email', 'no_hp_wali',
                   'nama_ayah', 'nama_ibu', 'alamat')),
  nilai_lama     text,
  nilai_baru     text,
  diperiksa_at   timestamptz,
  diperiksa_by   uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null
);
create index perubahan_data_generus_jamaah_idx on public.perubahan_data_generus (jamaah_id, created_at desc);
create index perubahan_data_generus_belum_idx on public.perubahan_data_generus (created_at desc)
  where diperiksa_at is null;
create index perubahan_data_generus_created_by_idx on public.perubahan_data_generus (created_by);
create index perubahan_data_generus_updated_by_idx on public.perubahan_data_generus (updated_by);
create index perubahan_data_generus_diperiksa_by_idx on public.perubahan_data_generus (diperiksa_by);

-- Admin hanya boleh menandai sudah dicek (bukan mengubah isi catatan).
create or replace function private.atur_perubahan_generus()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.jamaah_id <> old.jamaah_id or new.bagian <> old.bagian
     or new.nilai_lama is distinct from old.nilai_lama
     or new.nilai_baru is distinct from old.nilai_baru
     or new.created_at <> old.created_at then
    raise exception 'Catatan perubahan tidak bisa diubah' using errcode = '42501';
  end if;
  if new.diperiksa_at is distinct from old.diperiksa_at then
    new.diperiksa_by := case when new.diperiksa_at is null then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;

create trigger atur_perubahan before update on public.perubahan_data_generus
  for each row execute function private.atur_perubahan_generus();
create trigger set_updated_at before update on public.perubahan_data_generus
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.perubahan_data_generus
  for each row execute function private.set_updated_by();

revoke all on public.perubahan_data_generus from anon, authenticated;
grant select, update on public.perubahan_data_generus to authenticated;
alter table public.perubahan_data_generus enable row level security;

-- Lihat: admin yang boleh melihat jamaahnya, dan generus pemiliknya.
create policy perubahan_data_generus_select on public.perubahan_data_generus
  for select to authenticated
  using (private.boleh_jamaah('jamaah.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());
-- Tandai sudah dicek: admin yang boleh mengubah data jamaahnya.
create policy perubahan_data_generus_update on public.perubahan_data_generus
  for update to authenticated
  using (private.boleh_jamaah('jamaah.ubah', jamaah_id))
  with check (private.boleh_jamaah('jamaah.ubah', jamaah_id));
-- Tidak ada policy insert/delete: catatan hanya ditulis RPC di bawah.

alter publication supabase_realtime add table public.perubahan_data_generus;

-- Catat satu perubahan bila nilainya memang berbeda.
create or replace function private.catat_ubah_generus(
  p_jamaah uuid, p_bagian text, p_lama text, p_baru text, p_simpan_nilai boolean default true
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.perubahan_data_generus (jamaah_id, bagian, nilai_lama, nilai_baru)
  select p_jamaah, p_bagian,
         case when p_simpan_nilai then p_lama end,
         case when p_simpan_nilai then p_baru end
  where p_lama is distinct from p_baru;
$$;
revoke all on function private.catat_ubah_generus(uuid, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Ubah data diri sendiri (satu RPC untuk semua isian profil)
-- ---------------------------------------------------------------------
create or replace function public.ubah_data_diri_saya(
  p_nama_panggilan      text,
  p_tempat_lahir        text,
  p_tanggal_lahir       date,
  p_status_sekolah      text,
  p_kelas               smallint,
  p_pendidikan_terakhir text,
  p_kegiatan            text,
  p_no_hp               text,
  p_email               text,
  p_no_hp_wali          text,
  p_nama_ayah           text,
  p_nama_ibu            text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_jamaah  uuid := private.jamaah_saya();
  v_lama    public.jamaah;
  v_kontak  public.jamaah_kontak;
  v_pribadi public.jamaah_pribadi;
  v_tgl     date;
  v_sekolah public.status_sekolah;
  v_kelas   smallint;
  v_didik   public.pendidikan;
  v_bersih  text[];
begin
  if v_jamaah is null then
    raise exception 'bukan akun generus aktif' using errcode = '42501';
  end if;
  if exists (select 1 from public.akun_generus g
             where g.user_id = (select auth.uid()) and g.pin_awal) then
    raise exception 'pin awal belum diganti' using errcode = '42501';
  end if;

  select * into v_lama from public.jamaah where id = v_jamaah for update;
  select * into v_kontak from public.jamaah_kontak where jamaah_id = v_jamaah;
  select * into v_pribadi from public.jamaah_pribadi where jamaah_id = v_jamaah;

  -- Isian teks: spasi dirapikan, kosong = null.
  v_bersih := array(
    select nullif(regexp_replace(trim(coalesce(x, '')), '\s+', ' ', 'g'), '')
    from unnest(array[p_nama_panggilan, p_tempat_lahir, p_kegiatan, p_nama_ayah, p_nama_ibu]) with ordinality as t(x, n)
    order by n
  );
  if length(v_bersih[1]) > 40 then
    raise exception 'nama panggilan maksimal 40 karakter' using errcode = '22001';
  end if;

  -- Tanggal lahir & status sekolah tidak bisa dikosongkan.
  v_tgl := coalesce(p_tanggal_lahir, v_lama.tanggal_lahir);
  if v_tgl is not null and (v_tgl <= date '1900-01-01' or v_tgl > (now() at time zone 'Asia/Jakarta')::date) then
    raise exception 'tanggal lahir tidak masuk akal' using errcode = '22008', hint = 'tanggal_lahir';
  end if;
  v_sekolah := coalesce(nullif(p_status_sekolah, '')::public.status_sekolah, v_lama.status_sekolah);
  v_kelas := p_kelas;
  v_didik := nullif(p_pendidikan_terakhir, '')::public.pendidikan;

  -- Hasilnya harus tetap generus (status pernikahan tidak diubah di sini).
  if not private.termasuk_generus(
       v_tgl,
       case when v_tgl is null then v_lama.tahun_lahir else extract(year from v_tgl)::smallint end,
       v_lama.status_pernikahan, v_sekolah) then
    raise exception 'perubahan ini membuatmu tidak lagi termasuk generus'
      using errcode = '22023', hint = 'bukan_generus_lagi';
  end if;

  update public.jamaah set
    nama_panggilan      = v_bersih[1],
    tempat_lahir        = v_bersih[2],
    tanggal_lahir       = v_tgl,
    tahun_lahir         = case when v_tgl is null then tahun_lahir else extract(year from v_tgl)::smallint end,
    status_sekolah      = v_sekolah,
    kelas               = v_kelas,
    pendidikan_terakhir = v_didik,
    kegiatan            = v_bersih[3]
  where id = v_jamaah;

  insert into public.jamaah_kontak (jamaah_id, no_hp, email, no_hp_wali)
  values (v_jamaah, nullif(p_no_hp, ''), nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(p_no_hp_wali, ''))
  on conflict (jamaah_id) do update
    set no_hp = excluded.no_hp, email = excluded.email, no_hp_wali = excluded.no_hp_wali;

  insert into public.jamaah_pribadi (jamaah_id, nama_ayah, nama_ibu)
  values (v_jamaah, v_bersih[4], v_bersih[5])
  on conflict (jamaah_id) do update set nama_ayah = excluded.nama_ayah, nama_ibu = excluded.nama_ibu;

  -- Jejak perubahan.
  perform private.catat_ubah_generus(v_jamaah, 'nama_panggilan', v_lama.nama_panggilan, v_bersih[1]);
  perform private.catat_ubah_generus(v_jamaah, 'tempat_lahir', v_lama.tempat_lahir, v_bersih[2]);
  perform private.catat_ubah_generus(v_jamaah, 'tanggal_lahir', v_lama.tanggal_lahir::text, v_tgl::text);
  perform private.catat_ubah_generus(v_jamaah, 'status_sekolah', v_lama.status_sekolah::text, v_sekolah::text);
  perform private.catat_ubah_generus(v_jamaah, 'kelas', v_lama.kelas::text,
    (select j.kelas::text from public.jamaah j where j.id = v_jamaah));
  perform private.catat_ubah_generus(v_jamaah, 'pendidikan_terakhir', v_lama.pendidikan_terakhir::text, v_didik::text);
  perform private.catat_ubah_generus(v_jamaah, 'kegiatan', v_lama.kegiatan, v_bersih[3]);
  perform private.catat_ubah_generus(v_jamaah, 'no_hp', v_kontak.no_hp, nullif(p_no_hp, ''), false);
  perform private.catat_ubah_generus(v_jamaah, 'email', v_kontak.email,
    nullif(lower(trim(coalesce(p_email, ''))), ''), false);
  perform private.catat_ubah_generus(v_jamaah, 'no_hp_wali', v_kontak.no_hp_wali, nullif(p_no_hp_wali, ''), false);
  perform private.catat_ubah_generus(v_jamaah, 'nama_ayah', v_pribadi.nama_ayah, v_bersih[4], false);
  perform private.catat_ubah_generus(v_jamaah, 'nama_ibu', v_pribadi.nama_ibu, v_bersih[5], false);
end;
$$;
revoke all on function public.ubah_data_diri_saya(text, text, date, text, smallint, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.ubah_data_diri_saya(text, text, date, text, smallint, text, text, text, text, text, text, text)
  to authenticated;

-- RPC lama (nama panggilan, HP, email) digantikan ubah_data_diri_saya;
-- ditutup tanpa DROP supaya semua perubahan tercatat.
revoke all on function public.ubah_profil_saya(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Alamat: catat perubahan (isi alamat tidak disalin ke catatan)
-- ---------------------------------------------------------------------
create or replace function private.catat_alamat_generus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Hanya perubahan oleh generus pemiliknya sendiri (admin tidak dicatat).
  if new.jamaah_id is distinct from private.jamaah_saya() then
    return null;
  end if;
  -- Baris baru dari isian orang tua (tanpa alamat) bukan perubahan alamat.
  if (tg_op = 'INSERT' and (new.ktp_kode_wilayah, new.ktp_jalan, new.dom_kode_wilayah, new.dom_jalan)
                           is distinct from (null::text, null::text, null::text, null::text))
     or (tg_op = 'UPDATE' and (new.ktp_kode_wilayah, new.ktp_jalan, new.ktp_rt, new.ktp_rw, new.ktp_kode_pos, new.domisili_sama_ktp,
         new.dom_kode_wilayah, new.dom_jalan, new.dom_rt, new.dom_rw, new.dom_kode_pos)
        is distinct from
        (old.ktp_kode_wilayah, old.ktp_jalan, old.ktp_rt, old.ktp_rw, old.ktp_kode_pos, old.domisili_sama_ktp,
         old.dom_kode_wilayah, old.dom_jalan, old.dom_rt, old.dom_rw, old.dom_kode_pos)) then
    insert into public.perubahan_data_generus (jamaah_id, bagian) values (new.jamaah_id, 'alamat');
  end if;
  return null;
end;
$$;

create trigger catat_alamat_generus after insert or update on public.jamaah_pribadi
  for each row execute function private.catat_alamat_generus();
