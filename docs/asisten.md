# Asisten KawanKu

Kartu **Asisten KawanKu** di Beranda admin dan Beranda generus membuat
aplikasi terasa "hidup": memberi **pengingat**, **peringatan**, **saran**,
dan **apresiasi** yang dihitung otomatis dari data yang sudah ada (tanpa
tabel baru). Batas data tetap RLS dan wewenang tiap admin.

## Isi untuk admin (`getSaranAdmin`)

| Jenis | Kapan muncul |
| ----- | ------------ |
| Peringatan | Kehadiran (desa/kelompok) turun dua bulan berturut-turut, total ≥ 10 poin |
| Pengingat | Pertemuan besok (yang dikelola admin itu) |
| Pengingat | Pengajuan izin generus menunggu persetujuan admin itu |
| Saran | Pertemuan 7 hari ke depan belum ada pematerinya |
| Saran | Jamaah perlu disapa (3 pertemuan terakhir tidak hadir) |
| Apresiasi | Kehadiran naik ≥ 5 poin dari bulan lalu; jamaah rajin (≥ 85%) |

## Isi untuk generus (`getSaranGenerus`)

| Jenis | Kapan muncul |
| ----- | ------------ |
| Pengingat | Besok ada pengajian (beserta pemateri bila sudah diisi) |
| Pengingat / peringatan | Izin disetujui / ditolak dalam 7 hari terakhir (+ catatan admin) |
| Saran | No. HP/WA atau alamat belum diisi |

## Teknis

- Logika murni: `src/lib/asisten/hitung.ts`; pengambilan data:
  `src/lib/asisten/data.ts` (setiap sumber dibungkus `aman()`, galat satu
  bagian tidak menggagalkan yang lain); tampilan:
  `src/components/asisten/kartu-asisten.tsx`.
- Butir bisa ditutup; diingat di perangkat itu (localStorage
  `kk-asisten-tutup`) sampai butirnya berganti.
- Di Beranda admin kartu dimuat dalam `<Suspense>` terpisah supaya angka
  utama tampil lebih dulu.
- Ide lanjutan: jamaah teladan per bulan, pengingat ulang tahun jamaah,
  pengingat absensi yang belum ditutup lewat notifikasi (perlu push
  notification).
