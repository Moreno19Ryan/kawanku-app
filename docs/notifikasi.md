# Notifikasi HP (F5b)

Generus yang menyalakan **Pengingat di HP** (Beranda generus atau Profil
saya) mendapat notifikasi pengajian:

| Pengingat | Kapan |
| --------- | ----- |
| Besok: {kegiatan} | Malam sebelumnya, pertama kali antara 18.00–21.59 WIB |
| Sebentar lagi: {kegiatan} | ±1 jam sebelum mulai (dicek tiap 5 menit) |

Isi: jam mulai (WIB), pemateri bila sudah diisi, lokasi. Tidak dikirim bila
pertemuan diliburkan atau izinnya sudah disetujui. Setiap pengingat dikirim
sekali per orang per pertemuan (`notifikasi_terkirim`). Menekan notifikasi
membuka Jadwal saya.

Pesertanya sama dengan absensi: kegiatan kelompoknya + kegiatan desa; kegiatan
khusus generus hanya untuk yang termasuk generus. Admin belum mendapat
notifikasi (bisa ditambah nanti).

## Cara kerja

1. Browser berlangganan Web Push (kunci publik VAPID) → RPC
   `simpan_langganan_notifikasi` → tabel `langganan_notifikasi` (per
   perangkat; hanya pemiliknya yang bisa melihat).
2. pg_cron `kawanku-kirim-notifikasi` tiap 5 menit menjalankan
   `private.kirim_notifikasi()`: menghitung pengingat jatuh tempo
   (`private.notifikasi_jatuh_tempo`, jadwal rutin + pertemuan tersimpan,
   sama seperti absensi otomatis), mencatatnya, lalu **pg_net** mengirim
   POST ke `/api/notifikasi/kirim` dengan rahasia bersama.
3. Server aplikasi memeriksa rahasia, mengirim Web Push dengan kunci privat
   VAPID (`web-push`), lalu melapor balik lewat RPC
   `hasil_kirim_notifikasi` (langganan 404/410 dimatikan).

Jenis notifikasi (`notifikasi_jatuh_tempo`, kunci unik per akun):

| Kunci | Untuk | Kapan |
| ----- | ----- | ----- |
| `h1:…` / `jam:…` | Generus | Malam sebelum (18–21 WIB) & ±1 jam sebelum pengajian |
| `sistem:…` | Pengembang | Peringatan cadangan/ruang database (`notifikasi_sistem`) |
| `pagi:<tanggal>` | Admin yang menyalakan "Ringkasan pagi di HP" (Beranda / Pengaturan → Akun saya) | 05.30–08.59 WIB, sekali sehari, hanya bila ada isinya |
| `rapor:<YYYY-MM>` | Generus (akun sudah ada bulan lalu) | Tanggal 1, 09.00–20.59 WIB |

Ringkasan pagi dihitung "sebagai" admin itu (`private.ringkasan_hari_untuk`
mengganti identitas JWT sementara di transaksi, lalu mengembalikannya),
supaya aturannya persis sama dengan RLS dan kartu di Beranda.

Secret key Supabase **tidak** dipakai. Selama kunci/rahasia belum diisi,
semuanya diam (tombol menampilkan "belum disiapkan", database tidak mengirim).

## Pemasangan di produksi (sekali, oleh Reno)

1. **Supabase → Database → Extensions**: nyalakan `pg_net`.
2. **Buat kunci VAPID** di laptop: `npx web-push generate-vapid-keys`.
   Hasilnya *Public Key* dan *Private Key*.
3. **Buat rahasia bersama**: string acak panjang, mis. hasil
   `openssl rand -hex 32`.
4. **Vercel → Settings → Environment Variables** (Production & Preview):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key
   - `VAPID_PRIVATE_KEY` = Private Key (rahasia)
   - `VAPID_SUBJECT` = `mailto:` + email pengembang
   - `NOTIFIKASI_RAHASIA` = rahasia bersama (rahasia)

   Lalu deploy ulang (Redeploy) supaya kunci publik ikut ke browser.
5. **Supabase → SQL Editor** (jangan dikirim ke chat):
   ```sql
   select vault.create_secret('https://inikawanku.com', 'kawanku_notifikasi_url');
   select vault.create_secret('<rahasia bersama yang sama>', 'kawanku_notifikasi_rahasia');
   ```
6. Uji: login generus di HP → Profil saya → Pengingat di HP → Nyalakan →
   Kirim uji.

Mengganti rahasia: ubah env Vercel **dan** secret Vault
(`vault.update_secret`) bersamaan. Mengganti kunci VAPID membuat semua
langganan lama tidak berlaku; generus perlu menyalakan ulang.

## Batasan

- iPhone/iPad: hanya bila KawanKu dipasang ke layar utama (iOS 16.4+).
- Notifikasi diblokir di browser → harus diizinkan lewat pengaturan situs.
- Pengingat "sebentar lagi" bisa datang 60–70 menit sebelum mulai
  (pengecekan tiap 5 menit).
