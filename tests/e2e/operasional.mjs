import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { strFromU8, unzipSync } from 'fflate';

const origin = 'http://127.0.0.1:8787';
const idKampus = '10000000-0000-0000-0000-000000000001';
const db = 'supabase_db_sikantin-unusa';
const hasil = new URL('../../.verifikasi/operasional/', import.meta.url);
const waktu = Date.now().toString(36);
const sandi = 'UjiSiKantin-' + randomUUID();
const namaTenant = 'Dapur Uji ' + waktu;
const slug = 'dapur-uji-' + waktu;
const email = (nama, domain = 'gmail.com') => nama + '.' + waktu + '@' + domain;
const url = path => origin + path;
assert.equal((await (await fetch(url('/api/status'))).json()).operasional, true, 'Jalankan Worker lokal dengan Supabase.');
await mkdir(hasil, { recursive: true });

const authStatus = execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc',
  "select count(*) from supabase_migrations.schema_migrations"], { encoding: 'utf8' });
assert.equal(Number(authStatus.trim()), 11);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function http(ctx, path, status = 200, method = 'GET', data) {
  const res = await ctx.request.fetch(path.startsWith('http') ? path : url(path), {
    method, data, headers: { Origin: origin }, maxRedirects: 0
  });
  assert.equal(res.status(),status, method + ' ' + path.replace(/\/r\/[0-9a-f]+/, '/r/[kode]'));
  if (!res.headers()['content-type']?.includes('application/json')) return res;
  return res.json();
}
async function masuk(page, identitas, peran) {
  await page.goto(url('/masuk?akses=internal'));
  await page.locator('#authLoginIdentifier').fill(identitas);
  await page.locator('#authLoginPassword').fill(sandi, { timeout: 5000 });
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.waitForURL(url(peran));
  await page.locator('#screen-internal:not([hidden])').waitFor();
}
async function hapusBaris(page, baris) {
  await baris.getByRole('button', { name: 'Hapus', exact: true }).click();
  const konfirmasi = page.getByRole('dialog', { name: /^Hapus/ });
  await konfirmasi.getByRole('button', { name: 'Hapus sekarang' }).click();
  await baris.waitFor({ state: 'detached' });
}
async function tautanKonfirmasi(alamat) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch('http://127.0.0.1:54324/api/v1/messages');
    assert.ok(r.ok, 'SMTP lokal dapat diakses.');
    const { messages = [] } = await r.json();
    const surat = messages.find(m => m.To.some(t => t.Address === alamat));
    if (surat) {
      const res = await fetch('http://127.0.0.1:54324/api/v1/message/' + surat.ID);
      const { HTML } = await res.json();
      const link = HTML.match(/href="([^"]*\/konfirmasi[^"]*)"/)?.[1].replaceAll('&amp;','&');
      assert.ok(link && new URL(link).origin === origin && new URL(link).hash.startsWith('#token_hash='),
        'Token konfirmasi berada di fragmen tautan email.');
      return link;
    }
    await new Promise(resolve => setTimeout(resolve,250));
  }
  assert.fail('Email konfirmasi tidak muncul di SMTP lokal.');
}

