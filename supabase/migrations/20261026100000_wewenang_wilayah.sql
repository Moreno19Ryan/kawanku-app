-- =====================================================================
-- Wewenang sesuai wilayah (F1 bagian B, keputusan Reno 26 Okt 2026)
--
-- 1. Data jamaah (tambah/ubah/nonaktifkan/hapus, keluarga, kontak, data
--    pribadi, identitas, janda/duda, keringanan) hanya dikelola di tingkat
--    KELOMPOK. Izin seperti ini ditandai `izin.hanya_kelompok`; penugasan
--    tingkat desa tidak pernah mendapatkannya, walau perannya diberi izin
--    itu lewat Pengaturan.
-- 2. Kegiatan, jadwal, pertemuan, pengajar, dan pengumuman generus dikelola
--    TEPAT di wilayahnya: kegiatan desa oleh pengurus desa, kegiatan
--    kelompok oleh pengurus kelompok itu (desa tidak lagi bisa mengatur
--    kegiatan kelompok).
-- 3. Kegiatan "serentak" (per_kelompok) dihapus: dipecah menjadi satu
--    kegiatan per kelompok (jadwal disalin, pertemuan & izin dipindah).
-- 4. Absensi: sesi kelompok hanya dicatat pengurus kelompok itu; sesi desa
--    oleh pengurus desa dan pengurus kelompok (untuk jamaahnya sendiri).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Izin khusus kelompok
-- ---------------------------------------------------------------------
alter table public.izin add column hanya_kelompok boolean not null default false;

comment on column public.izin.hanya_kelompok is
  'Izin hanya berlaku dari penugasan tingkat kelompok (bukan seluruh desa).';

update public.izin set hanya_kelompok = true
where kode in ('jamaah.tambah', 'jamaah.ubah', 'jamaah.hapus', 'keluarga.kelola',
               'kontak.kelola', 'pribadi.kelola', 'identitas.kelola',
               'janda_duda.kelola', 'keringanan.kelola');

-- Penugasan desa tidak mendapat izin hanya_kelompok.
create or replace function private.boleh(
  p_izin text,
  p_kelompok_id uuid,
  p_tanggal_lahir date default null,
  p_tahun_lahir smallint default null,
  p_status_pernikahan public.status_pernikahan default null,
  p_status_sekolah public.status_sekolah default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.penugasan_peran pp
    join public.admin a       on a.user_id = pp.user_id and a.aktif
    join public.peran p       on p.id = pp.peran_id
    join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = p_izin
    join public.izin iz       on iz.kode = pi.izin_kode
    where pp.user_id = (select auth.uid())
      and (pp.kelompok_id is null or pp.kelompok_id = p_kelompok_id)
      and (pp.kelompok_id is not null or not iz.hanya_kelompok)
      and (
        not p.hanya_generus
        or (
          p_kelompok_id is not null
          and private.termasuk_generus(
            p_tanggal_lahir, p_tahun_lahir, p_status_pernikahan, p_status_sekolah)
        )
      )
  );
$$;

-- Peran bawaan: admin desa melepas pengelolaan data jamaah; admin kelompok
-- memegang seluruhnya (termasuk hapus permanen & keterangan janda/duda).
delete from public.peran_izin pi
using public.peran p
where pi.peran_id = p.id and p.kode = 'admin_desa'
  and pi.izin_kode in (select kode from public.izin where hanya_kelompok);

insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
cross join (values ('jamaah.hapus'), ('janda_duda.lihat'), ('janda_duda.kelola')) as i (kode)
where p.kode = 'admin_kelompok'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Kelola tepat di wilayahnya
-- ---------------------------------------------------------------------

-- Kelola sesuatu di wilayah ini: penugasan harus TEPAT di wilayah itu
-- (desa → penugasan desa; kelompok → penugasan kelompok itu). Dipakai
-- kegiatan, jadwal, pertemuan (boleh_kelola_pertemuan), pengajar,
-- pengumuman generus, dan kenaikan kelas.
create or replace function private.boleh_kelola_wilayah(p_izin text, p_kelompok_id uuid, p_hanya_generus boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.penugasan_peran pp
    join public.admin a       on a.user_id = pp.user_id and a.aktif
    join public.peran p       on p.id = pp.peran_id
    join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = p_izin
    join public.izin iz       on iz.kode = pi.izin_kode
    where pp.user_id = (select auth.uid())
      and pp.kelompok_id is not distinct from p_kelompok_id
      and (pp.kelompok_id is not null or not iz.hanya_kelompok)
      and (not p.hanya_generus or p_hanya_generus)
  );
$$;

