-- =====================================================================
-- Ruang kendali tahap 4b (Reno, 27 Okt 2026)
--
-- 1. Galat JENIS BARU dikirim ke HP pengembang (lewat notifikasi_sistem),
--    paling banyak 3 per jam supaya tidak membanjiri.
-- 2. periksa_data(): pemeriksaan kejanggalan data sekali klik untuk Panel
--    pengembang, dan perbaiki_data() untuk temuan yang aman diperbaiki
--    otomatis. Hanya pengembang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Galat baru → notifikasi HP pengembang
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

  -- Jenis galat baru: kabari pengembang (maks. 3 per jam).
  if (select count(*) from public.notifikasi_sistem
      where kunci like 'galat:%' and created_at > now() - interval '1 hour') < 3 then
    perform private.catat_notifikasi_sistem(
      'galat:' || v_sidik,
      'Ada galat baru di KawanKu',
      left(coalesce(v_rute || ': ', '') || v_pesan, 300),
      '/pengaturan/sistem');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Pemeriksaan data
-- ---------------------------------------------------------------------
create function public.periksa_data()
returns table (kode text, judul text, jumlah integer, contoh text, saran text, bisa_diperbaiki boolean, tautan text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();

  return query
  select 'akun_generus_jamaah_nonaktif'::text,
         'Akun generus aktif, tapi jamaahnya sudah nonaktif'::text,
         count(*)::integer,
         string_agg(j.nama_lengkap, ', ' order by j.nama_lengkap),
         'Akun ini sebaiknya dinonaktifkan supaya tidak bisa masuk lagi.'::text,
         true, '/absensi/akun'::text
  from public.akun_generus g join public.jamaah j on j.id = g.jamaah_id
  where g.aktif and not j.aktif

  union all
  select 'akun_generus_bukan_generus',
         'Akun generus aktif, tapi jamaahnya tidak lagi termasuk generus',
         count(*)::integer,
         string_agg(j.nama_lengkap, ', ' order by j.nama_lengkap),
         'Mis. sudah menikah. Periksa datanya, lalu nonaktifkan akun di Absensi → Akun generus bila memang benar.',
         false, '/absensi/akun'
  from public.akun_generus g join public.jamaah j on j.id = g.jamaah_id
  where g.aktif and j.aktif
    and not private.termasuk_generus(j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah)

  union all
  select 'pertemuan_tanpa_absensi',
         'Pertemuan 30 hari terakhir yang absensinya tidak pernah terbuka',
         count(*)::integer,
         string_agg(k.nama || ' ' || to_char(p.tanggal, 'DD/MM'), ', ' order by p.tanggal),
         'Bila tugas Buka absensi bermasalah, periksa Tugas otomatis. Absensi pertemuan bisa dibuka dari halaman pertemuan.',
         false, '/pengaturan/sistem'
  from public.pertemuan p join public.kegiatan k on k.id = p.kegiatan_id
  where p.status = 'terjadwal' and p.sesi_id is null and k.aktif
    and p.mulai between now() - interval '30 days' and now() - interval '3 hours'

  union all
  select 'permintaan_identitas_lama',
         'Permintaan lihat NIK/KK menunggu lebih dari 2 hari',
         count(*)::integer, null::text,
         'Setujui atau tolak di Panel pengembang supaya admin tidak menunggu.',
         false, '/pengaturan/sistem'
  from public.permintaan_identitas
  where status = 'menunggu' and created_at < now() - interval '2 days'

  union all
  select 'galat_lama',
         'Galat belum dicek lebih dari 7 hari',
         count(*)::integer, null::text,
         'Lihat Pemantau galat. Bila sudah tidak terjadi lagi, tandai sudah dicek.',
         false, '/pengaturan/sistem'
  from public.galat_aplikasi
  where dicek_at is null and terakhir_at < now() - interval '7 days'

  union all
  select 'admin_lama_tidak_masuk',
         'Admin aktif yang tidak masuk lebih dari 90 hari',
         count(*)::integer,
         string_agg(a.nama, ', ' order by a.nama),
         'Pastikan akunnya masih dipakai. Akun yang tidak dipakai sebaiknya dinonaktifkan di Pengaturan → Admin & akses.',
         false, '/pengaturan/admin'
  from public.admin a join auth.users u on u.id = a.user_id
  where a.aktif and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days'

  union all
  select 'keluarga_kosong',
         'Keluarga tanpa anggota',
         count(*)::integer,
         string_agg(kl.nama, ', ' order by kl.nama),
         'Hapus keluarga ini atau tambahkan anggotanya di Jamaah → Keluarga.',
         false, '/jamaah/keluarga'
  from public.keluarga kl
  where not exists (select 1 from public.jamaah j where j.keluarga_id = kl.id)

  union all
  select 'langganan_mati',
         'Langganan notifikasi yang sudah mati lebih dari 30 hari',
         count(*)::integer, null::text,
         'Sisa perangkat yang sudah tidak menerima notifikasi. Aman dihapus.',
         true, null::text
  from public.langganan_notifikasi
  where not aktif and updated_at < now() - interval '30 days';
end;
$$;

-- Perbaikan otomatis hanya untuk temuan yang aman.
create function public.perbaiki_data(p_kode text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  perform private.wajib_pengembang();
  case p_kode
    when 'akun_generus_jamaah_nonaktif' then
      update public.akun_generus g set aktif = false
      from public.jamaah j
      where j.id = g.jamaah_id and g.aktif and not j.aktif;
    when 'langganan_mati' then
      delete from public.langganan_notifikasi
      where not aktif and updated_at < now() - interval '30 days';
    else
      raise exception 'Tidak bisa diperbaiki otomatis' using errcode = '22023', hint = 'tidak_bisa_diperbaiki';
  end case;
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

revoke all on function public.periksa_data(), public.perbaiki_data(text) from public, anon;
grant execute on function public.periksa_data(), public.perbaiki_data(text) to authenticated;
