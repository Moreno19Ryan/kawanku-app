# Pedoman Desain KawanKu (One UI)

Disepakati Reno, 27 Okt 2026. Redesign dilakukan bertahap per halaman;
setiap tahap mengikuti pedoman ini supaya aplikasi tetap terasa satu.
Mulai dari halaman masuk (`/masuk` & `/login`).

## Prinsip

1. **Area lihat & area sentuh** (khas One UI). Di HP, bagian atas untuk
   dilihat (judul besar, sapaan, ringkasan), bagian bawah untuk disentuh
   (form, tombol, menu) supaya mudah dijangkau jempol.
2. **Tenang**: latar netral (`bg-bg`), kartu membulat (`bg-surface`,
   `rounded-card`), ruang lega. Biru dipakai sebagai **aksen** (tombol
   utama, yang aktif, informasi penting), bukan memenuhi layar.
3. **Panel biru penuh hanya di halaman sambutan**: halaman masuk (dan kelak
   Beranda). Halaman kerja lain memakai judul besar di latar netral.
4. **Satu aksi utama per layar**: satu tombol `utama`; aksi lain `kedua` /
   `netral` / tautan.
5. **Intuitif**: isian yang tepat (keyboard angka untuk PIN, mata untuk
   kata sandi), galat di dekat isiannya, pesan ramah (`docs/pedoman-bahasa.md`).

## Fondasi

| Unsur | Aturan |
| ----- | ------ |
| Warna | Token di `globals.css` (`bg`, `surface`, `surface-muted`, `border`, `fg`, `muted`, `primary`, `primary-soft`, `success`, `warning`, `danger`); gelap ditulis dua kali. Panel sambutan: `bg-primary`, gelap `bg-primary-soft`, teks putih. |
| Huruf | Geist. Judul halaman 26–30 px semibold, rapat (`tracking-tight`); judul kartu 18 px; teks 15–16 px; keterangan 13–14 px `text-muted`. |
| Radius | `rounded-card` (kartu, panel bawah), `rounded-control` (isian), `rounded-pill` (tombol, tab, chip, saklar). |
| Jarak | Kelipatan 4 px; antarbagian 20–24 px; tepi `px-gutter`. |
| Bayangan | Sangat halus, hanya untuk kartu yang "mengambang" di atas panel. |
| Sentuh | Target minimal 44 px (tombol, tab, ikon). |
| Gerak | Muncul halus (naik + memudar ±300 ms), getar kecil saat galat; mati otomatis bila perangkat memilih "kurangi gerakan" (`.kk-muncul`, `.kk-goyang` di `globals.css`). |

## Komponen

- **Tombol**: `buttonClass("utama" | "kedua" | "netral")`, bentuk pil.
- **Pilihan nyala/mati**: `Saklar` (bukan kotak centang).
- **Pilihan banyak**: `Chip`.
- **Pilihan satu dari dua–empat**: tab bersegmen (latar `surface-muted`,
  yang aktif `surface` + bayangan halus).
- **Panel bawah** (bantuan, konfirmasi ringan): muncul dari bawah di HP,
  di tengah layar di laptop; tutup dengan tombol ✕, Esc, atau ketuk latar.
- **Logo**: `BrandMark` (atau varian putih di atas panel biru);
  logo desa hanya di footer 28–36 px (`LogoDesa`).

## Beranda generus (tahap 2)

- Halaman sambutan: panel biru di atas (logo putih, tema, keluar, salam,
  nama, kelompok, satu kalimat sambutan). Halaman menandai dirinya
  `data-sambutan` sehingga kepala biasa di layout generus disembunyikan.
- Kartu kegiatan terdekat **mengambang** di tepi bawah panel (bayangan
  halus); bila belum ada jadwal, kartu kehadiran bulan ini yang mengambang.
- Di bawahnya: pengumuman, pintasan (Ajukan izin, Rapor, Data diri: halaman
  yang tidak ada di menu bawah), kehadiran, asisten, jadwal, riwayat, lalu
  ajakan notifikasi & pasang aplikasi paling bawah.
- Menu bawah: tanpa garis atas, sudut atas membulat, bayangan halus; Scan
  tetap menonjol di tengah. Hiasan panel (`PolaK`, `LogoPutih`) di
  `src/components/brand/hiasan-sambutan.tsx`, dipakai bersama halaman masuk.

## Urutan redesign (usulan)

1. Halaman masuk (generus & admin). Selesai.
2. Beranda generus & menu bawah. ← tahap ini
3. Beranda admin.
4. Halaman kerja (Jamaah, Absensi, Kegiatan, Pengaturan), satu per satu.
