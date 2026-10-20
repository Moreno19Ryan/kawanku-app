# KawanKu

Aplikasi web manajemen Desa Kartika Wanasari: database jamaah, absensi mandiri,
dan monitoring kegiatan. Panduan lengkap untuk kontributor ada di
[`CLAUDE.md`](./CLAUDE.md).

## Menjalankan di lokal

Butuh Node.js 20.9 atau lebih baru (Vercel memakai Node 24).

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev                  # http://localhost:3000
```

Perintah lain:

| Perintah | Fungsi |
| -------- | ------ |
| `npm run lint` | ESLint |
| `npm run build` | Build produksi (juga cek TypeScript) |
| `npm run start` | Menjalankan hasil build |

## Environment variable

| Nama | Keterangan |
| ---- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key (Project Settings → API) |
| `SUPABASE_SECRET_KEY` | **Secret** key `sb_secret_...` (Project Settings → API Keys). Khusus server, untuk membuat akun admin dan mengatur ulang kata sandi dari aplikasi. Opsional: tanpa ini fitur tersebut nonaktif. |

**Jangan pernah** mengomit `.env.local`, secret/service role key, atau token
apa pun. Di Vercel, isi variabel lewat Project Settings → Environment
Variables; `SUPABASE_SECRET_KEY` ditandai **Sensitive** dan tidak boleh
diberi awalan `NEXT_PUBLIC_`.

Tanpa env var, `npm run build` tetap lolos, tapi login dan area admin tidak
bisa dipakai.

## Login admin

Admin masuk di `/login` dengan email + kata sandi (Supabase Auth). Tidak ada
pendaftaran mandiri: matikan **Allow new users to sign up** di Supabase, lalu
buat akun admin desa pertama dengan SQL bootstrap di
`docs/schema-proposal.md` §6.2. Akun yang login tapi bukan admin aktif
langsung dikeluarkan lagi.

## Alur kerja (pull request)

1. Buat branch dari `main`: `feat/...`, `fix/...`, `docs/...`.
2. Pastikan `npm run lint` dan `npm run build` lolos.
3. Push branch, lalu buka pull request ke `main`. Vercel otomatis membuat
   preview deployment dan GitHub Actions menjalankan lint + build.
4. Merge hanya setelah review dan persetujuan pemilik repo. Tidak ada push
   langsung ke `main`.
5. Migrasi database **tidak** dijalankan dari PR. Migrasi hanya dijalankan
   setelah disetujui eksplisit (lihat `CLAUDE.md`).
