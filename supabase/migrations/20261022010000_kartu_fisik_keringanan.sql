-- =====================================================================
-- KawanKu: kartu QR fisik (jalur 1) untuk generus hanya bila keringanan
-- =====================================================================
-- Keputusan Reno (21 Okt 2026): generus memakai akun (jalur 2, scan QR
-- layar). Kartu fisik untuk generus hanya bagi yang berpenanda keringanan
-- (tanpa HP). Jamaah selain generus tetap memakai kartu seperti biasa.
--   - Kartu baru untuk generus tanpa keringanan ditolak (trigger).
--   - Buat kartu massal melewati generus tanpa keringanan.
--   - Keringanan dicabut → kartu aktifnya otomatis dicabut.
--   - Scan kartu generus tanpa keringanan ditolak (mis. jamaah baru menjadi
--     generus setelah kartunya dibuat): hasil 'pakai_akun'.
--   - Kartu aktif generus tanpa keringanan yang sudah ada dicabut sekarang.
-- =====================================================================

-- true = jamaah boleh memegang kartu fisik: bukan generus, atau generus
-- dengan keringanan aktif. Security definer: penanda keringanan dibaca
-- tanpa RLS, hasilnya hanya boolean.
create or replace function private.boleh_kartu_fisik(p_jamaah_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not private.termasuk_generus(j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah)
        or exists (select 1 from public.jamaah_keringanan r where r.jamaah_id = j.id and r.aktif)
    from public.jamaah j where j.id = p_jamaah_id), false);
$$;
revoke all on function private.boleh_kartu_fisik(uuid) from public, anon;
grant execute on function private.boleh_kartu_fisik(uuid) to authenticated;

-- Tolak kartu aktif baru untuk generus tanpa keringanan.
create or replace function private.cek_kartu_fisik()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.aktif and (tg_op = 'INSERT' or not old.aktif)
     and not private.boleh_kartu_fisik(new.jamaah_id) then
    raise exception 'Generus memakai akun untuk absen; kartu fisik hanya untuk yang berpenanda keringanan'
      using hint = 'pakai_akun';
  end if;
  return new;
end;
$$;
create trigger cek_kartu_fisik before insert or update on public.kartu_qr
  for each row execute function private.cek_kartu_fisik();

-- Keringanan dicabut/dihapus → kartu aktif generus itu ikut dicabut.
create or replace function private.cabut_kartu_tanpa_keringanan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.boleh_kartu_fisik(old.jamaah_id) then
    update public.kartu_qr set aktif = false, dicabut_at = now()
    where jamaah_id = old.jamaah_id and aktif;
  end if;
  return null;
end;
$$;
revoke all on function private.cabut_kartu_tanpa_keringanan() from public, anon, authenticated;
create trigger cabut_kartu after update or delete on public.jamaah_keringanan
  for each row execute function private.cabut_kartu_tanpa_keringanan();

-- Buat massal: lewati generus tanpa keringanan.
create or replace function public.buat_kartu_qr_kelompok(p_kelompok_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  insert into public.kartu_qr (jamaah_id, token)
  select j.id, '' from public.jamaah j
  where j.kelompok_id = p_kelompok_id and j.aktif
    and private.boleh_jamaah('absensi.kelola', j.id)
    and private.boleh_kartu_fisik(j.id)
    and not exists (select 1 from public.kartu_qr k where k.jamaah_id = j.id and k.aktif);
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

-- Scan: kartu generus tanpa keringanan ditolak ('pakai_akun').
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
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'tidak_berhak');
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup');
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

-- Cabut kartu aktif generus tanpa keringanan yang sudah terlanjur dibuat.
update public.kartu_qr set aktif = false, dicabut_at = now()
where aktif and not private.boleh_kartu_fisik(jamaah_id);
