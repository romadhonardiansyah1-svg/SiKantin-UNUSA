# Pembagian kerja tim SiKantin UNUSA

Gunakan satu ZIP proyek dan satu prompt per anggota. [Aturan agen](AGENTS.md) · [Kriteria penerimaan](RENCANA_IMPLEMENTASI.md)

## Mulai dari ZIP

1. Ketua membagikan tautan ZIP dari satu commit. Keempat anggota mengunduh dari tautan yang sama agar versi awalnya sama. Bentuk tautannya `https://github.com/romadhonardiansyah1-svg/SiKantin-UNUSA/archive/SHA.zip`. Ganti `SHA` dengan ID commit lengkap. [Arsip GitHub](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives)
2. Setiap anggota membuka chat baru di agen yang bisa membaca dan menghasilkan ZIP. Unggah ZIP proyek, lalu salin **satu** blok sesuai nomor anggota. [Agen 1](#agen-1) · [Agen 2](#agen-2) · [Agen 3](#agen-3) · [Agen 4](#agen-4)
3. Anggota 1 membagikan contoh respons dan migrasi yang disepakati. Anggota 2, 3, dan 4 mengunggah berkas itu ke chat masing-masing saat dibutuhkan.

## Pembagian modul

| Anggota dan branch | Bagian yang dipegang | Tugas setelah PR pertama |
| --- | --- | --- |
| 1 · `fitur/skema-katalog` | `web/auth/`, `worker/auth/`, `worker/index.ts`, migrasi dasar dan aturan akses Supabase | Daftar dengan email dan sandi, konfirmasi email, peran, dan relasi pemilik–tenant. Supabase membatasi domain persis ke `gmail.com`, `unusa.ac.id`, dan `student.unusa.ac.id`. |
| 2 · `fitur/katalog-publik` | `web/publik/`, `worker/publik/`, migrasi `*_kirim_ulasan.sql` | Sambungkan survei ke sesi pelanggan dari 1 dan QR dari 3. |
| 3 · `fitur/kelola-tenant` | `web/admin/`, `worker/admin/`, `worker/qr.ts` | Kelola kampus, menu, pertanyaan, moderasi ulasan, dan QR tenant. |
| 4 · `fitur/rating-tenant` | `web/laporan/`, `worker/laporan/`, migrasi `*_laporan.sql`, `tests/e2e/` | Pakai angka yang sama di dasbor, PDF, dan XLSX. Uji akses dengan dua akun pemilik. |

Sebagian folder baru dibuat saat fiturnya dikerjakan. Agen 1 mengurutkan migrasi di `supabase/migrations/`. Pemilik proyek memegang berkas fondasi di `scripts/fondasi.json`. Jika perlu mengubah router, kerangka halaman, atau desain acuan, tulis berkas dan alasannya untuk pemilik. `web/admin-ui/` berisi pratinjau.

## Prompt siap salin

### Agen 1

```text
Kamu Agen 1 SiKantin, penanggung jawab database dan akun. Ekstrak ZIP ini.
Baca AGENTS.md, pembagian modul di DELEGASI_AGEN.md, dan tahap 1 di RENCANA_IMPLEMENTASI.md.
Kerjakan migrasi Supabase untuk kampus, tenant, dan menu, beserta aturan baca publik.
Uji dari database lokal kosong. Pengunjung hanya boleh membaca tenant aktif
dan kolom publik. Kode stand, kontak privat, serta MoU harus terlindungi.
Sertakan contoh respons katalog dan detail untuk Agen 2, serta relasi yang dipakai Agen 3 dan 4.
Kembalikan agen-1-perubahan.zip dan hasil uji sesuai bagian Serah terima di DELEGASI_AGEN.md.
```

### Agen 2

```text
Kamu Agen 2 SiKantin, penanggung jawab katalog dan survei. Ekstrak ZIP ini.
Baca AGENTS.md, pembagian modul di DELEGASI_AGEN.md, dan tahap 1 di RENCANA_IMPLEMENTASI.md.
Kerjakan katalog dan detail tenant dengan desain HTML tim. Gunakan kontrak baca Agen 1.
Sambil menunggu kontrak, uji alur pilih kampus → cari menu → buka tenant → Kembali
dengan data contoh. Pastikan filter pulih dan kode stand tidak terkirim ke pelanggan.
Setelah kontrak tersedia, sambungkan dan uji alur yang sama. Kembalikan
agen-2-perubahan.zip dan hasil uji sesuai bagian Serah terima di DELEGASI_AGEN.md.
```

### Agen 3

```text
Kamu Agen 3 SiKantin, penanggung jawab pengelola kantin dan QR. Ekstrak ZIP ini.
Baca AGENTS.md, pembagian modul di DELEGASI_AGEN.md, dan tahap 2 di RENCANA_IMPLEMENTASI.md.
Kerjakan daftar tenant dan formulir tambah/ubah memakai tampilan pengelola yang disepakati.
Sambil menunggu skema dan sesi dari Agen 1, kerjakan formulir dan uji validasinya.
Setelah terhubung, buktikan perubahan pengelola tetap ada sesudah muat ulang
dan server menolak perubahan dari akun pemilik. QR masuk putaran berikutnya.
Kembalikan agen-3-perubahan.zip dan hasil uji sesuai bagian Serah terima di DELEGASI_AGEN.md.
```

### Agen 4

```text
Kamu Agen 4 SiKantin, penanggung jawab rating, laporan, dan pengujian. Ekstrak ZIP ini.
Baca AGENTS.md, pembagian modul di DELEGASI_AGEN.md, dan tahap 4 di RENCANA_IMPLEMENTASI.md.
Kerjakan satu perhitungan rating dari aspek inti yang terisi pada ulasan tayang.
Siapkan kasus uji untuk tenant tanpa ulasan, satu ulasan tayang, dan satu ulasan tersembunyi.
Pastikan ulasan tersembunyi tidak mengubah hasil dan tenant kosong menampilkan
“Belum ada penilaian”. Gunakan skema dari Agen 1 untuk SQL. Sambil menunggu skema,
siapkan data uji dan hitung hasil harapannya. Sertakan contoh hasil untuk Agen 2.
Kembalikan agen-4-perubahan.zip dan hasil uji sesuai bagian Serah terima di DELEGASI_AGEN.md.
```

## Serah terima

- **Agen.** Kerjakan tugas pertama di bagianmu dan pertahankan berkas fondasi. Gunakan lingkungan lokal. Jalankan `npm ci` dengan Node 22.12+ dan `npm run build`. Untuk UI, jalankan `npm run dev`, lalu `npm run test:browser` di terminal kedua dengan Chrome terpasang. Uji perilaku baru secara khusus. Sebutkan pengujian yang belum bisa dijalankan.
- **Hasil untuk anggota.** Kembalikan `agen-N-perubahan.zip` berisi berkas baru dan berkas yang diubah dengan jalur relatif dari akar proyek. Cantumkan jalur yang perlu dihapus atau diganti nama di chat. Lewati `.env`, kredensial, `node_modules/`, dan hasil build. Laporkan dalam tiga baris berisi hasil, perintah uji beserta hasilnya, dan kebutuhan dari anggota lain.
- **Masuk GitHub.** Di klona repo, aktifkan hook sekali dengan `git config core.hooksPath .githooks`. Untuk setiap ZIP hasil, buat branch dari commit ZIP awal dengan `git switch -c NAMA_BRANCH SHA`. Terapkan berkas ke jalur yang sama, periksa diff dan berkas baru, lalu uji ulang. Commit, `git push -u origin HEAD`, dan buka PR ke `main`. Satu teman meninjau sebelum Agen 1 menggabungkan. Gabungkan kontrak data dahulu, lalu fitur yang memakainya.

## Pesan untuk grup

> Teman-teman, unduh ZIP dari tautan yang aku kirim, lalu unggah ke chat agen masing-masing. Di DELEGASI_AGEN.md, salin prompt sesuai nomor kalian. Setelah selesai, kirim balik ZIP perubahan dan hasil uji ke grup supaya bisa kita gabungkan lewat GitHub.