-- Kenaikan kelas: melihat tetap boleh dari tingkat desa.
alter policy kenaikan_kelas_select on public.kenaikan_kelas
  using (private.boleh_lihat_sesi('jamaah.lihat', kelompok_id));

-- Kelola sesi absensi: sama, tepat di wilayahnya.
create or replace function private.boleh_kelola_sesi(p_kelompok_id uuid, p_hanya_generus boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh_kelola_wilayah('absensi.kelola', p_kelompok_id, p_hanya_generus);
$$;

-- ---------------------------------------------------------------------
-- 3. Absensi: siapa yang boleh mencatat di sesi mana
-- ---------------------------------------------------------------------

-- Mencatat absensi di wilayah ini: sesi desa → pemegang absensi.kelola di
-- wilayah mana pun (jamaahnya dibatasi boleh_jamaah); sesi kelompok →
-- hanya penugasan kelompok itu.
create or replace function private.boleh_absensi_di(p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.penugasan_peran pp
    join public.admin a       on a.user_id = pp.user_id and a.aktif
    join public.peran_izin pi on pi.peran_id = pp.peran_id and pi.izin_kode = 'absensi.kelola'
    where pp.user_id = (select auth.uid())
      and (p_kelompok_id is null or pp.kelompok_id = p_kelompok_id)
  );
$$;

create or replace function private.boleh_catat_sesi(p_sesi_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sesi_absensi s
    where s.id = p_sesi_id and private.boleh_absensi_di(s.kelompok_id)
  );
$$;

revoke all on function private.boleh_absensi_di(uuid), private.boleh_catat_sesi(uuid) from public, anon;
grant execute on function private.boleh_absensi_di(uuid), private.boleh_catat_sesi(uuid) to authenticated;

alter policy absensi_insert on public.absensi
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_catat_sesi(sesi_id));
alter policy absensi_update on public.absensi
  using (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_catat_sesi(sesi_id))
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_catat_sesi(sesi_id));
alter policy absensi_delete on public.absensi
  using (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_catat_sesi(sesi_id));

-- Izin/sakit: kegiatan kelompok disetujui pengurus kelompok itu.
alter policy pengajuan_izin_update on public.pengajuan_izin
  using (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_absensi_di(kelompok_id))
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id) and private.boleh_absensi_di(kelompok_id));

-- Token QR layar (sama seperti 20261024090000, cek wilayah catat).
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
  if not found or not private.boleh_absensi_di(v_sesi.kelompok_id) then
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

-- ---------------------------------------------------------------------
-- 4. Hapus kegiatan serentak: satu kegiatan per kelompok
-- ---------------------------------------------------------------------
alter table public.pertemuan disable trigger atur_pertemuan;
alter table public.pengajuan_izin disable trigger atur_pengajuan;

do $$
declare
  v_lama public.kegiatan;
  v_kel  public.kelompok;
  v_baru uuid;
begin
  for v_lama in select * from public.kegiatan where per_kelompok loop
    for v_kel in select * from public.kelompok order by nomor loop
      insert into public.kegiatan (nama, jenis, kelompok_id, per_kelompok, hanya_generus, lokasi,
                                   keterangan, durasi_menit, aktif, berlaku_mulai, berlaku_sampai,
                                   created_at, created_by)
      values (v_lama.nama, v_lama.jenis, v_kel.id, false, v_lama.hanya_generus, v_lama.lokasi,
              v_lama.keterangan, v_lama.durasi_menit, v_lama.aktif and v_kel.aktif,
              v_lama.berlaku_mulai, v_lama.berlaku_sampai, v_lama.created_at, v_lama.created_by)
      returning id into v_baru;

      insert into public.kegiatan_jadwal (kegiatan_id, hari, jam, kecuali_pekan_ke)
      select v_baru, hari, jam, kecuali_pekan_ke
      from public.kegiatan_jadwal where kegiatan_id = v_lama.id;

      update public.pertemuan set kegiatan_id = v_baru
      where kegiatan_id = v_lama.id and kelompok_id = v_kel.id;

      update public.pengajuan_izin set kegiatan_id = v_baru
      where kegiatan_id = v_lama.id and kelompok_id = v_kel.id;
    end loop;
  end loop;
end;
$$;

alter table public.pertemuan enable trigger atur_pertemuan;
alter table public.pengajuan_izin enable trigger atur_pengajuan;

-- Kegiatan serentak lama sudah kosong (pertemuan & izin pindah).
delete from public.kegiatan where per_kelompok;

alter table public.kegiatan add constraint kegiatan_tanpa_serentak check (not per_kelompok);
