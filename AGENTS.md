# Panduan agen SiKantin UNUSA

Saat bekerja berempat, ambil tugas sesuai [pembagian peran](DELEGASI_AGEN.md). Jika bekerja sendiri, ikuti tahap yang diminta atau mulai dari tahap pertama yang belum dicentang. Kriteria lulus setiap fitur ada di [rencana implementasi](RENCANA_IMPLEMENTASI.md).

## Aturan kerja

**Fondasi dipegang pemilik proyek.** Keempat agen hanya boleh mengubah modul fitur bagiannya. Daftar berkas yang dikunci ada di `scripts/fondasi.json` dan mencakup dokumen asli, acuan visual, aset, kerangka halaman, router, domain pelanggan, dan konfigurasi rilis. Jika tugas memerlukan perubahan fondasi, ajukan berkas dan alasan kepada pemilik. Pemilik yang mengubah acuan. Jangan memperbarui hash untuk meloloskan pekerjaan.

Pada klona baru jalankan `git config core.hooksPath .githooks`. Jalankan `npm run build` sebelum integrasi. Pemeriksaan hash bekerja saat commit dan build. Gunakan `npm run deploy` untuk menerbitkan Worker beserta aset dari `web/` sesuai konfigurasi rilis. Data contoh hanya dipakai untuk pratinjau dan pengujian lokal.

- Kerjakan satu alur per perubahan. Cek perubahan anggota lain sebelum mengedit. Koordinasikan perubahan file bersama dengan pemiliknya, termasuk rute, kontrak API, dan urutan migrasi.
- Cari ID `screen-*` dari rencana. Pakai markup, CSS, dan komponen HTML final sebagai acuan. Periksa definisi terakhir jika handler prototipe ditulis ulang. Tulis satu handler per aksi dan gunakan perhitungan yang sama untuk layar dan ekspor.
- Untuk pelanggan, gunakan formulir email dan kata sandi yang ada. Supabase Auth memeriksa daftar domain tahap 2. Server memeriksa peran dan akses tenant. Data contoh hanya untuk pengembangan dan pengujian.
- Uji fitur di area sendiri, jalankan lint, pemeriksaan tipe, dan build yang tersedia. Tinjau diff. Dalam tim, Agen 1 mencentang tahap setelah uji gabungan lulus. Laporkan hasil, perintah uji, dan kendala dalam tiga baris.

## Bahasa dan tampilan

- Gunakan bahasa Indonesia (`lang="id"`) dengan istilah yang sama di ponsel dan desktop. Tulis label sesuai tindakan, seperti “Pilih kampus” dan “Kirim ulasan”. Tampilkan harga dalam rupiah dengan format Indonesia dan waktu dalam WIB.
- Bangun satu UI dengan HTML semantik, CSS Grid/Flexbox dan media query prototipe, serta modul JavaScript untuk data dan interaksi. Pertahankan Plus Jakarta Sans, warna, ikon, dan komponen yang disepakati. Simpan filter kampus dan pencarian di URL agar tombol Kembali dan muat ulang memulihkan pilihan.
- Ikuti perilaku katalog acuan. Pada 390 dan 768 px, tampilkan satu kolom dan menu ponsel. Pada 1440 px, tampilkan dua kolom dan navigasi desktop. Tabel admin yang lebar dapat digeser di dalam wadahnya. Pastikan tombol bisa disentuh dan diakses lewat keyboard, serta fokus kembali ke pemicu saat panel ditutup.
- Ikat teks ke keadaan sebenarnya. Saat mengirim, tampilkan “Mengirim ulasan…”. Setelah server berhasil menyimpan, tampilkan “Ulasan terkirim”. Jika koneksi gagal, pertahankan isian dan sediakan “Coba lagi”. Uji juga hasil pencarian kosong dan nama tenant panjang. Bandingkan layar yang diubah dengan HTML final memakai data dan ukuran yang sama.
