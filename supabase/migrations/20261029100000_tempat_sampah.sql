-- =====================================================================
-- Tempat sampah 30 hari (F6b, Reno 26 Okt 2026)
--
-- Jamaah, keluarga, dan kegiatan yang dihapus tidak langsung hilang: baris
-- itu beserta semua yang ikut terhapus (kontak, alamat, absensi, kartu QR,
-- akun generus, pertemuan, jadwal, dst.) disimpan di tempat sampah selama
-- 30 hari. Admin yang berwenang menghapusnya bisa mengembalikannya sendiri;
-- setelah 30 hari dihapus permanen (pg_cron `kawanku-tempat-sampah`).
--
-- Mekanisme: trigger BEFORE DELETE pada tabel akar membuat entri tempat
-- sampah & penanda transaksi `kawanku.sampah`; trigger AFTER DELETE pada
-- tabel anak mencatat baris yang ikut terhapus (cascade) ke entri itu.
-- Penanda berlaku sampai akhir transaksi (cascade berjalan setelah
-- pernyataan hapus selesai); satu permintaan hapus = satu transaksi. Hapus
-- akar berikutnya menimpa penanda. Batasan: hapus banyak akar dalam SATU
-- pernyataan menaruh semua anak di entri terakhir (aplikasi menghapus satu
-- per satu).
-- Pengembalian menyisipkan ulang baris apa adanya (urutan terhapus = urutan
-- induk → anak) dengan session_replication_role = replica supaya trigger
-- tidak mengubah data lama (mis. status izin, waktu absensi); keberadaan
-- induk di luar entri diperiksa sendiri per baris.
-- =====================================================================

create table public.tempat_sampah (
  id             uuid primary key default gen_random_uuid(),
  jenis          text not null check (jenis in ('jamaah', 'keluarga', 'kegiatan')),
  baris_id       uuid not null,
  label          text not null check (length(label) <= 200),
  kelompok_id    uuid references public.kelompok (id) on delete cascade,
  jumlah_ikut    integer not null default 0,
  tambahan       jsonb not null default '{}'::jsonb,
  dihapus_oleh   uuid default auth.uid() references auth.users (id) on delete set null,
  kedaluwarsa_at timestamptz not null default now() + interval '30 days',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.tempat_sampah is 'Data yang dihapus (jamaah/keluarga/kegiatan), bisa dikembalikan 30 hari.';
create index tempat_sampah_kedaluwarsa_idx on public.tempat_sampah (kedaluwarsa_at);
create trigger set_updated_at before update on public.tempat_sampah
  for each row execute function private.set_updated_at();

create table private.tempat_sampah_isi (
  id        bigint generated always as identity primary key,
  sampah_id uuid not null references public.tempat_sampah (id) on delete cascade,
  tabel     text not null,
  isi       jsonb not null
);
create index tempat_sampah_isi_sampah_idx on private.tempat_sampah_isi (sampah_id, id);

-- Siapa yang boleh melihat/mengembalikan: yang boleh menghapusnya.
create function private.boleh_sampah(p_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case s.jenis
    when 'jamaah' then private.boleh('jamaah.hapus', s.kelompok_id,
      (a.isi->>'tanggal_lahir')::date, (a.isi->>'tahun_lahir')::smallint,
      (a.isi->>'status_pernikahan')::public.status_pernikahan, (a.isi->>'status_sekolah')::public.status_sekolah)
    when 'keluarga' then private.boleh('keluarga.kelola', s.kelompok_id)
    when 'kegiatan' then private.boleh_kelola_wilayah('kegiatan.kelola', s.kelompok_id,
      coalesce((a.isi->>'hanya_generus')::boolean, false))
  end
  from public.tempat_sampah s
  left join lateral (select i.isi from private.tempat_sampah_isi i where i.sampah_id = s.id order by i.id limit 1) a on true
  where s.id = p_id;
$$;
revoke all on function private.boleh_sampah(uuid) from public, anon;
grant execute on function private.boleh_sampah(uuid) to authenticated;

revoke all on public.tempat_sampah from anon, authenticated;
grant select on public.tempat_sampah to authenticated;
alter table public.tempat_sampah enable row level security;
create policy tempat_sampah_select on public.tempat_sampah
  for select to authenticated using (private.boleh_sampah(id));

-- ---------------------------------------------------------------------
-- Trigger pencatat
-- ---------------------------------------------------------------------
create function private.ke_tempat_sampah() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_label   text;
  v_tambah  jsonb := '{}'::jsonb;
  v_baris   jsonb;
begin
  v_baris := to_jsonb(old);
  v_label := case tg_table_name
    when 'jamaah' then (v_baris->>'nama_lengkap') || ' (' || (v_baris->>'kode') || ')'
    else v_baris->>'nama' end;
  if tg_table_name = 'keluarga' then
    -- Anggota dilepas dulu (FK komposit), dicatat supaya bisa dipasang lagi.
    select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'hubungan', j.hubungan_keluarga)), '[]'::jsonb)
      into v_tambah
    from public.jamaah j where j.keluarga_id = (v_baris->>'id')::uuid;
    v_tambah := jsonb_build_object('anggota', v_tambah);
    update public.jamaah set keluarga_id = null, hubungan_keluarga = null where keluarga_id = (v_baris->>'id')::uuid;
  end if;

  insert into public.tempat_sampah (jenis, baris_id, label, kelompok_id, tambahan)
  values (tg_table_name, (v_baris->>'id')::uuid, left(v_label, 200), (v_baris->>'kelompok_id')::uuid, v_tambah)
  returning id into v_id;
  insert into private.tempat_sampah_isi (sampah_id, tabel, isi) values (v_id, tg_table_name, v_baris);
  perform set_config('kawanku.sampah', v_id::text, true);
  return old;
