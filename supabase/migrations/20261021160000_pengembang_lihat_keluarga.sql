-- Pengembang boleh MELIHAT keluarga (hanya lihat), melengkapi
-- 20261021120000_pengembang_lihat_jamaah supaya fitur Keluarga bisa
-- dipantau. Keputusan Reno (21 Okt 2026). Diterapkan ke produksi hanya
-- setelah "OK, jalankan".
--
-- Tetap TIDAK diberikan: keluarga.kelola (buat, ubah, hapus, atur anggota).
insert into public.peran_izin (peran_id, izin_kode)
select id, 'keluarga.lihat' from public.peran where kode = 'pengembang'
on conflict do nothing;
