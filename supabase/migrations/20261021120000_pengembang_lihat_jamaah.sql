-- Pengembang boleh MELIHAT data jamaah (hanya lihat), supaya modul Jamaah
-- bisa dipantau saat uji coba/debugging tanpa meminjam peran admin desa.
-- Keputusan Reno (21 Okt 2026). Diterapkan ke produksi hanya setelah
-- "OK, jalankan".
--
-- Yang TIDAK diberikan: jamaah.tambah/ubah/hapus, keluarga.*, keringanan.*,
-- janda_duda.* (data terbatas tetap tersembunyi).
insert into public.peran_izin (peran_id, izin_kode)
select id, 'jamaah.lihat' from public.peran where kode = 'pengembang'
on conflict do nothing;
