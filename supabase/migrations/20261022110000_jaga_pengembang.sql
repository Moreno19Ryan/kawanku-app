-- =====================================================================
-- KawanKu: jangan sampai tidak ada pengembang (22 Okt 2026)
-- =====================================================================
-- Kejadian 22 Okt: pengembang tidak sengaja mencabut peran pengembang
-- miliknya sendiri. Karena pengembang hanya satu, tidak ada lagi yang bisa
-- mengelola sistem lewat aplikasi (perlu perbaikan langsung di database).
-- Pengaman di database (berlaku untuk aplikasi maupun SQL langsung):
--   1. Peran tingkat sistem (memegang sistem.kelola) milik sendiri tidak
--      bisa dicabut/diubah oleh diri sendiri.
--   2. Pemegang sistem.kelola aktif yang terakhir (penugasan seluruh desa)
--      tidak bisa dicabut, dipindah, atau dinonaktifkan.
-- =====================================================================

-- Jumlah admin aktif yang memegang sistem.kelola (penugasan seluruh desa),
-- tidak menghitung satu penugasan/akun yang akan diubah.
create or replace function private.sisa_pengembang(p_kecuali_penugasan uuid, p_kecuali_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct pp.user_id)::integer
  from public.penugasan_peran pp
  join public.peran_izin pi on pi.peran_id = pp.peran_id and pi.izin_kode = 'sistem.kelola'
  join public.admin a on a.user_id = pp.user_id and a.aktif
  where pp.kelompok_id is null
    and pp.id is distinct from p_kecuali_penugasan
    and pp.user_id is distinct from p_kecuali_user;
$$;
revoke all on function private.sisa_pengembang(uuid, uuid) from public, anon;

create or replace function private.jaga_penugasan_sistem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.peran_sistem(old.peran_id) or old.kelompok_id is not null then
    return coalesce(new, old);
  end if;
  -- Perubahan yang tidak menyentuh peran/akun/wilayah (mis. updated_at) boleh.
  if tg_op = 'UPDATE' and new.peran_id = old.peran_id and new.user_id = old.user_id
     and new.kelompok_id is not distinct from old.kelompok_id then
    return new;
  end if;
  if old.user_id = (select auth.uid()) then
    raise exception 'Peran tingkat sistem milikmu sendiri tidak bisa dicabut'
      using errcode = '42501', hint = 'pengembang_sendiri';
  end if;
  if private.sisa_pengembang(old.id, null) = 0 then
    raise exception 'Ini pengembang terakhir; tambahkan pengembang lain dulu'
      using errcode = '42501', hint = 'pengembang_terakhir';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger jaga_penugasan_sistem
  before update or delete on public.penugasan_peran
  for each row execute function private.jaga_penugasan_sistem();

create or replace function private.jaga_admin_sistem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.aktif and not new.aktif and private.akun_sistem(old.user_id)
     and private.sisa_pengembang(null, old.user_id) = 0 then
    raise exception 'Ini pengembang terakhir; tidak bisa dinonaktifkan'
      using errcode = '42501', hint = 'pengembang_terakhir';
  end if;
  return new;
end;
$$;

create trigger jaga_admin_sistem
  before update of aktif on public.admin
  for each row execute function private.jaga_admin_sistem();
