-- =====================================================================
-- KawanKu: kategori jamaah kebal urutan (22 Okt 2026)
-- =====================================================================
-- Kejadian 21 Okt: urutan aturan diubah lewat tombol Naik/Turun, sehingga
-- jamaah menikah yang bekerja masuk "Remaja Dewasa" (generus) dan terlihat
-- admin generus. Pengaman:
--   1. Kategori generus hanya untuk jamaah lajang (dijaga constraint),
--      jadi urutan apa pun tidak bisa membuat jamaah menikah jadi generus.
--   2. Urutan diatur sistem (aplikasi menghitungnya dari bentuk aturan)
--      dan ditulis sekaligus lewat atur_urutan_kategori (satu transaksi).
-- Data produksi saat ini: semua jamaah generus sudah lajang, jadi tidak
-- ada jamaah yang berpindah kategori karena migrasi ini.
-- =====================================================================

update public.kategori_jamaah
set status_pernikahan_berlaku = '{lajang}'
where termasuk_generus
  and status_pernikahan_berlaku is distinct from '{lajang}'::public.status_pernikahan[];

alter table public.kategori_jamaah
  add constraint kategori_jamaah_generus_lajang check (
    not termasuk_generus or status_pernikahan_berlaku is not distinct from '{lajang}'::public.status_pernikahan[]
  );

-- ---------------------------------------------------------------------
-- Tulis ulang urutan semua kategori sekaligus (urutan unik, jadi lewat
-- nilai sementara). Security invoker: tetap dibatasi RLS (pengaturan.kelola).
-- p_ids harus memuat tepat semua kategori, urut dari yang dicek pertama.
-- ---------------------------------------------------------------------
create or replace function public.atur_urutan_kategori(p_ids uuid[])
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_jumlah int;
  v_diubah int;
begin
  select count(*) into v_jumlah from public.kategori_jamaah;
  if coalesce(cardinality(p_ids), 0) <> v_jumlah
     or (select count(distinct x) from unnest(p_ids) x) <> v_jumlah
     or exists (select 1 from unnest(p_ids) x
                where not exists (select 1 from public.kategori_jamaah k where k.id = x)) then
    raise exception 'Daftar kategori tidak lengkap' using hint = 'tidak_lengkap';
  end if;

  update public.kategori_jamaah k
     set urutan = -u.n
    from unnest(p_ids) with ordinality as u(id, n)
   where k.id = u.id;
  get diagnostics v_diubah = row_count;
  if v_diubah <> v_jumlah then
    raise exception 'Tidak berhak mengubah urutan kategori' using errcode = '42501';
  end if;
  update public.kategori_jamaah k
     set urutan = u.n, updated_at = now()
    from unnest(p_ids) with ordinality as u(id, n)
   where k.id = u.id;
end;
$$;
revoke all on function public.atur_urutan_kategori(uuid[]) from public, anon;
grant execute on function public.atur_urutan_kategori(uuid[]) to authenticated;
