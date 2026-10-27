-- =====================================================================
-- Ruang kendali pengembang, tahap 1 (Reno, 27 Okt 2026)
--
-- 1. Riwayat tugas otomatis (cron.job_run_details) dibersihkan tiap
--    malam. Sebelumnya tidak pernah dihapus: tugas buka absensi saja
--    menambah ±1.440 baris per hari dan lama-lama memenuhi ruang database.
--    Catatan pengiriman notifikasi lebih dari 90 hari juga dihapus.
-- 2. Pemantau galat: bila sudah 500 jenis, galat lama yang sudah dicek
--    digeser supaya galat baru tetap tercatat.
-- 3. kesehatan_sistem(): ringkasan untuk kartu Kesehatan sistem.
-- 4. Tugas otomatis: jalankan sekarang & nyalakan/matikan dari Panel
--    pengembang (hanya tugas KawanKu, hanya pengembang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bersihkan riwayat tugas & catatan notifikasi lama
-- ---------------------------------------------------------------------
create function private.bersihkan_riwayat() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tugas integer;
  v_notif integer;
begin
  delete from cron.job_run_details where start_time < now() - interval '7 days';
  get diagnostics v_tugas = row_count;
  -- Kunci notifikasi memuat tanggal/bulan; setelah 90 hari tidak dipakai lagi.
  delete from public.notifikasi_terkirim where created_at < now() - interval '90 days';
  get diagnostics v_notif = row_count;
  return v_tugas + v_notif;
end;
$$;
revoke all on function private.bersihkan_riwayat() from public, anon, authenticated;

-- 02.30 WIB.
select cron.schedule('kawanku-bersihkan', '30 19 * * *', 'select private.bersihkan_riwayat()');

-- ---------------------------------------------------------------------
-- 2. Pemantau galat: geser galat lama yang sudah dicek bila penuh
-- ---------------------------------------------------------------------
create or replace function public.catat_galat(
  p_sumber text,
  p_pesan  text,
  p_rute   text default null,
  p_jenis  text default null,
  p_digest text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pesan text := left(coalesce(nullif(btrim(p_pesan), ''), '(tanpa pesan)'), 500);
  v_rute  text := left(nullif(btrim(p_rute), ''), 200);
  v_sidik text;
begin
  if p_sumber not in ('server', 'klien') then
    return;
  end if;
  v_sidik := md5(p_sumber || '|' || coalesce(v_rute, '') || '|' || v_pesan);

  update public.galat_aplikasi
     set jumlah = least(jumlah, 2000000000) + 1,
         terakhir_at = now(),
         digest = coalesce(left(p_digest, 100), digest),
         dicek_at = null,
         dicek_oleh = null
   where sidik = v_sidik;
  if found then
    return;
  end if;

  -- Batas 500 jenis galat. Bila penuh, galat lama yang sudah dicek dibuang
  -- dulu; bila semuanya belum dicek, hanya galat yang sudah ada yang dihitung.
  if (select count(*) from public.galat_aplikasi) >= 500 then
    delete from public.galat_aplikasi
    where id = (select id from public.galat_aplikasi
                where dicek_at is not null order by terakhir_at limit 1);
    if not found then
      return;
    end if;
  end if;

  insert into public.galat_aplikasi (sidik, sumber, jenis, rute, pesan, digest)
  values (v_sidik, p_sumber, left(p_jenis, 30), v_rute, v_pesan, left(p_digest, 100))
  on conflict (sidik) do update
    set jumlah = public.galat_aplikasi.jumlah + 1, terakhir_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Kesehatan sistem (kartu ringkas di Panel pengembang)
-- ---------------------------------------------------------------------
create function public.kesehatan_sistem() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tugas jsonb;
  v_gagal_kirim integer;
begin
  perform private.wajib_pengembang();

  select coalesce(jsonb_agg(jsonb_build_object(
           'nama', j.jobname,
           'jadwal', j.schedule,
           'aktif', j.active,
           'terakhir_at', t.start_time,
           'terakhir_status', t.status,
           'terakhir_pesan', left(t.return_message, 300),
           'jalan_24j', coalesce(s.jalan, 0),
           'gagal_24j', coalesce(s.gagal, 0))
         order by j.jobname), '[]'::jsonb)
    into v_tugas
  from cron.job j
  left join lateral (
    select d.start_time, d.status, d.return_message
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by d.start_time desc
    limit 1
  ) t on true
  left join lateral (
    select count(*) as jalan, count(*) filter (where d.status = 'failed') as gagal
    from cron.job_run_details d
    where d.jobid = j.jobid and d.start_time > now() - interval '24 hours'
  ) s on true
  where j.jobname like 'kawanku-%';

  -- Pengiriman ke server aplikasi yang gagal (pg_net menyimpan ±6 jam terakhir).
  begin
    select count(*) into v_gagal_kirim
    from net._http_response r
    where r.created > now() - interval '24 hours'
      and (r.timed_out or r.error_msg is not null or r.status_code >= 300);
  exception when others then
    v_gagal_kirim := null;
  end;

  return jsonb_build_object(
    'tugas', v_tugas,
    'notifikasi', jsonb_build_object(
      'langganan_aktif', (select count(*) from public.langganan_notifikasi where aktif),
      'terkirim_24j', (select count(*) from public.notifikasi_terkirim
                       where created_at > now() - interval '24 hours'),
      'gagal_kirim', v_gagal_kirim),
    'cadangan', jsonb_build_object(
      'terakhir_berhasil', (select max(created_at) from public.cadangan where status = 'berhasil'),
      'gagal_7h', (select count(*) from public.cadangan
                   where status = 'gagal' and created_at > now() - interval '7 days')),
    'database_byte', pg_database_size(current_database()),
    'galat', jsonb_build_object(
      'baru', (select count(*) from public.galat_aplikasi where dicek_at is null),
      'hari_ini', (select count(*) from public.galat_aplikasi
                   where terakhir_at > now() - interval '24 hours'))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Tugas otomatis: jalankan sekarang & nyalakan/matikan
-- ---------------------------------------------------------------------
-- Hanya tugas KawanKu yang dikenal. Cadangan dijalankan sebagai cadangan
-- manual (bukan cadangan_terjadwal, supaya rotasi harian tidak terganggu).
create function public.jalankan_tugas(p_nama text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  case p_nama
    when 'kawanku-buka-absensi' then return private.buka_absensi_otomatis();
    when 'kawanku-kirim-notifikasi' then return private.kirim_notifikasi();
    when 'kawanku-tempat-sampah' then return private.kosongkan_tempat_sampah();
    when 'kawanku-bersihkan' then return private.bersihkan_riwayat();
    when 'kawanku-cadangan' then
      perform private.buat_cadangan('manual', auth.uid());
      return 1;
    else
      raise exception 'Tugas tidak dikenal' using errcode = '22023', hint = 'tugas_tidak_dikenal';
  end case;
end;
$$;

create function public.atur_tugas(p_nama text, p_aktif boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform private.wajib_pengembang();
  select jobid into v_id from cron.job where jobname = p_nama and jobname like 'kawanku-%';
  if v_id is null then
    raise exception 'Tugas tidak dikenal' using errcode = '22023', hint = 'tugas_tidak_dikenal';
  end if;
  perform cron.alter_job(v_id, active := p_aktif);
end;
$$;

revoke all on function public.kesehatan_sistem(), public.jalankan_tugas(text),
  public.atur_tugas(text, boolean) from public, anon;
grant execute on function public.kesehatan_sistem(), public.jalankan_tugas(text),
  public.atur_tugas(text, boolean) to authenticated;
