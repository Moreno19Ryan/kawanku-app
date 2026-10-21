-- =====================================================================
-- KawanKu: profil generus (/saya/profil)
-- =====================================================================
-- Keputusan Reno (21 Okt 2026):
--   - Generus mengubah sendiri: nama panggilan, no. HP/WA, email.
--   - Data lain (nama, tanggal lahir, status sekolah, dll.) tidak diubah
--     langsung: generus mengirim usulan koreksi, admin yang membetulkan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kontak & nama panggilan sendiri
-- ---------------------------------------------------------------------
alter policy jamaah_kontak_select on public.jamaah_kontak
  using (private.boleh_jamaah('kontak.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());

-- Hanya nama panggilan (jamaah), no. HP & email (jamaah_kontak) milik
-- jamaah_saya(). No. HP wali dan kolom lain tidak tersentuh.
create or replace function public.ubah_profil_saya(p_nama_panggilan text, p_no_hp text, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jamaah    uuid := private.jamaah_saya();
  v_panggilan text := nullif(regexp_replace(trim(coalesce(p_nama_panggilan, '')), '\s+', ' ', 'g'), '');
begin
  if v_jamaah is null then
    raise exception 'bukan akun generus aktif' using errcode = '42501';
  end if;
  if exists (select 1 from public.akun_generus g
             where g.user_id = (select auth.uid()) and g.pin_awal) then
    raise exception 'pin awal belum diganti' using errcode = '42501';
  end if;
  if length(v_panggilan) > 40 then
    raise exception 'nama panggilan maksimal 40 karakter' using errcode = '22001';
  end if;

  update public.jamaah set nama_panggilan = v_panggilan where id = v_jamaah;
  insert into public.jamaah_kontak as k (jamaah_id, no_hp, email)
  values (v_jamaah, nullif(p_no_hp, ''), nullif(lower(trim(coalesce(p_email, ''))), ''))
  on conflict (jamaah_id) do update set no_hp = excluded.no_hp, email = excluded.email;
end;
$$;
revoke all on function public.ubah_profil_saya(text, text, text) from public, anon;
grant execute on function public.ubah_profil_saya(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Usulan koreksi data dari generus
-- ---------------------------------------------------------------------
create table public.usulan_koreksi (
  id            uuid primary key default gen_random_uuid(),
  jamaah_id     uuid not null references public.jamaah (id) on delete cascade,
  bagian        text not null check (bagian in (
                  'nama_lengkap', 'tanggal_lahir', 'jenis_kelamin', 'status_sekolah',
                  'pendidikan_terakhir', 'status_pernikahan', 'kelompok', 'keluarga', 'lainnya')),
  isi           text not null check (length(trim(isi)) between 1 and 300),
  status        text not null default 'menunggu' check (status in ('menunggu', 'selesai', 'ditolak')),
  tanggapan     text check (length(tanggapan) <= 300),
  ditangani_by  uuid references auth.users (id) on delete set null,
  ditangani_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null
);
-- Satu usulan menunggu per bagian per jamaah (juga membatasi jumlah kiriman).
create unique index usulan_koreksi_satu_menunggu on public.usulan_koreksi (jamaah_id, bagian)
  where status = 'menunggu';
create index usulan_koreksi_status_idx on public.usulan_koreksi (status, created_at);
create index usulan_koreksi_created_by_idx on public.usulan_koreksi (created_by);
create index usulan_koreksi_updated_by_idx on public.usulan_koreksi (updated_by);
create index usulan_koreksi_ditangani_by_idx on public.usulan_koreksi (ditangani_by);

-- Usulan baru selalu 'menunggu'; setelah dibuat hanya status & tanggapan
-- yang bisa berubah, dan penanganannya dicatat otomatis.
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
  if new.jamaah_id <> old.jamaah_id or new.bagian <> old.bagian or new.isi <> old.isi then
    raise exception 'Isi usulan tidak bisa diubah';
  end if;
  if new.status <> old.status then
    new.ditangani_by := (select auth.uid());
    new.ditangani_at := case when new.status = 'menunggu' then null else now() end;
  end if;
  return new;
end;
$$;

create trigger atur_usulan before insert or update on public.usulan_koreksi
  for each row execute function private.atur_usulan_koreksi();
create trigger set_updated_at before update on public.usulan_koreksi
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.usulan_koreksi
  for each row execute function private.set_updated_by();

revoke all on public.usulan_koreksi from anon, authenticated;
grant select, insert, update, delete on public.usulan_koreksi to authenticated;
alter table public.usulan_koreksi enable row level security;

-- Lihat: admin yang boleh melihat jamaahnya, dan generus pemiliknya.
create policy usulan_koreksi_select on public.usulan_koreksi
  for select to authenticated
  using (private.boleh_jamaah('jamaah.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());
-- Kirim: hanya generus untuk dirinya sendiri.
create policy usulan_koreksi_insert on public.usulan_koreksi
  for insert to authenticated with check (jamaah_id = private.jamaah_saya());
-- Tangani (selesai/tolak): admin yang boleh mengubah data jamaahnya.
create policy usulan_koreksi_update on public.usulan_koreksi
  for update to authenticated
  using (private.boleh_jamaah('jamaah.ubah', jamaah_id))
  with check (private.boleh_jamaah('jamaah.ubah', jamaah_id));
-- Batalkan: generus pemilik, selama masih menunggu.
create policy usulan_koreksi_delete on public.usulan_koreksi
  for delete to authenticated
  using (jamaah_id = private.jamaah_saya() and status = 'menunggu');
