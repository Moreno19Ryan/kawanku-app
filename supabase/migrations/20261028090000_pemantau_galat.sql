-- =====================================================================
-- Pemantau galat (F5a, Reno 26 Okt 2026)
--
-- Setiap galat aplikasi (server: onRequestError di instrumentation.ts;
-- klien: halaman galat) dicatat lewat RPC catat_galat dan dirangkum di
-- Panel pengembang, supaya bug ketahuan sebelum dilaporkan pengguna.
-- Galat yang sama (sumber + rute + pesan) digabung: hanya jumlah & waktu
-- terakhirnya yang bertambah. Yang sudah ditandai "dicek" dibuka lagi bila
-- terulang. Hanya pemegang sistem.kelola (pengembang) yang bisa melihat.
--
-- Sengaja TIDAK masuk publikasi Realtime: galat di sebuah halaman tidak
-- boleh memicu segarkan halaman yang memicu galat lagi.
-- =====================================================================

create table public.galat_aplikasi (
  id          uuid primary key default gen_random_uuid(),
  sidik       text not null unique,
  sumber      text not null check (sumber in ('server', 'klien')),
  jenis       text check (length(jenis) <= 30),
  rute        text check (length(rute) <= 200),
  pesan       text not null check (length(pesan) <= 500),
  digest      text check (length(digest) <= 100),
  jumlah      integer not null default 1 check (jumlah > 0),
  pertama_at  timestamptz not null default now(),
  terakhir_at timestamptz not null default now(),
  dicek_at    timestamptz,
  dicek_oleh  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.galat_aplikasi is
  'Pemantau galat: galat aplikasi yang digabung per sidik (Panel pengembang).';
create index galat_aplikasi_terakhir_idx on public.galat_aplikasi (terakhir_at desc);
create trigger set_updated_at before update on public.galat_aplikasi
  for each row execute function private.set_updated_at();

revoke all on public.galat_aplikasi from anon, authenticated;
grant select on public.galat_aplikasi to authenticated;
grant update (dicek_at, dicek_oleh) on public.galat_aplikasi to authenticated;
alter table public.galat_aplikasi enable row level security;

create policy galat_aplikasi_select on public.galat_aplikasi
  for select to authenticated
  using (private.boleh('sistem.kelola', null));
create policy galat_aplikasi_update on public.galat_aplikasi
  for update to authenticated
  using (private.boleh('sistem.kelola', null))
  with check (private.boleh('sistem.kelola', null));

-- Pencatatan: satu-satunya jalan menulis. Bisa dipanggil tanpa login
-- (galat server dicatat tanpa sesi pengguna), jadi isinya dipotong dan
-- jumlah baris dibatasi supaya tidak bisa dipakai membanjiri database.
create function public.catat_galat(
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

  -- Batas 500 jenis galat; lebih dari itu hanya galat yang sudah ada yang dihitung.
  if (select count(*) from public.galat_aplikasi) >= 500 then
    return;
  end if;

  insert into public.galat_aplikasi (sidik, sumber, jenis, rute, pesan, digest)
  values (v_sidik, p_sumber, left(p_jenis, 30), v_rute, v_pesan, left(p_digest, 100))
  on conflict (sidik) do update
    set jumlah = public.galat_aplikasi.jumlah + 1, terakhir_at = now();
end;
$$;
revoke all on function public.catat_galat(text, text, text, text, text) from public;
grant execute on function public.catat_galat(text, text, text, text, text) to anon, authenticated;
