# Pembaruan status sekolah tahunan (USULAN)

Keputusan Reno (21 Okt 2026): yang bertanggung jawab memperbarui status
sekolah tiap tahun ajaran baru (sekitar Juli) adalah **admin kelompok**
untuk jamaah kelompoknya. Usulan Claude di bawah menunggu persetujuan.

## Masalahnya sekarang

Kategori jamaah (caberawit, pra-remaja, remaja muda, dst.) dihitung dari
`status_sekolah`. Tanpa data kelas, setiap Juli admin harus memeriksa satu
per satu siapa yang lulus SD → SMP, SMP → SMA, SMA → kuliah/bekerja. Mudah
terlewat, dan kategori (termasuk siapa yang dianggap generus) jadi salah.

## Usulan: kolom `kelas` + "Kenaikan kelas" sekali klik

1. **Kolom `kelas` opsional** di `jamaah` (angka 1–12, hanya untuk SD/SMP/
   SMA). SD 1–6, SMP 7–9, SMA/SMK 10–12. Diisi saat tambah/ubah jamaah;
   generus bisa melaporkannya lewat "Lapor data salah".
2. **Halaman Kenaikan kelas** (mulai 1 Juli, untuk admin kelompok):
   - Daftar jamaah bersekolah di kelompoknya, dengan usulan otomatis:
     kelas +1; kelas 6 → SMP kelas 7; kelas 9 → SMA kelas 10;
     kelas 12 → **lulus** (admin memilih: kuliah / bekerja / lainnya).
   - Centang "tinggal kelas" bila perlu, lalu **Terapkan** sekali klik.
     Kategori otomatis ikut menyesuaikan.
   - Jamaah tanpa data kelas ditandai "kelas belum diisi" supaya bisa
     dilengkapi saat itu juga.
3. **Pengingat** di Dashboard admin kelompok setiap Juli sampai kenaikan
   kelas tahun itu selesai; tercatat siapa dan kapan menerapkannya.
4. PAUD/TK → SD tetap pilihan manual (umur masuk SD berbeda-beda).

Perubahan: satu migrasi kecil (kolom `kelas` + catatan kenaikan per tahun
per kelompok), halaman baru, dan isian kelas di form jamaah.
