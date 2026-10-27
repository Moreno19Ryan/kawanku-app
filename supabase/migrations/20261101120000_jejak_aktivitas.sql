-- =====================================================================
-- Jejak aktivitas (Reno, 27 Okt 2026)
--
-- Siapa mengubah apa dan kapan, untuk menjawab "data saya berubah
-- sendiri" tanpa membuka database. Dicatat otomatis oleh trigger di
-- tabel-tabel penting. Yang disimpan hanya NAMA kolom yang berubah, bukan
-- isinya, supaya data pribadi (NIK, kontak, alamat) tidak tersalin ke sini.
-- Absensi baru (hasil scan) tidak dicatat karena sangat sering; ubah &
-- hapus absensi tetap dicatat. Disimpan 180 hari (tugas kawanku-bersihkan).
-- Hanya pengembang yang bisa melihat.
-- =====================================================================

create table public.jejak_aktivitas (
  id          uuid primary key default gen_random_uuid(),
  tabel       text not null,
  aksi        text not null check (aksi in ('insert', 'update', 'delete')),
  baris_id    text,
  jamaah_id   uuid,
  kelompok_id uuid,
  label       text check (length(label) <= 120),
  kolom       text[],
  oleh        uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default now()
);
comment on table public.jejak_aktivitas is
  'Jejak aktivitas: perubahan data penting (nama kolom saja, tanpa isi), 180 hari.';
create index jejak_aktivitas_waktu_idx on public.jejak_aktivitas (created_at desc);
create index jejak_aktivitas_jamaah_idx on public.jejak_aktivitas (jamaah_id, created_at desc);
create index jejak_aktivitas_oleh_idx on public.jejak_aktivitas (oleh);
create trigger set_updated_at before update on public.jejak_aktivitas
  for each row execute function private.set_updated_at();

revoke all on public.jejak_aktivitas from anon, authenticated;
grant select on public.jejak_aktivitas to authenticated;
alter table public.jejak_aktivitas enable row level security;
create policy jejak_aktivitas_select on public.jejak_aktivitas
  for select to authenticated using (private.boleh('sistem.kelola', null));
create policy wajib_aal2 on public.jejak_aktivitas as restrictive for all to authenticated
  using ((select private.aal_cukup())) with check ((select private.aal_cukup()));

-- ---------------------------------------------------------------------
-- Trigger pencatat (AFTER, per baris)
-- ---------------------------------------------------------------------
create function private.catat_jejak() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lama   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_baru   jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_baris  jsonb := coalesce(v_baru, v_lama);
  v_kolom  text[];
  v_jamaah uuid;
  v_label  text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_kolom
    from jsonb_object_keys(v_baru) k
    where k not in ('updated_at', 'updated_by', 'created_at', 'created_by')
      and v_baru -> k is distinct from v_lama -> k;
    if v_kolom is null then
      return null; -- tidak ada perubahan berarti
    end if;
  end if;

  v_jamaah := case when tg_table_name = 'jamaah' then (v_baris ->> 'id')::uuid
                   else nullif(v_baris ->> 'jamaah_id', '')::uuid end;
  v_label := coalesce(v_baris ->> 'nama_lengkap', v_baris ->> 'nama', v_baris ->> 'username',
                      left(v_baris ->> 'pesan', 60), v_baris ->> 'izin_kode');
  if v_label is null and v_jamaah is not null then
    select j.nama_lengkap into v_label from public.jamaah j where j.id = v_jamaah;
  end if;
  if v_label is null and v_baris ? 'user_id' then
    select a.nama into v_label from public.admin a where a.user_id = (v_baris ->> 'user_id')::uuid;
  end if;

  insert into public.jejak_aktivitas (tabel, aksi, baris_id, jamaah_id, kelompok_id, label, kolom, oleh)
  values (tg_table_name, lower(tg_op),
          coalesce(v_baris ->> 'id', v_baris ->> 'user_id', v_baris ->> 'jamaah_id'),
          v_jamaah, nullif(v_baris ->> 'kelompok_id', '')::uuid,
          left(v_label, 120), v_kolom, auth.uid());
  return null;
end;
$$;
revoke all on function private.catat_jejak() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'jamaah', 'jamaah_identitas', 'jamaah_janda_duda', 'jamaah_keringanan', 'jamaah_kontak',
    'jamaah_pribadi', 'keluarga', 'kartu_qr', 'akun_generus', 'admin', 'penugasan_peran', 'peran',
    'peran_izin', 'kategori_jamaah', 'kegiatan', 'kegiatan_jadwal', 'pertemuan', 'pertemuan_materi',
    'pengajuan_izin', 'pengumuman', 'pengaturan_sistem', 'fitur', 'fitur_kelompok', 'kelompok',
    'pengajar', 'usulan_koreksi', 'cadangan_jadwal'
  ] loop
    execute format(
      'create trigger catat_jejak after insert or update or delete on public.%I
         for each row execute function private.catat_jejak()', t);
  end loop;
end $$;

-- Absensi: hanya ubah & hapus (scan baru terlalu sering untuk dicatat).
create trigger catat_jejak after update or delete on public.absensi
  for each row execute function private.catat_jejak();

-- ---------------------------------------------------------------------
-- Pembersihan: jejak > 180 hari ikut tugas kawanku-bersihkan.
-- ---------------------------------------------------------------------
create or replace function private.bersihkan_riwayat() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tugas  integer;
  v_notif  integer;
  v_jejak  integer;
begin
  delete from cron.job_run_details where start_time < now() - interval '7 days';
  get diagnostics v_tugas = row_count;
  -- Kunci notifikasi memuat tanggal/bulan; setelah 90 hari tidak dipakai lagi.
  delete from public.notifikasi_terkirim where created_at < now() - interval '90 days';
  get diagnostics v_notif = row_count;
  delete from public.jejak_aktivitas where created_at < now() - interval '180 days';
  get diagnostics v_jejak = row_count;
  return v_tugas + v_notif + v_jejak;
end;
$$;
revoke all on function private.bersihkan_riwayat() from public, anon, authenticated;
