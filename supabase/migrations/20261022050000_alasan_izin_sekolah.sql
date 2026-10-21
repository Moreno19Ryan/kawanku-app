-- =====================================================================
-- KawanKu: alasan izin "sekolah"
-- =====================================================================
-- Keputusan Reno (21 Okt 2026): caberawit & generus SD/SMP/SMA bisa izin
-- karena kegiatan sekolah. Nilai enum baru ditambahkan sebelum 'kuliah'
-- supaya urutannya mengikuti jenjang.
-- =====================================================================
alter type public.alasan_izin add value if not exists 'sekolah' before 'kuliah';
