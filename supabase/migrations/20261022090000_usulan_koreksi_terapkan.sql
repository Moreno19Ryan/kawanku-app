-- =====================================================================
-- KawanKu: laporan koreksi generus bisa langsung diterapkan admin
-- =====================================================================
-- Untuk status sekolah, status pernikahan, dan tanggal lahir, generus
-- memilih nilai yang benar (bukan hanya teks bebas). Admin cukup menekan
-- "Terapkan": data jamaah diperbarui dan laporan ditandai selesai dalam
-- satu transaksi (terapkan_usulan_koreksi, security invoker → tetap RLS:
-- hanya admin yang boleh mengubah jamaah itu, dan admin generus tidak bisa
-- membuat jamaah keluar dari generus). Kategori ikut menyesuaikan otomatis.
-- =====================================================================

alter table public.usulan_koreksi
  add column nilai       text,
  add column nilai_kelas smallint;

alter table public.usulan_koreksi
  add constraint usulan_koreksi_nilai_sah check (
    nilai is null
    or (bagian = 'status_sekolah'
        and nilai in ('belum_sekolah', 'paud_tk', 'sd', 'smp', 'sma_smk', 'kuliah', 'bekerja', 'lainnya'))
    or (bagian = 'status_pernikahan' and nilai in ('lajang', 'menikah', 'janda_duda'))
    or (bagian = 'tanggal_lahir' and nilai ~ '^\d{4}-\d{2}-\d{2}$')
  ),
  add constraint usulan_koreksi_nilai_kelas_sah check (
    nilai_kelas is null
    or (bagian = 'status_sekolah' and (
          (nilai = 'sd' and nilai_kelas between 1 and 6)
       or (nilai = 'smp' and nilai_kelas between 7 and 9)
       or (nilai = 'sma_smk' and nilai_kelas between 10 and 12)))
  );

-- Isi usulan (termasuk nilai) tidak bisa diubah setelah dikirim.
create or replace function private.atur_usulan_koreksi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'menunggu';
    new.tanggapan := null;
    new.ditangani_by := null;
    new.ditangani_at := null;
    return new;
  end if;
  if new.jamaah_id <> old.jamaah_id or new.bagian <> old.bagian or new.isi <> old.isi
     or new.nilai is distinct from old.nilai or new.nilai_kelas is distinct from old.nilai_kelas then
    raise exception 'Isi usulan tidak bisa diubah';
  end if;
  if new.status <> old.status then
    new.ditangani_by := (select auth.uid());
    new.ditangani_at := case when new.status = 'menunggu' then null else now() end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Terapkan usulan: ubah data jamaah + tandai selesai (satu transaksi)
-- ---------------------------------------------------------------------
create or replace function public.terapkan_usulan_koreksi(p_id uuid, p_tanggapan text default null)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_u public.usulan_koreksi;
  v_tanggal date;
  v_n int;
begin
  select * into v_u from public.usulan_koreksi u where u.id = p_id and u.status = 'menunggu' for update;
  if not found then
    raise exception 'Laporan tidak ditemukan atau sudah ditangani' using hint = 'tidak_ada';
  end if;
  if v_u.nilai is null then
    raise exception 'Laporan ini tidak berisi nilai yang bisa diterapkan' using hint = 'tanpa_nilai';
  end if;

  if v_u.bagian = 'status_sekolah' then
    update public.jamaah
       set status_sekolah = v_u.nilai::public.status_sekolah, kelas = v_u.nilai_kelas
     where id = v_u.jamaah_id;
  elsif v_u.bagian = 'status_pernikahan' then
    update public.jamaah
       set status_pernikahan = v_u.nilai::public.status_pernikahan
     where id = v_u.jamaah_id;
  elsif v_u.bagian = 'tanggal_lahir' then
    v_tanggal := v_u.nilai::date;
    if v_tanggal > (now() at time zone 'Asia/Jakarta')::date or v_tanggal <= date '1900-01-01' then
      raise exception 'Tanggal lahir tidak masuk akal' using hint = 'tanggal';
    end if;
    update public.jamaah
       set tanggal_lahir = v_tanggal, tahun_lahir = extract(year from v_tanggal)::smallint
     where id = v_u.jamaah_id;
  else
    raise exception 'Bagian ini tidak bisa diterapkan otomatis' using hint = 'tanpa_nilai';
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Tidak berhak mengubah data jamaah ini' using errcode = '42501';
  end if;

  update public.usulan_koreksi
     set status = 'selesai',
         tanggapan = coalesce(nullif(trim(p_tanggapan), ''), 'Sudah diperbarui sesuai laporanmu.')
   where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Tidak berhak menangani laporan ini' using errcode = '42501';
  end if;
  return v_u.bagian;
end;
$$;
revoke all on function public.terapkan_usulan_koreksi(uuid, text) from public, anon;
grant execute on function public.terapkan_usulan_koreksi(uuid, text) to authenticated;
