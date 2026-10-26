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
| Saran (pola) | 3 pertemuan terakhir sebuah kegiatan (wilayah yang sama) tanpa pemateri tercatat |
| Saran (pola) | Kegiatan diliburkan ≥ 2× dalam 4 pekan |
| Peringatan (pola) | Absensi pertemuan sepekan terakhir kosong (tidak ada yang hadir; lupa scan?), hanya bila admin bisa melihat absensi |
| Saran (deteksi dini) | Jamaah **mulai jarang hadir**: 2 dari 4 pertemuan terakhir tidak hadir (izin/sakit tidak dihitung) padahal sebelumnya rajin (≥ 60%); juga status "Mulai jarang" di Laporan kehadiran (`mulaiJarang()`) |
| Saran | Pengajar rutin (aktif) di wilayah yang dikelola admin itu **belum mengisi 6 pekan** terakhir (dari `pertemuan_materi`) |
| Peringatan | Kemungkinan data jamaah ganda: nama (dirapikan) & tanggal lahir sama, untuk admin yang boleh mengubah data jamaah |
| Peringatan | Pengembang: galat aplikasi yang belum dicek dalam 7 hari terakhir |

## Isi untuk generus (`getSaranGenerus`)

| Jenis | Kapan muncul |
| ----- | ------------ |
| Pengingat | Besok ada pengajian (beserta pemateri bila sudah diisi) |
| Pengingat / peringatan | Izin disetujui / ditolak dalam 7 hari terakhir (+ catatan admin) |
| Saran | No. HP/WA atau alamat belum diisi |

## Pemantau galat (F5a)

- Galat server (render, API, Server Action, proxy) dicatat
  `onRequestError` di `src/instrumentation.ts`; galat di browser dicatat
  halaman galat (`HalamanGalat`, area admin & generus) lewat Server Action
  `laporGalatKlien`. Keduanya memanggil RPC `catat_galat` (migrasi
  `20261028090000_pemantau_galat`, `src/lib/sistem/galat.ts`).
- Galat yang sama (sumber + rute + pesan) digabung: jumlah & waktu
  terakhir bertambah. Rute disimpan tanpa query string dan id diganti
  `[id]` (`normalisasiRute`), supaya kata cari/id tidak ikut tercatat.
  Pesan dipotong 500 karakter; maksimal 500 jenis galat.
- Hanya pengembang (`sistem.kelola`) yang bisa melihat dan menandai "Sudah
  dicek" di Panel pengembang → Pemantau galat. Galat yang sudah dicek
  muncul lagi bila terulang. Tabel ini sengaja tidak masuk Realtime.

## Teknis

- Logika murni: `src/lib/asisten/hitung.ts`; pengambilan data:
  `src/lib/asisten/data.ts` (setiap sumber dibungkus `aman()`, galat satu
  bagian tidak menggagalkan yang lain); tampilan:
  `src/components/asisten/kartu-asisten.tsx`.
- Butir bisa ditutup; diingat di perangkat itu (localStorage
  `kk-asisten-tutup`) sampai butirnya berganti.
- Di Beranda admin kartu dimuat dalam `<Suspense>` terpisah supaya angka
  utama tampil lebih dulu.
- Ide lanjutan: notifikasi HP (pengingat H-1 & 1 jam sebelum acara, F5b,
  perlu kunci VAPID di Vercel), jamaah teladan per bulan, pengingat ulang
  tahun jamaah.
