# Audit alur SiKantin UNUSA

28 November 2026 · WIB

Prioritas rilis untuk pengguna umum adalah **pastikan email konfirmasi terkirim** dan **lengkapi menu serta jam tenant**. Katalog sudah bisa dipakai untuk mencari tenant. Pada saat diperiksa, dari empat tenant aktif hanya satu yang punya menu, dan keempatnya belum mencatat jam operasional. Ketiga kampus punya alamat dan belum mencatat fasilitas masing-masing. [Katalog online](https://sikantin-uji-sikantin-unusa-frontend.rossabuckerr.workers.dev/) · [Respons katalog](https://sikantin-uji-sikantin-unusa-frontend.rossabuckerr.workers.dev/api/katalog)

## Hasil per alur

| Alur | Hasil pemeriksaan | Perbaikan yang disarankan |
| --- | --- | --- |
| Pengunjung mencari makan | Pencarian kosong, hapus filter, detail tenant, dan arah ke daftar akun lulus di situs online. Katalog menampilkan 4 tenant, 1 item menu, dan rating pada 2 tenant. | **P0** Isi minimal satu menu dengan harga dan jam operasional per tenant aktif. Di dasbor, tampilkan mana yang belum lengkap. Setelah data terisi, pertimbangkan filter **Buka sekarang** dengan jadwal per hari. |
| Harga, stok, lokasi, dan pembayaran | Label jumlah menu di detail menghitung semua hasil termasuk menu berstatus **Habis**. Harga **Mulai** juga mengambil harga menu habis. Label **Tunai & QRIS** dipasang sama pada semua kartu. | **P1** Hitung harga terendah dari menu tersedia. Tampilkan jumlah menu yang tersedia. Simpan metode bayar per tenant jika memang berbeda. Lengkapi fasilitas per kampus dan cocokkan tujuan peta dengan alamat. [Logika katalog dan detail](web/publik/tampilan.js) |
| Daftar, konfirmasi, dan masuk | Aturan domain lulus uji unit. Konfirmasi, masuk, dan kembali ke survei asal lulus dengan Supabase dan kotak masuk lokal. Sakelar SMTP khusus proyek online nonaktif saat diperiksa. Formulir belum punya aksi kirim ulang konfirmasi atau pemulihan kata sandi. | **P0** Verifikasi pengiriman Auth ke inbox eksternal pada tiga domain. Jika memakai pengirim bawaan Supabase, pengiriman terbatas ke alamat tim proyek. **P1** Tambahkan kirim ulang dengan jeda dan pemulihan kata sandi. [Batas SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp) · [Alur akun](worker/auth.ts) |
| QR meja dan survei | Alur buat QR, unduh PNG, token lama setelah diganti, dan tujuan survei lulus lokal. Server memeriksa tenant, menu, status pelanggan, dan batas kirim. API status pada alias yang dipakai beroperasi, sementara alamat utama Worker mengembalikan HTTP 404 pada endpoint itu. | **P1** Tetapkan alamat Cloudflare jangka panjang sebelum cetak QR permanen. URL kartu mengikuti origin saat kartu ditampilkan. Uji cetak dan pindai dengan kamera ponsel sampai survei terkirim. [Pembuatan URL QR](worker/admin.ts) |
| Ulasan dan moderasi | Ulasan langsung terbit. Pada uji lokal, menyembunyikan satu ulasan juga menurunkan jumlah ulasan pada katalog dan mengeluarkan skornya dari laporan. | **P1** Jelaskan efek yang sekarang pada tombol dan dialog. Jika hanya teks yang melanggar, pisahkan aksi **Sembunyikan komentar** dan **Keluarkan ulasan dari perhitungan**. [Uji moderasi](tests/e2e/operasional.mjs) |
| Pengelola menyiapkan tenant | CRUD, arsip, nomor stand, foto, slide, QR, dan jam pembukaan lulus lokal. Tanggal dan status kontrak tersimpan, sedangkan katalog memakai status aktif tenant dan kampus. | **P1** Tampilkan tenant yang kontraknya berakhir pada dasbor. Sepakati aturan publikasi setelah kontrak habis agar pengelola tahu kapan perlu menyembunyikan tenant. [Aturan publikasi dan penyimpanan](supabase/migrations/20261127000400_jam_dan_layanan.sql) |
| Pengelola mengurus akses pemilik | Membuat akun dan mencabut akses lulus lokal. Pencabutan melepas kaitan profil. Formulir tambah pemilik memakai pembuatan akun Auth baru, sehingga jalur menautkan kembali akun lama belum tersedia. | **P1** Sediakan aksi **Aktifkan kembali akses** untuk akun yang sama. Riwayat tenant tetap bisa dipakai dan pengelola tidak perlu meminta email lain. [Pembuatan akun](worker/admin.ts) · [Pencabutan akses](supabase/migrations/20261127000300_mou_opsional.sql) |
| Laporan, ekspor, dan portal pemilik | Filter periode, XLSX, cetak PDF, logout, dan akses dua pemilik terisolasi pada uji lokal. API laporan online menolak permintaan tanpa sesi. Periode ekspor memakai label pilihan seperti **6 Bulan Terakhir**. | **P2** Tambahkan tanggal awal dan akhir WIB pada layar dan ekspor untuk memudahkan pencocokan dua laporan. Uji hasil cetak fisik sebelum dipakai pengelola. [Tampilan laporan](web/laporan/tampilan.js) · [Uji operasional](tests/e2e/operasional.mjs) |
| Beranda dan aksesibilitas animasi | Carousel berputar otomatis dengan pengaturan kurangi gerakan. Pengguna yang membiarkan gerakan aktif belum punya cara menghentikan putaran tanpa memindahkan fokus ke poster. | **P2** Jika tampilan tetap bersih dari kontrol tambahan, pakai satu video singkat yang berhenti sendiri sebelum lima detik. Jika carousel terus berputar, sediakan cara untuk menghentikannya. [WCAG Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) |

P0 didahulukan sebelum mengajak pengguna umum. P1 adalah perbaikan alur berikutnya. P2 bisa dikerjakan setelah data dan pendaftaran siap.

## Skeleton shimmer yang dipasang

Katalog, detail tenant, akun, survei, dasbor, dan laporan punya kerangka sesuai bentuk halaman. Kerangka muncul jika pemuatan melewati 180 ms. Teks status bisa dibaca pembaca layar. Kilau berhenti setelah tiga sapuan atau langsung diam saat perangkat meminta kurangi gerakan. Halaman selesai atau pesan galat menggantikan kerangka. [Kode pemuatan](web/muat.js) · [Pedoman status WCAG](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

Koneksi lambat, respons gagal, dan pindah halaman saat permintaan masih berjalan diuji di browser. Pindai QR yang masih menunggu respons pertama dari Worker mengikuti indikator navigasi browser. Skeleton tampil setelah HTML SiKantin diterima.

## Rekomendasi animasi

### Dari dapur ke meja

Pakai satu klip sinematik **4,5 detik** pada slot poster pertama beranda. Ambil satu hidangan dari menu tenant yang benar-benar tersedia. Gunakan foto asli sebagai acuan. Gerakkan uap, tangan, dan kamera secara halus agar tampak seperti liputan kantin.

| Durasi | Visual |
| --- | --- |
| 0–1,5 detik | Bidikan dekat hidangan dan uap tipis dalam cahaya siang. |
| 1,5–3,2 detik | Tangan meletakkan piring di atas nampan. Kamera bergerak pendek mengikuti piring. |
| 3,2–4,5 detik | Hidangan berhenti di meja. Bingkai terakhir menjadi poster diam. |

Tampilan web memakai gambar poster lebih dulu, mempertahankan posisi judul dan tombol **Lihat Daftar Stand**, lalu memutar klip sekali setelah data katalog siap. Sajikan diam pada perangkat dengan kurangi gerakan. Pakai WebM dan MP4 cadangan, ukuran 720p, serta target awal sekitar 600 KB. Uji di ponsel dengan koneksi lambat sebelum menaikkan kualitas. Pengelola saat ini bisa mengganti foto. Klip pertama dapat dipasang sebagai aset Cloudflare setelah disetujui. [Kinerja video web](https://web.dev/learn/performance/video-performance) · [Atribut video HTML](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video)

Dua gerakan lain yang masuk akal adalah transisi pudar singkat saat hasil filter berubah dan respons bintang ketika pelanggan menilai. Jadikan animasi mengikuti tindakan pengguna dan pertahankan posisi kartu agar fokus tetap mudah diikuti.

## Verifikasi

- Browser online pada 390 px memeriksa katalog, hasil kosong, tautan survei, dan akses portal tanpa sesi. Pengaturan SMTP dibaca di dasbor Supabase.
- `npm run test:browser` lulus pada 390, 768, dan 1440 px. `npm run test:operasional` lulus untuk pendaftaran lokal, CRUD, QR, moderasi, laporan, dan sesi pemilik. `npm run build` lulus termasuk pemeriksaan fondasi dan tipe Worker.
- Uji penerimaan yang masih diperlukan adalah penerimaan email di inbox eksternal, pemindaian QR dengan kamera ponsel, dan pemeriksaan cetakan fisik.
