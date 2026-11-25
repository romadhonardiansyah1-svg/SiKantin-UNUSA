# Pembagian kerja empat agen SiKantin UNUSA

Satu anggota memegang satu peran di repositori yang sama. Folder dan nama migrasi berikut adalah usulan untuk implementasi. Daftar layar memakai ID dari HTML final tanpa awalan `screen-`. [Aturan agen](AGENTS.md) · [Kriteria lulus fitur](RENCANA_IMPLEMENTASI.md)

Daftar kunci di `scripts/fondasi.json` mengikat keempat peran. Untuk berkas yang terkunci, pemilik peran mengusulkan integrasi kepada pemilik proyek. Modul di `web/admin-ui/` berisi tampilan contoh untuk peninjauan. Agen 3 dan 4 mengembangkan layar operasional di folder fitur masing-masing.

## Agen 1 — Akun, basis data, dan integrasi

**Layar** `tenant-login`.

Pegang `web/auth/`, `worker/auth/`, `worker/index.ts`, konfigurasi proyek, lockfile, serta skema dan kebijakan akses Supabase. Dua migrasi khusus dimiliki Agen 2 dan 4 sesuai pembagian di bawah.

Mulai dari skema katalog dan kontrak baca bersama Agen 2 dan 4. Lanjutkan daftar/masuk, konfirmasi email, sesi, peran, kebijakan Storage, dan operasi akun pemilik untuk Agen 3. Daftarkan handler Worker dari tiap agen. Buktikan tiga domain tahap 2 diterima serta akses privat mengikuti pemilik tenant.

## Agen 2 — Katalog dan survei pelanggan

**Layar** `public-index`, `public-tenant-detail`, `public-review`, `public-review-success`.

Pegang `web/publik/`, `worker/publik/`, migrasi `*_kirim_ulasan.sql`, serta berkas UI bersama `web/index.html`, `web/router.js`, dan `web/styles/`. Pasang modul layar anggota lain pada router web.

Mulai dari katalog, pencarian, filter, dan detail memakai kontrak baca. Gunakan agregat rating dari Agen 4. Hubungkan survei ke sesi Agen 1 dan tujuan QR dari Agen 3. Buktikan tombol Kembali memulihkan filter, konfirmasi email kembali ke tenant asal, dan klik ganda menyimpan satu ulasan.

## Agen 3 — Operasional admin dan QR

**Layar** `admin-campuses`, `admin-tenants`, `admin-tenant-form`, `admin-menus`, `admin-questions`, `admin-reviews`, `admin-qr-print`.

Pegang `web/admin/`, `worker/admin/`, dan pengalihan QR publik di `worker/qr.ts`. Mulai dari formulir kampus, tenant, dan menu. Sambungkan foto ke Storage dan pengelolaan akun pemilik pasca-MoU ke operasi akun dari Agen 1. Lanjutkan pertanyaan survei, moderasi, dan QR.

Kode aktif di `/r/:token` membuka `/tenant/:slug/survei` milik Agen 2. Status tayang hasil moderasi dipakai Agen 4. Buktikan QR cetak dan PNG membuka tenant yang sama, penggantian token membatalkan QR lama, dan ulasan yang disembunyikan keluar dari rating publik.

## Agen 4 — Dasbor, laporan, dan pengujian gabungan

**Layar** `admin-dashboard`, `admin-report`, `tenant-dashboard`.

Pegang `web/laporan/`, `worker/laporan/`, migrasi `*_laporan.sql`, dan `tests/e2e/`. Mulai dari data uji dua tenant dan dua periode. Serahkan agregat rating tayang sejak tahap katalog, termasuk nilai `null` untuk tenant tanpa ulasan.

Gunakan perhitungan yang sama untuk dasbor, portal pemilik, PDF, dan XLSX. Cocokkan angka dengan data uji, periksa batas akses kedua pemilik, dan jalankan uji lintas peran setiap kali satu tahap digabung.

## Cara bekerja paralel

1. **Mulai dari commit yang sama.** Folder sumber saat rencana disusun belum menjadi repo Git. Agen 1 menyiapkan commit dasar di repo tim. Setiap agen memakai branch sendiri dalam worktree atau clone terpisah. Catat metode, rute, hak akses, dan satu contoh respons di deskripsi PR fitur. Untuk katalog, sepakati slug tenant, rating, dan jumlah ulasan.
2. **Kerjakan bagian masing-masing.** Setelah kontrak tersedia, UI dapat memakai data uji lokal sambil menunggu API. CSS khusus layar berada di folder pemiliknya. Untuk berkas bersama, kirim kebutuhan ke pemilik yang tercantum di atas. Agen 1 mengurutkan migrasi baru, termasuk dua migrasi khusus, agar semua dapat diterapkan dari basis data kosong.
3. **Gabungkan per alur.** Agen 1 menggabungkan perubahan ke branch integrasi. Untuk katalog, urutannya skema Agen 1 → agregat rating Agen 4 → API dan layar Agen 2. Agen 3 bisa mengerjakan formulir admin secara paralel. Agen 4 menjalankan uji gabungan, termasuk perbandingan ponsel dan desktop. Pemilik fitur memperbaiki kegagalan di bagiannya. Agen 1 mencentang tahap setelah lulus.

## Pesan awal untuk setiap agen

> Jalankan peran Agen [nomor] di DELEGASI_AGEN.md. Ikuti AGENTS.md. Mulai dari tugas pertama peranmu dan cocokkan hasil dengan RENCANA_IMPLEMENTASI.md. Laporkan hasil, perintah uji, dan kebutuhan dari anggota lain.
