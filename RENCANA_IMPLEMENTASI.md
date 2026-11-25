# Rencana implementasi SiKantin UNUSA

HTML final mengatur tampilan. SKPL bagian 1–4 mengatur hak akses. Untuk alur dan data, lihat DPPL Tabel 2.1 dan Gambar 3.6–3.8, 4.13–4.16, 5.1. SKPL mengecualikan pemesanan, pembayaran daring, dan promosi. [HTML tim](<sikantin_unusa_katalog_tenant_survei_kepuasan_kantin (1).html>) · [SKPL](<SKPL Tenant Kantin (1).docx>) · [DPPL](<DPPL_kantin unusa (1).docx>)

**Revisi autentikasi pelanggan.** Pendaftaran email dan kata sandi pada tahap 2 menggantikan ketentuan login Google di SKPL dan DPPL.

## Pilihan server

- **Cloudflare Workers Free** menyajikan HTML, CSS, dan modul JavaScript dari `web/` lewat Static Assets. Satu Worker TypeScript di `worker/` menangani `/api/*` dan `/r/*` lewat `run_worker_first`. Gunakan fallback SPA untuk URL layar dan 404 JSON untuk API yang tidak dikenal. Pada 24 November 2026, aset statis gratis dan kuota dinamis 100.000 permintaan/hari per akun dengan 10 ms CPU/panggilan. [Routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) · [Aset](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) · [Kuota](https://developers.cloudflare.com/workers/platform/limits/)
- **Supabase Auth, Postgres, dan Storage** menggantikan usulan Laravel/Socialite dan MySQL di SKPL. Gunakan cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`. Worker memeriksa origin saat data diubah dan meneruskan JWT pengguna agar aturan per baris (RLS) berlaku. Simpan kunci administratif di Worker Secrets. Verifikasi peran admin sebelum memakai Auth Admin. Gunakan `no-store` untuk sesi dan laporan privat. [Auth Admin](https://supabase.com/docs/reference/javascript/admin-api) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Relasi utama.** Kampus → tenant → menu. Kaitkan `auth.users` ke profil dengan peran yang ditetapkan server. Saat akun pemilik sudah dibuat, relasi pemilik–tenant satu banding satu. Maksimal satu QR aktif per tenant. Ulasan terhubung ke pelanggan, tenant, menu pilihan, dan jawaban per versi pertanyaan. Simpan kontak, peran, MoU, dan kontrak secara privat. Letakkan migrasi di `supabase/migrations/`.

## Empat tahap pengerjaan

**Frontend yang sudah tersedia.** Katalog, detail tenant, formulir akun, simulasi survei, dan tampilan pengelola serta pemilik dapat ditinjau di [pratinjau Cloudflare](https://sikantin-unusa-frontend.rossabuckerr.workers.dev/). Pratinjau memakai data contoh. Untuk menjalankan salinan lokal gunakan `npm ci` dan `npm run dev`. Pada terminal kedua jalankan `npm run test:browser` dengan Chrome terpasang. Periksa fondasi dan paket rilis dengan `npm run build`. Tahap operasional di bawah masih memerlukan Supabase.

Nama layar memakai ID HTML tanpa awalan `screen-`. Rute dan folder merupakan usulan implementasi. Keempat agen dapat bekerja paralel. Centang tahap setelah hasil mereka terintegrasi dan memenuhi uji penerimaan. [Pembagian kerja empat agen](DELEGASI_AGEN.md) · [Aturan bahasa dan tampilan](AGENTS.md#bahasa-dan-tampilan)

### 1. Katalog publik

**Layar** `public-index`, `public-tenant-detail`.

`/` → pilih kampus A/B/C, cari tenant/menu, filter kategori → `/tenant/:slug`. Tampilkan tenant aktif, foto, harga, ketersediaan menu, dan ulasan tayang. Batasi kolom publik di Supabase. Gunakan CSS, font Plus Jakarta Sans, ikon, kartu, dan breakpoint asli.

- [ ] **Lulus** bila tautan detail dan muat ulang bekerja, Kembali memulihkan filter, dan tenant nonaktif tersembunyi. Nol ulasan tampil sebagai “Belum ada penilaian” (prototipe `getTenantStats` memberi 5,0). Cocokkan tampilan dengan HTML pada 390 dan 1440 px memakai data uji yang sama.

### 2. Akun, operasional admin, dan QR

**Layar** `tenant-login`, `admin-dashboard`, `admin-campuses`, `admin-tenants`, `admin-tenant-form`, `admin-menus`, `admin-qr-print`.

Gunakan `unifiedRegisterForm` di `/daftar` dan `unifiedLoginForm` di `/masuk` pada layar yang sama. Aktifkan **Confirm email** sejak pengujian lokal. Pelanggan baru mendaftar dengan email dan kata sandi, lalu mengonfirmasi alamat lewat tautan email sekali. Pelanggan lama langsung masuk. Pendaftaran mandiri selalu memberi peran pelanggan. [Auth email dan kata sandi](https://supabase.com/docs/guides/auth/passwords)

Terima alamat valid dengan domain persis `gmail.com`, `unusa.ac.id`, atau `student.unusa.ac.id` (mahasiswa). Abaikan spasi di tepi alamat dan perbedaan huruf besar/kecil pada domain. Tegakkan aturan di Supabase Auth lewat hook SQL **Before User Created**, termasuk untuk pendaftaran langsung ke Auth. Di form, tampilkan petunjuk “Gunakan @gmail.com, @unusa.ac.id, atau @student.unusa.ac.id”. [Pembatasan domain di Supabase](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)

Di `/masuk`, tautan pratinjau peran membuka login staf. Worker memetakan username ke email privat, Supabase memverifikasi sandi. Admin awal disiapkan pengelola Supabase. Peran dari server menentukan tujuan `/admin` atau `/pemilik/laporan`. URL privat tanpa sesi kembali ke login, salah peran ditolak. Logout mengakhiri sesi dan kembali ke katalog.

Admin menjalankan CRUD kampus/fasilitas, tenant, menu, serta akun pemilik setelah MoU disetujui secara luring. Aktifkan akses pemilik setelah relasi tenant tersimpan. Simpan/batal kembali ke daftar asal. Pertahankan riwayat dengan mengarsipkan master yang pernah diulas. Untuk foto tenant/menu, batasi unggahan Storage ke admin, validasi JPG/PNG/WebP hingga 2 MB. [Akses Storage](https://supabase.com/docs/guides/storage/security/access-control)

Pada baris tenant, sediakan buat, lihat, ganti, cabut, unduh PNG, dan cetak QR. Isi QR dan teks kartu harus sama persis, yaitu origin aplikasi ditambah `/r/:token`. Token valid membuka survei tenant terkait. Token lama atau tenant nonaktif menampilkan pesan QR tidak berlaku.

- [ ] **Lulus** bila `nama@GMAIL.COM`, `nama@unusa.ac.id`, dan `nim@student.unusa.ac.id` diterima. Tolak `nama@yahoo.com`, `nama@sub.unusa.ac.id`, dan `nama@unusa.ac.id.example.org`. Uji kedua kelompok lewat form dan langsung ke Auth. Perubahan harga/foto bertahan setelah muat ulang. Pemilik yang dicabut kehilangan akses dan operasi admin menolak pemilik. Pindai PNG dan kartu cetak dengan ponsel. Keduanya menuju tenant yang sama dan token lama gagal setelah diganti.

### 3. Survei pelanggan dan moderasi

**Layar** `public-review`, `public-review-success`, `admin-questions`, `admin-reviews`.

Tombol **Isi Survei** dan QR menuju `/tenant/:slug/survei`. Pelanggan dengan sesi aktif dan email terkonfirmasi langsung membuka formulir. Pengunjung diarahkan ke **Daftar** dengan pilihan **Sudah punya akun? Masuk**. Bawa slug tenant melalui konfirmasi dan masuk, lalu buka kembali survei tenant tersebut. Validasi slug di server. Jika dibatalkan, kembali ke detail tenant.

Admin melakukan CRUD pertanyaan, mengatur urutan, status aktif, dan wajib isi. Lima aspek awal DPPL meliputi rasa, kebersihan, porsi, kualitas, dan kemudahan pembayaran. Simpan jawaban tambahan bertipe bintang, teks, atau ya/tidak, status responden di UNUSA, serta menu terpilih. Komentar boleh kosong.

`POST /api/tenant/:slug/ulasan` memanggil satu fungsi Postgres. Dari sesi, periksa peran pelanggan serta email aktif yang terkonfirmasi dan memenuhi aturan domain tahap 2. Validasi tenant aktif, kepemilikan menu, jawaban wajib, dan skor 1–5. Simpan ulasan beserta jawaban memakai waktu server dalam satu transaksi. Kunci pasangan akun–tenant saat memeriksa batas kirim. Gunakan ID kiriman unik per pelanggan agar percobaan ulang memperoleh hasil pertama. Tutup akses tulis langsung ke tabel ulasan. Setelah tersimpan, tampilkan konfirmasi dengan pilihan kembali ke detail atau katalog.

- [ ] **Lulus** bila akun baru dari QR kembali ke tenant asal setelah konfirmasi, dan akun lama dari katalog kembali ke tenant asal setelah masuk. Pengiriman sebelum konfirmasi atau dengan isian wajib kosong ditolak. Klik ganda menyimpan satu ulasan. Dua kiriman baru serentak dengan sisa satu jatah menghasilkan satu sukses dan satu penolakan (429). Verifikasi, sembunyikan, tandai spam, atau hapus sebagai admin, lalu cek ulang daftar dan rating publik.

### 4. Laporan pemilik, ekspor admin, dan rilis

**Layar** `tenant-dashboard`, `admin-report`.

`/pemilik/laporan` mengambil gerai dari sesi dan RLS. Prototipe `renderTenantPortalDashboard` mematok tenant 10. Di `/admin/laporan`, terapkan filter kampus, tenant, dan periode 3/6/12 bulan atau semua. Gunakan satu perhitungan SQL untuk jumlah ulasan, skor per aspek, komentar pelanggan, menu yang diulas, dan jam kirim (WIB). Hitung rerata dari aspek inti yang terisi pada ulasan tayang. Dashboard, portal, PDF berkop, dan XLSX memakai angka yang sama. Buat berkas di browser.

Untuk rilis, uji migrasi dari basis data lokal kosong, terapkan ke Supabase tujuan, pasang Worker Secrets, lalu deploy Worker dan aset lewat Wrangler. Di Supabase aktifkan **Confirm email** dan hook domain, daftarkan URL konfirmasi HTTPS aplikasi, lalu atur SMTP untuk pengiriman ke pelanggan umum. Gunakan origin rilis untuk QR. Jadwalkan backup basis data dan salinan foto terpisah. Supabase Free dapat menjeda proyek setelah seminggu tidak aktif. [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp) · [Backup](https://supabase.com/docs/guides/platform/backups) · [Paket Free](https://supabase.com/pricing)

- [ ] **Lulus** bila dua pemilik hanya dapat membaca laporan masing-masing lewat API dan basis data. Cocokkan layar, PDF, dan XLSX memakai ulasan di dalam dan di luar periode. Uji pemulihan backup dan alur daftar → konfirmasi email → survei → moderasi → laporan pada URL HTTPS rilis, termasuk dari ponsel. Pastikan tautan konfirmasi diterima di ketiga domain.

## Keputusan pengelola

- **Usulan uji.** Mulai dari status ulasan “Menunggu” dan satu kiriman baru per akun per tenant per menit. Untuk produksi, pengelola menetapkan status awal dan interval kirim.
- **Kontrak dan UI.** Ambang rekomendasi kontrak di HTML masih contoh. Tampilkan “Kriteria belum ditetapkan” sampai pengelola memberi rumus. Usulkan email pemilik dan nomor MoU di blok **Akses Portal Pemilik**, serta pemilih foto dari form tenant di panel menu. Ketiga kontrol ini belum ada di formulir terkait. Sepakati posisinya bersama tim desain.
