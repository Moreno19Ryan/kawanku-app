-- =====================================================================
-- KawanKu: generus mengubah alamatnya sendiri (dari /saya/alamat)
-- =====================================================================
-- Akun generus boleh MELIHAT baris jamaah_pribadi miliknya sendiri dan
-- mengubah ALAMAT saja (KTP/KIA + domisili) lewat RPC ubah_alamat_saya().
-- Nama orang tua tetap hanya bisa diubah admin (izin pribadi.kelola).
-- Tidak ada policy insert/update baru: penulisan hanya lewat RPC ini, yang
-- menulis kolom alamat untuk jamaah_saya() saja.
-- =====================================================================

alter policy jamaah_pribadi_select on public.jamaah_pribadi
  using (private.boleh_jamaah('pribadi.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());

create or replace function public.ubah_alamat_saya(
  p_ktp_kode_wilayah text,
  p_ktp_wilayah      text,
  p_ktp_jalan        text,
  p_ktp_rt           smallint,
  p_ktp_rw           smallint,
  p_ktp_kode_pos     text,
  p_domisili_sama    boolean,
  p_dom_kode_wilayah text,
  p_dom_wilayah      text,
  p_dom_jalan        text,
  p_dom_rt           smallint,
  p_dom_rw           smallint,
  p_dom_kode_pos     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jamaah uuid := private.jamaah_saya();
  v_sama   boolean := coalesce(p_domisili_sama, false);
begin
  if v_jamaah is null then
    raise exception 'bukan akun generus aktif' using errcode = '42501';
  end if;
  -- PIN awal (tanggal lahir) wajib diganti dulu, sama dengan aplikasi.
  if exists (select 1 from public.akun_generus g
             where g.user_id = (select auth.uid()) and g.pin_awal) then
    raise exception 'pin awal belum diganti' using errcode = '42501';
  end if;

  insert into public.jamaah_pribadi as p (
    jamaah_id, ktp_kode_wilayah, ktp_wilayah, ktp_jalan, ktp_rt, ktp_rw, ktp_kode_pos,
    domisili_sama_ktp, dom_kode_wilayah, dom_wilayah, dom_jalan, dom_rt, dom_rw, dom_kode_pos
  ) values (
    v_jamaah, p_ktp_kode_wilayah, p_ktp_wilayah, p_ktp_jalan, p_ktp_rt, p_ktp_rw, p_ktp_kode_pos,
    v_sama,
    case when v_sama then null else p_dom_kode_wilayah end,
    case when v_sama then null else p_dom_wilayah end,
    case when v_sama then null else p_dom_jalan end,
    case when v_sama then null else p_dom_rt end,
    case when v_sama then null else p_dom_rw end,
    case when v_sama then null else p_dom_kode_pos end
  )
  on conflict (jamaah_id) do update set
    ktp_kode_wilayah  = excluded.ktp_kode_wilayah,
    ktp_wilayah       = excluded.ktp_wilayah,
    ktp_jalan         = excluded.ktp_jalan,
    ktp_rt            = excluded.ktp_rt,
    ktp_rw            = excluded.ktp_rw,
    ktp_kode_pos      = excluded.ktp_kode_pos,
    domisili_sama_ktp = excluded.domisili_sama_ktp,
    dom_kode_wilayah  = excluded.dom_kode_wilayah,
    dom_wilayah       = excluded.dom_wilayah,
    dom_jalan         = excluded.dom_jalan,
    dom_rt            = excluded.dom_rt,
    dom_rw            = excluded.dom_rw,
    dom_kode_pos      = excluded.dom_kode_pos;
end;
$$;

revoke all on function public.ubah_alamat_saya(text, text, text, smallint, smallint, text, boolean,
  text, text, text, smallint, smallint, text) from public, anon;
grant execute on function public.ubah_alamat_saya(text, text, text, smallint, smallint, text, boolean,
  text, text, text, smallint, smallint, text) to authenticated;