end;
$$;

create function private.catat_ikut_terhapus() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := coalesce(current_setting('kawanku.sampah', true), '');
begin
  if v_id <> '' and exists (select 1 from public.tempat_sampah where id = v_id::uuid) then
    insert into private.tempat_sampah_isi (sampah_id, tabel, isi) values (v_id::uuid, tg_table_name, to_jsonb(old));
    update public.tempat_sampah set jumlah_ikut = jumlah_ikut + 1 where id = v_id::uuid;
  end if;
  return old;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['jamaah', 'keluarga', 'kegiatan'] loop
    execute format('create trigger ke_tempat_sampah before delete on public.%I
      for each row execute function private.ke_tempat_sampah()', t);
  end loop;
  foreach t in array array[
    'absensi', 'akses_identitas', 'akun_generus', 'jamaah_identitas', 'jamaah_janda_duda',
    'jamaah_keringanan', 'jamaah_kontak', 'jamaah_pribadi', 'kartu_qr', 'pengajuan_izin',
    'permintaan_identitas', 'perubahan_data_generus', 'riwayat_pin', 'sapaan_jamaah',
    'usulan_koreksi', 'kegiatan_jadwal', 'pertemuan', 'pertemuan_materi'] loop
    execute format('create trigger catat_ikut_terhapus after delete on public.%I
      for each row execute function private.catat_ikut_terhapus()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Kembalikan / hapus permanen
-- ---------------------------------------------------------------------

-- Semua induk (FK keluar) sebuah baris sudah ada? Kolom FK yang kosong dilewati.
create function private.induk_ada(p_tabel text, p_isi jsonb) returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  r      record;
  v_ada  boolean;
begin
  for r in
    select c.confrelid::regclass as induk,
           array_agg(a.attname::text order by k.urut) as kolom,
           array_agg(fa.attname::text order by k.urut) as kolom_induk
    from pg_constraint c
    cross join lateral unnest(c.conkey, c.confkey) with ordinality as k(anak, ind, urut)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.anak
    join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = k.ind
    where c.contype = 'f' and c.conrelid = to_regclass('public.' || quote_ident(p_tabel))
    group by c.oid, c.confrelid
  loop
    -- Lewati bila salah satu kolom FK kosong.
    if exists (select 1 from unnest(r.kolom) k where p_isi->>k is null) then
      continue;
    end if;
    execute format('select exists (select 1 from %s where %s)', r.induk,
      (select string_agg(format('%I::text = %L', ki, p_isi->>ka), ' and ')
       from unnest(r.kolom, r.kolom_induk) as x(ka, ki)))
      into v_ada;
    if not v_ada then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.induk_ada(text, jsonb) from public, anon, authenticated;

create function public.kembalikan_dari_sampah(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s      public.tempat_sampah;
  r        record;
  v_kolom  text;
  v_gagal  text[] := '{}';
  v_jumlah integer := 0;
  v_akar   boolean := true;
begin
  select * into v_s from public.tempat_sampah where id = p_id for update;
  if not found or not coalesce(private.boleh_sampah(p_id), false) then
    raise exception 'Tidak ditemukan atau di luar wewenang' using errcode = '42501';
  end if;

  set local session_replication_role = replica;
  for r in select * from private.tempat_sampah_isi where sampah_id = p_id order by id loop
    begin
      if not private.induk_ada(r.tabel, r.isi) then
        raise exception 'induk';
      end if;
      select string_agg(quote_ident(attname), ', ' order by attnum) into v_kolom
      from pg_attribute
      where attrelid = to_regclass('public.' || quote_ident(r.tabel)) and attnum > 0
        and not attisdropped and attgenerated = '';
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)',
        r.tabel, v_kolom) using r.isi;
      v_jumlah := v_jumlah + 1;
    exception when others then
      if v_akar then
        -- Baris utamanya gagal (mis. kelompok sudah dihapus): batalkan semua.
        raise exception 'Tidak bisa dikembalikan: %', case when sqlerrm = 'induk' then 'data induknya sudah tidak ada' else sqlerrm end
          using errcode = 'P0001';
      end if;
      v_gagal := array_append(v_gagal, r.tabel);
    end;
    v_akar := false;
  end loop;
  set local session_replication_role = origin;

  if v_s.jenis = 'keluarga' then
    update public.jamaah j set keluarga_id = v_s.baris_id, hubungan_keluarga = (a->>'hubungan')::public.hubungan_keluarga
    from jsonb_array_elements(v_s.tambahan->'anggota') a
    where j.id = (a->>'id')::uuid and j.keluarga_id is null and j.kelompok_id is not distinct from v_s.kelompok_id;
  end if;

  delete from public.tempat_sampah where id = p_id;
  perform set_config('kawanku.sampah', '', true);
  return jsonb_build_object('dikembalikan', v_jumlah, 'dilewati', to_jsonb(v_gagal));
end;
$$;

create function public.hapus_permanen_sampah(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.boleh_sampah(p_id), false) then
    raise exception 'Tidak ditemukan atau di luar wewenang' using errcode = '42501';
  end if;
  delete from public.tempat_sampah where id = p_id;
  perform set_config('kawanku.sampah', '', true);
end;
$$;

revoke all on function public.kembalikan_dari_sampah(uuid), public.hapus_permanen_sampah(uuid) from public, anon;
grant execute on function public.kembalikan_dari_sampah(uuid), public.hapus_permanen_sampah(uuid) to authenticated;

-- Hapus permanen otomatis setelah 30 hari (03.00 WIB).
create function private.kosongkan_tempat_sampah() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_jumlah integer;
begin
  delete from public.tempat_sampah where kedaluwarsa_at < now();
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;
revoke all on function private.kosongkan_tempat_sampah() from public, anon, authenticated;
select cron.schedule('kawanku-tempat-sampah', '0 20 * * *', 'select private.kosongkan_tempat_sampah()');

alter publication supabase_realtime add table public.tempat_sampah;
