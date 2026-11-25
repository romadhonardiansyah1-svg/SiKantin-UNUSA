# Pembagian kerja tim SiKantin UNUSA

Satu anggota memegang satu bagian. Semua bekerja dari satu repositori GitHub. Direktori `worker/`, `supabase/`, `web/admin/`, dan `web/laporan/` adalah lokasi yang akan dibuat saat fitur dikerjakan. [Aturan agen](AGENTS.md) · [Kriteria penerimaan](RENCANA_IMPLEMENTASI.md)

## Tugas pertama setiap anggota

| Anggota dan contoh branch | Bagian yang dipegang | Hasil PR pertama dan serah terima |
| --- | --- | --- |
| 1 · Akun & integrasi · `fitur/skema-katalog` | `web/auth/`, `worker/auth/`, `worker/index.ts`, migrasi dasar dan kebijakan akses Supabase | Buat relasi kampus–tenant–menu serta kontrak baca publik. Kirim contoh respons ke 2 dan 4. Lanjutkan daftar email + sandi, verifikasi email, peran, dan relasi pemilik–tenant untuk 3. |
| 2 · Katalog & survei · `fitur/katalog-publik` | `web/publik/`, `worker/publik/`, migrasi `*_kirim_ulasan.sql` | Sambungkan katalog dan detail ke data baca. Buktikan pencarian pulih saat menekan Kembali dan kode stand tidak terkirim ke pelanggan. Berikutnya hubungkan survei ke sesi dari 1 serta tautan QR dari 3. |
| 3 · Pengelola & QR · `fitur/kelola-tenant` | `web/admin/`, `worker/admin/`, `worker/qr.ts` | Sambungkan daftar dan formulir tenant. Buktikan pengelola dapat mengubah data lalu melihat hasil setelah muat ulang. Lanjutkan kampus, menu, pertanyaan, moderasi, dan QR untuk survei anggota 2. |
| 4 · Dasbor, laporan & pengujian · `fitur/rating-tenant` | `web/laporan/`, `worker/laporan/`, migrasi `*_laporan.sql`, `tests/e2e/` | Hitung rating dari ulasan tayang, termasuk tenant tanpa ulasan. Kirim contoh hasil ke 2. Pakai perhitungan yang sama untuk dasbor dan ekspor. Uji dengan dua akun pemilik yang hanya dapat melihat tenant masing-masing. |

Anggota 1 mengurutkan migrasi dan menggabungkan PR yang lulus. Berkas dalam `scripts/fondasi.json` dipegang pemilik proyek. Sampaikan kebutuhan perubahan router, kerangka, atau desain acuan kepadanya di PR. Tampilan `web/admin-ui/` memakai data contoh.

## Bekerja di GitHub

1. **Pemilik proyek.** Buat satu repo privat kosong karena SKPL dan DPPL tim ikut terlacak. Dari folder ini, jalankan `git remote add origin URL_REPO` lalu `git push -u origin main` untuk unggahan pertama. Ganti `URL_REPO` dengan URL repo tim. Undang tiga anggota lain melalui **Settings → Collaborators**.
2. **Setiap anggota.** Klona repo, masuk ke foldernya, jalankan `git config core.hooksPath .githooks` dan `npm ci` dengan Node 22.12+. Dari `main` terbaru, jalankan `git switch -c NAMA_BRANCH` memakai nama pada tabel. Gunakan `npm run dev` untuk mencoba hasilnya.
3. **Satu PR untuk satu hasil.** Setelah `npm run build` lulus, commit berkas fitur dan jalankan `git push -u origin HEAD`. Buka PR ke `main`. Tulis apa yang berubah, cara menguji, dan kebutuhan dari anggota lain. Untuk UI, jalankan `npm run test:browser` di terminal kedua saat server lokal aktif dan Chrome terpasang. Sertakan tangkapan ponsel dan desktop.
4. **Tinjau lalu gabungkan.** Satu anggota lain meninjau PR. Gabungkan kontrak data dari 1, agregat dari 4, lalu katalog dari 2. Anggota 3 dapat mengerjakan formulir secara paralel. Mulai tugas berikutnya dari `main` yang sudah diperbarui. Jika paket GitHub repo mendukungnya, aktifkan syarat satu persetujuan pada `main`. [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) · [Proteksi branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## Pesan untuk grup

> Kita pakai satu repo SiKantin. Anggota 1 pegang akun dan database, anggota 2 katalog dan survei, anggota 3 pengelola dan QR, anggota 4 dasbor, laporan, dan pengujian. Ambil branch dan PR pertama sesuai tabel di DELEGASI_AGEN.md. Sebelum merge, minta satu teman meninjau. Kalau butuh perubahan di bagian teman, tulis kebutuhannya di PR.
