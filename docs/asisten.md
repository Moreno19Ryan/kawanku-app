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

## "Kawan": ringkasan pagi, sambutan, rapor (F7)

- **Ringkasan hari ini (admin)**: kartu di atas Beranda admin
  (`RingkasanHariIni`, RPC `ringkasan_hari_ini`): pertemuan hari ini,
  pertemuan hari ini/besok yang belum ada pemateri (yang dikelola admin
  itu), dan izin menunggu persetujuannya (tanpa info milad, keputusan Reno). Isinya
  dihitung `private.ringkasan_hari` memakai fungsi izin yang sama dengan RLS
  (`boleh_lihat_kegiatan`, `boleh_kelola_pertemuan`, `boleh_jamaah`,
  `boleh_absensi_di`), jadi tiap admin hanya melihat wilayah & sasarannya.
  Kalender hari itu dari `private.kejadian_antara` (jadwal rutin + baris
  pertemuan). Kalimat yang sama dikirim ke HP admin tiap pagi, lihat
  `docs/notifikasi.md`.
- **Sambutan generus** (`src/lib/generus/sambutan.ts`, murni): salam sesuai
  jam WIB, lalu satu kalimat paling relevan: baru hadir lagi
  setelah ≥ 2 pertemuan terlewat (≤ 7 hari) → baru sakit (≤ 14 hari) →
  pengajian nanti/besok. Tidak ada yang khusus → hanya salam.
- **Rapor bulanan generus** (`/saya/rapor?bulan=YYYY-MM`, `raporBulan()` di
  `src/lib/generus/kehadiran.ts`, murni): persen hadir, hadir/izin-sakit/
  terlewat, selisih dengan bulan sebelumnya, rentetan terpanjang, lencana
  bulan itu (hadir penuh, beruntun, amanah), dan kalimat penutup. Bawaan:
  bulan lalu. Tautan "Rapor" di tiap bulan halaman Kehadiran; pekan pertama
  tiap bulan ada kartu "Rapor … sudah siap" di Beranda; tanggal 1 ada
  notifikasi HP.
- Semua kalimat di atas masih draf, menunggu persetujuan Reno.

## Teknis

- Logika murni: `src/lib/asisten/hitung.ts`; pengambilan data:
  `src/lib/asisten/data.ts` (setiap sumber dibungkus `aman()`, galat satu
  bagian tidak menggagalkan yang lain); tampilan:
  `src/components/asisten/kartu-asisten.tsx`.
- Butir bisa ditutup; diingat di perangkat itu (localStorage
  `kk-asisten-tutup`) sampai butirnya berganti.
- Di Beranda admin kartu dimuat dalam `<Suspense>` terpisah supaya angka
  utama tampil lebih dulu.
- Ide lanjutan: jamaah teladan per bulan, target pribadi generus, "Tanya
  KawanKu" (tanya-jawab berpilihan), sapaan yang ditindaklanjuti.