try {
  const anonim = await browser.newContext();
  assert.match((await fetch(url('/admin/operasional.js'))).headers.get('content-type'), /javascript/);
  const daftarAwal = await http(anonim,'/api/katalog');
  assert.ok(daftarAwal.tenant.every(t => t.slug !== 'tenant-contoh-nonaktif' && !('kode_stand' in t)));
  const slideAwal = await http(anonim, '/api/slide');
  assert.ok(Array.isArray(slideAwal));
  await http(anonim,'/api/admin/tenant',401);
  await http(anonim, '/api/admin/slide', 401, 'POST', {});
  await http(anonim,'/api/laporan',401);
  await http(anonim,'/api/tidak-ada',404);
  const spoof = await anonim.request.post(url('/api/auth/masuk'), { headers: { Origin: 'https://example.invalid' }, data: {} });
  assert.equal(spoof.status(),403);

  const emailAdmin = email('pengelola');
  await http(anonim,'/api/auth/daftar',201,'POST',{ nama: 'Pengelola Uji', email: emailAdmin, sandi, status: 'Dosen' });
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await adminPage.goto(await tautanKonfirmasi(emailAdmin));
  await adminPage.getByRole('button',{name:'Konfirmasi email',exact:true}).click();
  await adminPage.waitForURL(url('/masuk?konfirmasi=berhasil'));
  await http(adminPage.context(), '/api/auth/sesi', 401);
  execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
    "insert into sikantin_private.profil(id, peran, username) select id, 'admin', 'admin_" + waktu +
    "' from auth.users where email = '" + emailAdmin + "' and email_confirmed_at is not null"], { stdio: 'pipe' });
  const admin = adminPage.context();
  await http(admin,'/api/auth/keluar',200,'POST');
  await masuk(adminPage,'admin_' + waktu,'/admin');
  const album = adminPage.locator('#adminSlideBeranda');
  const bukaAlbum = () => album.getByText('Gambar slide beranda', { exact: true }).click();
  await bukaAlbum();
  await album.getByLabel('Nomor slide').selectOption('2');
  const altSlide = 'Hidangan pameran ' + waktu;
  await album.getByLabel('Deskripsi gambar').fill(altSlide);
  const berkasSlide = album.getByLabel('Gambar baru');
  const simpanSlide = album.getByRole('button', { name: 'Simpan gambar' });
  await berkasSlide.setInputFiles({ name: 'bukan-gambar.png', mimeType: 'image/png', buffer: Buffer.from('bukan PNG') });
  await simpanSlide.click();
  await album.getByText('Foto harus berformat JPG, PNG, atau WebP.').waitFor();
  assert.deepEqual(await http(anonim, '/api/slide'), slideAwal);
  await berkasSlide.setInputFiles(fileURLToPath(new URL('../../web/assets/geprek-bakso.jpg', import.meta.url)));
  await simpanSlide.click();
  await album.getByText('Gambar slide 2 tersimpan.').waitFor();
  const slideBaru = await http(anonim, '/api/slide');
  const slideKedua = slideBaru.find(slide => slide.posisi === 2);
  assert.equal(slideKedua.alt, altSlide);
  assert.deepEqual(slideBaru.filter(slide => slide.posisi !== 2), slideAwal.filter(slide => slide.posisi !== 2));
  assert.equal((await fetch(url(slideKedua.foto))).headers.get('content-type'), 'image/jpeg');
  await adminPage.reload();
  await bukaAlbum();
  await album.getByLabel('Nomor slide').selectOption('2');
  assert.equal(await album.getByLabel('Deskripsi gambar').inputValue(), altSlide);
  const beranda = await browser.newPage({ viewport: { width: 390, height: 860 }, reducedMotion: 'reduce' });
  await beranda.goto(url('/'));
  await beranda.getByRole('img', { name: altSlide }).waitFor();
  const slideTampil = beranda.locator('#heroPosterTrack img').nth(1);
  await slideTampil.evaluate(img => img.decode());
  assert.equal(await slideTampil.getAttribute('alt'), altSlide);
  assert.equal(await slideTampil.getAttribute('src'), slideKedua.foto);
  await beranda.close();
  console.log('Slide beranda · format ditolak, perubahan tersimpan, dan foto baru tampil di ponsel.');
  let lanjutKampus;
  const tungguKampus = new Promise(resolve => { lanjutKampus = resolve; });
  const polaKampus = '**/api/admin/kampus';
  await adminPage.route(polaKampus, async route => {
    await tungguKampus;
    await route.continue();
  });
  try {
    const diminta = adminPage.waitForRequest(polaKampus);
    await adminPage.goto(url('/admin/kampus'), { waitUntil: 'commit' });
    await diminta;
    const kerangka = adminPage.locator('#kerangkaMuat');
    await kerangka.getByText('Memuat dasbor…', { exact: true }).waitFor({ timeout: 5000 });
    await kerangka.screenshot({ path: fileURLToPath(new URL('skeleton-pengelola-1440.png', hasil)) });
    await adminPage.getByRole('link', { name: 'Katalog Kantin', exact: true }).click();
    await adminPage.locator('#tenantGrid .gf-card').first().waitFor();
    assert.ok(await kerangka.isHidden());
  } finally {
    lanjutKampus();
    await adminPage.unrouteAll({ behavior: 'wait' });
  }
  await adminPage.goto(url('/admin/kampus'));
  await adminPage.getByRole('button',{name:/Tambah Kampus Baru/}).click();
  const kodeKampus = 'U' + waktu.toUpperCase();
  await adminPage.locator('#campus_code').fill(kodeKampus);
  await adminPage.locator('#campus_name').fill('Kampus Uji ' + waktu);
  await adminPage.locator('#campus_address').fill('Alamat uji');
  await adminPage.locator('#campus_total_stalls').fill('6');
  await adminPage.locator('#campus_facility_info').fill('Ruang makan uji');
  await adminPage.locator('#campusFormSubmitBtn').click();
  const barisKampus = adminPage.getByRole('row').filter({ hasText: kodeKampus });
  await barisKampus.getByRole('button',{name:'Ubah'}).click();
  await adminPage.locator('#campus_facility_info').fill('Fasilitas diperbarui');
  await adminPage.locator('#campusFormSubmitBtn').click();
  await barisKampus.getByText('Fasilitas diperbarui').waitFor();
  await barisKampus.getByRole('button', { name: 'Arsipkan' }).click();
  await adminPage.getByText('Data diarsipkan.', { exact: true }).waitFor();
  await barisKampus.waitFor({ state: 'detached' });
  await adminPage.getByLabel('Status data').selectOption('arsip');
  await barisKampus.getByRole('button', { name: 'Aktifkan' }).click();
  await barisKampus.waitFor({ state: 'detached' });
  await adminPage.getByLabel('Status data').selectOption('aktif');
  await barisKampus.waitFor();
  const kampusUji = (await http(admin, '/api/admin/kampus')).find(k => k.kode === kodeKampus);
  const tamu = await Promise.all(['Satu', 'Dua'].map(nama => http(admin, '/api/admin/tenant', 201, 'POST', {
    kampus_id: kampusUji.id, nama: nama + ' ' + waktu, kode_stand: 'MANUAL-UJI'
  })));
  const standBaru = (await http(admin, '/api/admin/tenant')).filter(t => tamu.some(x => x.id === t.id));
  assert.equal(new Set(standBaru.map(t => t.kode_stand)).size, 2);
  assert.ok(standBaru.every(t => /^\d+$/.test(t.kode_stand)));
  assert.deepEqual((await http(admin, '/api/laporan?kampus=' + kampusUji.id)).per_tenant, []);
  await http(admin, '/api/admin/kampus/' + kampusUji.id, 409, 'DELETE');
  await adminPage.reload();
  await barisKampus.getByText('Pindahkan tenant sebelum menghapus kampus.').waitFor();
  assert.equal(await barisKampus.getByRole('button', { name: 'Hapus', exact: true }).count(), 0);
  const [sementara, contoh] = tamu;
  const menuUji = (tenant, nama) => http(admin, '/api/admin/menu', 201, 'POST', {
    tenant_id: tenant.id, nama, kategori: 'Makanan', harga: 1000
  });
  await menuUji(sementara, 'Menu tenant sementara');
  await menuUji(contoh, 'Menu contoh ' + waktu);
  execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
    "update public.tenant set data_uji = true where id = '" + contoh.id + "' and not aktif"], { stdio: 'pipe' });
  await http(admin, '/api/laporan?tenant=' + contoh.id, 404);
  assert.ok((await http(admin, '/api/admin/menu')).every(m => m.tenant_id !== contoh.id));
  await http(admin, '/api/admin/tenant/' + sementara.id, 200, 'PATCH', { aktif: true });
  const qrSementara = (await http(admin, '/api/admin/qr/' + sementara.id, 200, 'POST', { aksi: 'buat' })).url;
  await http(admin, '/api/admin/pemilik/' + sementara.id, 201, 'POST', {
    username: 'sementara_' + waktu, email: email('sementara'), sandi
  });
  await adminPage.goto(url('/admin/tenant'));
  const barisSementara = adminPage.getByRole('row').filter({ hasText: 'Satu ' + waktu });
  await barisSementara.waitFor();
  await adminPage.getByLabel('Status data').selectOption('semua');
  assert.equal(await adminPage.getByRole('row').filter({ hasText: 'Dua ' + waktu }).count(), 0);
  await hapusBaris(adminPage, barisSementara);
  await http(anonim, qrSementara, 404);
  await http(anonim, '/api/auth/masuk', 403, 'POST', { identitas: email('sementara'), sandi, internal: true });
  assert.ok((await http(admin, '/api/admin/menu')).every(m => m.tenant_id !== sementara.id));
  await adminPage.goto(url('/admin/kampus'));
  await hapusBaris(adminPage, barisKampus);
  assert.ok((await http(admin, '/api/admin/kampus')).every(k => k.id !== kampusUji.id));

  const pertanyaanBaru = {
    kunci: 'ruang_' + waktu, label: 'Akses ruang ' + waktu, teks: 'Apakah ruang mudah dijangkau?',
    tipe: 'boolean', urutan: 6, wajib: false, aktif: true
  };
  const pertanyaanId = (await http(admin,'/api/admin/pertanyaan',201,'POST',pertanyaanBaru)).id;
  const inti = (await http(admin, '/api/admin/pertanyaan')).find(q => q.kunci === 'rasa');
  await http(admin, '/api/admin/pertanyaan/' + inti.id, 409, 'DELETE');
  await http(admin, '/api/admin/pertanyaan/' + inti.id, 409, 'PATCH', { aktif: false });
  await http(admin, '/api/admin/pertanyaan/' + inti.id, 409, 'PUT', { ...inti, aktif: false });
  await adminPage.goto(url('/admin/tenant/baru'));
  await adminPage.locator('#tenant_form_campus_id').selectOption(idKampus);
  assert.ok(await adminPage.locator('#tenant_form_stall_number').evaluate(el => el.readOnly && !el.required));
  await adminPage.locator('#tenant_form_name').fill(namaTenant);
  await adminPage.locator('#tenant_form_owner_name').fill('Pemilik Uji Pertama');
  assert.equal(await adminPage.getByLabel('Nomor MoU (opsional)').inputValue(), '');
  await adminPage.getByLabel('Jam buka (WIB)').fill('08:00');
  await adminPage.getByLabel('Jam tutup (WIB)').fill('15:30');
  await adminPage.locator('#tenant_form_photo').setInputFiles(fileURLToPath(new URL('../../web/assets/logo-unusa.png', import.meta.url)));
  await adminPage.locator('#tenant_form_username').fill('pemilik_' + waktu);
  await adminPage.locator('#tenant_form_owner_email').fill(email('pemilik'));
  await adminPage.locator('#tenant_form_password').fill(sandi);
  const buatPemilik = adminPage.waitForResponse(r => r.url().includes('/api/admin/pemilik/') && r.request().method() === 'POST');
  await adminPage.locator('#tenantFormSubmitBtn').click();
  assert.equal((await buatPemilik).status(), 201);
  await adminPage.waitForURL(url('/admin/tenant'));
  const tenant = (await http(admin,'/api/admin/tenant')).find(t => t.slug === slug);
  assert.ok(tenant?.foto?.startsWith('/foto/'));
  assert.match(tenant.kode_stand, /^\d+$/);
  assert.equal(tenant.mou_nomor, null);
  assert.match(tenant.jam_buka, /^08:00/);
  assert.match(tenant.jam_tutup, /^15:30/);
  assert.equal((await fetch(url(tenant.foto))).headers.get('content-type'),'image/png');
  const row = adminPage.getByRole('row').filter({ hasText: namaTenant });
  await row.getByRole('link',{name:'Ubah'}).click();
  await adminPage.reload();
  await adminPage.locator('#tenant_form_mou').waitFor();
  assert.equal(await adminPage.getByLabel('Jam tutup (WIB)').inputValue(), '15:30');
  await adminPage.getByLabel('Jam tutup (WIB)').fill('16:00');
  assert.equal(await adminPage.locator('#tenant_form_stall_number').inputValue(), tenant.kode_stand);
  assert.equal(await adminPage.locator('#tenant_form_name').inputValue(),namaTenant);
  assert.equal(await adminPage.locator('#tenant_form_username').inputValue(),'pemilik_' + waktu);
  await adminPage.locator('#tenant_form_name').fill(namaTenant + ' Diperbarui');
  await adminPage.locator('#tenantFormSubmitBtn').click();
  await adminPage.waitForURL(url('/admin/tenant'));
  const diperbarui = (await http(admin,'/api/admin/tenant')).find(t => t.id === tenant.id);
  assert.equal(diperbarui.slug, slug);
  assert.equal(diperbarui.kode_stand, tenant.kode_stand);
  assert.match(diperbarui.jam_tutup, /^16:00/);
  await http(admin, '/api/admin/tenant', 422, 'POST', {
    kampus_id: idKampus, nama: 'Jam tidak lengkap ' + waktu, jam_buka: '07:00'
  });
  const kedua = await http(admin,'/api/admin/tenant',201,'POST',{
    kampus_id: idKampus, nama: 'Kedai Uji ' + waktu, aktif: true, mou_nomor: 'MOU-B-' + waktu
  });
  kedua.slug = 'kedai-uji-' + waktu;
  await http(admin,'/api/admin/pemilik/' + kedua.id,201,'POST',{ username: 'kedua_' + waktu, email: email('pemilik2'), sandi });
  const menu = await http(admin,'/api/admin/menu',201,'POST',{
    tenant_id: tenant.id, nama: 'Nasi Uji', kategori: 'Makanan', harga: 12000, tersedia: true
  });
  await http(admin,'/api/admin/menu/' + menu.id,200,'PUT',{
    tenant_id: tenant.id, nama: 'Nasi Uji', kategori: 'Makanan', harga: 12500, tersedia: true
  });
  await http(admin, '/api/admin/menu', 201, 'POST', {
    tenant_id: tenant.id, nama: 'Menu sementara ' + waktu, kategori: 'Makanan', harga: 1000
  });
  await adminPage.goto(url('/admin/menu'));
  await hapusBaris(adminPage, adminPage.getByRole('row').filter({ hasText: 'Menu sementara ' + waktu }));
  assert.equal((await http(anonim,'/api/katalog')).tenant.find(t => t.slug === slug).menu[0].harga,12500);
  await adminPage.goto(url('/admin/qr?tenant=' + tenant.id));
  await adminPage.getByRole('button',{name:'Buat QR',exact:true}).click();
  const qr = adminPage.locator('#qrPrintFallbackUrl');
  await adminPage.waitForFunction(() => document.getElementById('qrPrintFallbackUrl')?.textContent.startsWith('http'));
  const lama = await qr.textContent();
  const png = adminPage.waitForEvent('download');
  await adminPage.getByRole('button',{name:'Unduh PNG'}).click();
  await (await png).saveAs(fileURLToPath(new URL('qr.png',hasil)));
  adminPage.once('dialog', d => d.accept());
  await adminPage.getByRole('button',{name:'Ganti QR',exact:true}).click();
  await adminPage.waitForFunction(url => {
    const r = document.getElementById('qrPrintFallbackUrl')?.textContent;
    return r?.startsWith('http') && r !== url;
  },lama);
  const link = await qr.textContent();
  await http(anonim,lama,404);
  assert.equal((await http(anonim,link,302)).headers().location,'/tenant/' + slug + '/survei');
  console.log('Pengelola · data dan foto bertahan, ekspor PNG dan pergantian QR lulus.');

  const hp = await browser.newPage({ viewport: { width: 390, height: 860 }, isMobile: true, hasTouch: true });
  await hp.goto(link);
  await hp.waitForURL(/\/daftar\?kembali=/);
  await hp.locator('#authRegName').fill('Pelanggan Uji');
  await hp.locator('#authRegEmail').fill(email('pelanggan','student.unusa.ac.id'));
  await hp.locator('#authRegPassword').fill(sandi);
  await hp.locator('#authRegStatus').selectOption('Dosen');
  await hp.getByRole('button',{name:'Daftar Sekarang',exact:true}).click();
  await hp.getByText('Cek email Anda', { exact: false }).waitFor();
  const emailPelanggan = email('pelanggan','student.unusa.ac.id');
  const alias = emailPelanggan.split('@')[0];
  await hp.goto(await tautanKonfirmasi(emailPelanggan));
  await hp.getByRole('button',{name:'Konfirmasi email',exact:true}).waitFor();
  await hp.reload();
  await hp.getByRole('button',{name:'Konfirmasi email',exact:true}).click();
  await hp.waitForURL(url('/masuk?kembali=' + encodeURIComponent('/tenant/' + slug + '/survei') + '&konfirmasi=berhasil'));
  await hp.getByText('Email sudah terkonfirmasi. Masuk untuk melanjutkan.').waitFor();
  await http(hp.context(), '/api/auth/sesi', 401);
  await hp.locator('#authLoginIdentifier').fill(emailPelanggan);
  await hp.locator('#authLoginPassword').fill(sandi);
  await hp.getByRole('button', { name: 'Masuk', exact: true }).click();
  await hp.waitForURL(url('/tenant/' + slug + '/survei'));
  await hp.locator('#screen-public-review:not([hidden])').waitFor();
  assert.equal((await http(hp.context(), '/api/auth/sesi')).status, 'Dosen');
  assert.equal(await hp.locator('#reviewStatusAkun').textContent(), 'Dosen');
  assert.equal(await hp.locator('[name="customer_type"]:visible').count(), 0);
  for (const key of ['rasa','kebersihan','porsi','kualitas','cara_pembayaran']) {
    await hp.locator('label[for="rating_' + key + '_4"]').click();
  }
  await hp.getByLabel('Nasi Uji').check();
  await hp.locator('#rating_' + pertanyaanBaru.kunci).selectOption('ya');
  await hp.locator('#reviewCommentInput').fill('Masukan uji ' + waktu);
  const kirim = hp.waitForResponse(r => r.url().endsWith('/ulasan') && r.request().method() === 'POST');
  await hp.getByRole('button',{name:'Kirim ulasan',exact:true}).click();
  const tersimpan = await kirim;
  assert.equal(tersimpan.status(),201);
  const { id: idUlasan } = await tersimpan.json();
  await hp.getByRole('heading',{name:'Ulasan terkirim'}).waitFor();
  assert.equal(await hp.locator('#reviewSuccessScore').textContent(),'4,0');
  const sebelumModerasi = (await http(anonim,'/api/katalog')).tenant.find(t => t.slug === slug);
  assert.deepEqual(sebelumModerasi.statistik, { jumlah:1,nilai:4,aspek:[4,4,4,4,4] });
  assert.equal(sebelumModerasi.ulasan[0].komentar, 'Masukan uji ' + waktu);
  assert.equal(sebelumModerasi.ulasan[0].nama_pengulas, alias);
  assert.ok(!JSON.stringify(sebelumModerasi).includes(emailPelanggan));
  await hp.locator('#reviewSuccessBackTenantBtn').click();
  await hp.locator('#detailAvgScore').waitFor();
  await hp.locator('#detailReviewsList').getByText('Masukan uji ' + waktu).waitFor();
  await hp.locator('#detailReviewsList').getByText(alias, { exact: true }).waitFor();
  await hp.getByText('Jam buka 08.00–16.00 WIB', { exact: true }).waitFor();
  assert.equal(await hp.locator('#detailAvgScore').textContent(), '4,0');
  await http(hp.context(),'/api/laporan',403);
  const versi = await http(admin,'/api/admin/pertanyaan/' + pertanyaanId,200,'PUT',{
    ...pertanyaanBaru, label:'Versi baru', aktif:false
  });
  await http(admin, '/api/admin/pertanyaan/' + versi.id, 409, 'DELETE');
  await http(admin, '/api/admin/pertanyaan', 201, 'POST', {
    ...pertanyaanBaru, kunci: 'kosong_' + waktu
  });
  await adminPage.goto(url('/admin/pertanyaan'));
  await hapusBaris(adminPage, adminPage.getByRole('row').filter({ hasText: 'kosong_' + waktu }));
  assert.match((await http(admin, '/api/admin/menu/' + menu.id, 409, 'DELETE')).pesan, /Arsipkan/);
  await http(admin, '/api/admin/tenant/' + tenant.id, 409, 'DELETE');
  assert.equal((await http(admin, '/api/admin/tenant')).find(t => t.id === tenant.id).kode_stand, tenant.kode_stand);
  await adminPage.goto(url('/admin/ulasan'));
  const ulasan = adminPage.getByRole('row').filter({ hasText: 'Masukan uji ' + waktu });
  await ulasan.locator('summary').click();
  await ulasan.getByText(pertanyaanBaru.label + ' · Ya',{exact:true}).waitFor();
  await ulasan.getByRole('button',{name:'Sembunyikan',exact:true}).click();
  await ulasan.getByText('Disembunyikan',{exact:true}).waitFor();
  const tersembunyi = (await http(anonim,'/api/katalog')).tenant.find(t => t.slug === slug);
  assert.equal(tersembunyi.statistik.jumlah, 0);
  assert.deepEqual(tersembunyi.ulasan, []);
  await ulasan.getByRole('button',{name:'Tampilkan kembali',exact:true}).click();
  await ulasan.getByText('Tayang',{exact:true}).waitFor();
  const statistik = (await http(anonim,'/api/katalog')).tenant.find(t => t.slug === slug).statistik;
  assert.deepEqual(statistik,{ jumlah:1,nilai:4,aspek:[4,4,4,4,4] });
  await http(admin, '/api/admin/tenant/' + tenant.id, 200, 'PATCH', { aktif: false });
  const arsip = (await http(admin, '/api/laporan')).per_tenant.find(t => t.id === tenant.id);
  assert.equal(arsip.statistik.jumlah, 1);
  await http(admin, '/api/admin/tenant/' + tenant.id, 200, 'PATCH', { aktif: true });
  const pertanyaan = await http(hp.context(),'/api/pertanyaan');
  const payload = { kiriman: randomUUID(), responden: 'Pengunjung',
    jawaban: Object.fromEntries(pertanyaan.filter(q => q.tipe === 'rating').map(q => [q.id,3])), menu: [menu.id] };
  const path = '/api/tenant/' + kedua.slug + '/ulasan';
  await http(hp.context(),path,422,'POST',payload);
  const permintaan = [{ ...payload, menu: [] }, { ...payload, menu: [], kiriman: randomUUID() }];
  const paralel = await Promise.all(permintaan.map(data =>
    hp.context().request.post(url(path),{ headers:{ Origin:origin }, data })));
  assert.deepEqual(paralel.map(r => r.status()).sort(),[201,429]);
  const indexSukses = paralel.findIndex(r => r.status() === 201);
  const sukses = await paralel[indexSukses].json();
  assert.deepEqual(await http(hp.context(),path,201,'POST',permintaan[indexSukses]),sukses);
  const ulasanKedua = (await http(admin, '/api/admin/ulasan')).find(u => u.id === sukses.id);
  assert.equal(ulasanKedua.responden, 'Dosen');
  console.log('Pelanggan · status akun, rating langsung, moderasi komentar, dan batas kirim lulus.');

  const p1 = await browser.newPage({ viewport:{width:390,height:860}, isMobile:true });
  await masuk(p1,'pemilik_' + waktu,'/pemilik/laporan');
  assert.match(await p1.locator('#screen-tenant-dashboard h1').textContent(),new RegExp(namaTenant));
  assert.equal(await p1.locator('#screen-tenant-dashboard .badge-stall').textContent(),tenant.kode_stand);
  assert.equal(await p1.locator('#screen-tenant-dashboard .badge-campus').textContent(),'Kampus A UNUSA');
  assert.equal(await p1.locator('#tenantKpiReviews').textContent(),'1');
  await p1.getByText('Jam buka 08.00–16.00 WIB', { exact: true }).waitFor();
  await p1.locator('#tenantPortalReviewsList').getByText(alias, { exact: false }).waitFor();
  assert.ok(await p1.locator('#tenantAspectChart').isVisible());
  assert.ok(await p1.locator('#tenantPeakChart').isVisible());
  await p1.getByRole('link', { name: /Buka Katalog Publik/ }).click();
  await p1.waitForURL(url('/tenant/' + slug));
  await p1.goto(url('/pemilik/laporan'));
  await http(p1.context(), '/api/admin/slide', 403, 'POST', {});
  const p2 = await browser.newPage();
  await masuk(p2,'kedua_' + waktu,'/pemilik/laporan');
  assert.equal(await p2.locator('#tenantKpiReviews').textContent(),'1');
  await http(p1.context(),'/api/laporan?tenant=' + kedua.id,403);
  await http(p2.context(),'/api/laporan?tenant=' + tenant.id,403);
  await p2.locator('#screen-tenant-dashboard').getByRole('button', { name: 'Keluar', exact: true }).click();
  await p2.waitForURL(url('/'));
  await http(p2.context(), '/api/auth/sesi', 401);
  await http(p1.context(),'/api/admin/tenant',403);
  await http(p1.context(),'/api/admin/tenant/' + tenant.id,403,'PUT',{ nama:'Uji ditolak' });
  await http(p1.context(),'/api/admin/tenant/' + tenant.id,403,'DELETE');
  await p1.screenshot({ path: fileURLToPath(new URL('pemilik-390.png',hasil)) });
  await adminPage.goto(url('/admin/laporan?tenant=' + tenant.id));
  await adminPage.locator('#screen-internal:not([hidden])').waitFor();
  assert.equal(await adminPage.locator('#reportKpiAvg').textContent(),'4,0');
  const file = adminPage.waitForEvent('download');
  await adminPage.getByRole('button',{name:/Ekspor Excel/}).click();
  const xlsx = fileURLToPath(new URL('laporan.xlsx',hasil));
  await (await file).saveAs(xlsx);
  const sheet = strFromU8(unzipSync(await readFile(xlsx))['xl/worksheets/sheet1.xml']);
  assert.ok(sheet.includes(namaTenant) && sheet.includes('Masukan uji ' + waktu));
  assert.match(sheet, /<c r="B5"><v>4<\/v><\/c>/);
  await adminPage.pdf({ path:fileURLToPath(new URL('laporan.pdf',hasil)), printBackground:true, preferCSSPageSize:true });
  await adminPage.screenshot({ path: fileURLToPath(new URL('laporan-1440.png',hasil)) });
  assert.match(idUlasan, /^[a-f0-9-]{36}$/);
  execFileSync('docker', ['exec', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
    "update sikantin_private.ulasan set waktu = now() - interval '7 months' where id = '" + idUlasan + "'"], { stdio: 'pipe' });
  assert.equal((await http(admin,'/api/laporan?bulan=6&tenant=' + tenant.id)).statistik.jumlah,0);
  assert.equal((await http(admin,'/api/laporan?bulan=12&tenant=' + tenant.id)).statistik.jumlah,1);
  await http(admin, '/api/admin/ulasan/' + idUlasan, 200, 'PUT', { status: 'sembunyi' });
  assert.equal((await http(anonim, '/api/katalog')).tenant.find(t => t.slug === slug).statistik.nilai, null);
  await http(admin,'/api/admin/pemilik/' + tenant.id,200,'DELETE');
  await http(p1.context(),'/api/laporan',403);
  console.log('Laporan · dua pemilik terisolasi, filter periode, pencabutan akses, XLSX, dan cetak PDF lulus.');

  await hp.setViewportSize({ width: 1440, height: 900 });
  await hp.goto(url('/'));
  await hp.locator('#screen-public-index:not([hidden])').waitFor();
  assert.equal(hp.url(), url('/'));
  await hp.getByRole('button', { name: 'Keluar', exact: true }).waitFor();
  assert.equal(await hp.getByRole('link', { name: 'Masuk', exact: true }).count(), 0);
  assert.equal(await hp.getByRole('link', { name: 'Daftar Akun', exact: true }).count(), 0);
  await hp.setViewportSize({ width: 390, height: 860 });
  const menuPonsel = hp.getByRole('button', { name: 'Buka Menu Navigasi' });
  await menuPonsel.click();
  const drawer = hp.locator('#mobileNavDrawer');
  assert.equal(await drawer.getByRole('link', { name: 'Masuk / Daftar' }).count(), 0);
  await drawer.getByRole('button', { name: 'Keluar', exact: true }).click();
  await hp.waitForFunction(() => document.querySelector('.mobile-nav-toggle').getAttribute('aria-expanded') === 'false');
  await http(hp.context(), '/api/auth/sesi', 401);
  await menuPonsel.click();
  await drawer.getByRole('link', { name: 'Masuk / Daftar' }).waitFor();
  assert.equal(hp.url(), url('/'));
  console.log('Katalog · halaman awal dan navigasi pelanggan desktop serta ponsel lulus.');
} finally {
  await browser.close();
}
