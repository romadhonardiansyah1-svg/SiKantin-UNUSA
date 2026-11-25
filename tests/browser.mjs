import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const origin = process.env.SIKANTIN_TEST_URL || 'http://127.0.0.1:8787';
const bukti = new URL('../.verifikasi/', import.meta.url);
await mkdir(bukti, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let jumlah = 0;
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 768, isMobile: width === 390, reducedMotion: 'reduce' });
    const errors = [];
    const writes = [];
    page.on('pageerror', err => errors.push(err.message));
    const dataStand = [];
    page.on('request', req => {
      if (!['GET','HEAD'].includes(req.method())) writes.push(req.method());
      if (new URL(req.url()).pathname === '/admin-ui/stand-contoh.js') dataStand.push(req.url());
    });
    const kode = /\b[A-C]-\d{2}\b/;
    await page.goto(origin);
    const tenant = page.locator('.gf-card');
    await tenant.first().waitFor();
    assert.equal(await tenant.count(), 17);
    assert.doesNotMatch(await page.locator('#tenantGrid').innerText(), kode);
    assert.equal(await tenant.first().locator('.gf-pay-label').innerText(), 'Tunai & QRIS');
    const columns = await page.locator('#tenantGrid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width === 1440 ? 2 : 1);
    await page.evaluate(() => document.fonts.ready);
    await tenant.first().locator('.gf-thumb-wrap img').evaluate(img => img.decode());
    assert.ok(await page.evaluate(() => document.fonts.check('16px "Plus Jakarta Sans"')));
    await page.screenshot({ path: fileURLToPath(new URL('katalog-' + width + '.png', bukti)) });
    if (width === 1440) await tenant.nth(1).screenshot({ path: fileURLToPath(new URL('kartu-ayam-geprek.png', bukti)) });
    const menu = page.getByRole('button', { name: 'Buka Menu Navigasi' });
    assert.equal(await menu.isVisible(), width <= 768);
    if (width <= 768) {
      await menu.click();
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.ok(await menu.evaluate(e => e === document.activeElement));
    }
    await page.locator('[data-campus="KAMPUS_B"].campus-pill').click();
    await page.locator('#searchTenantInput').fill('soto');
    assert.equal(await tenant.count(), 1);
    await tenant.getByRole('link', { name: 'Warung Cak Min', exact: true }).click();
    await page.locator('#detailTenantName').waitFor();
    await page.reload();
    await page.locator('#detailTenantName').waitFor();
    assert.equal(await page.locator('#detailTenantName').textContent(), 'Warung Cak Min');
    assert.doesNotMatch(await page.locator('#screen-public-tenant-detail').innerText(), kode);
    const namaGerak = () => page.locator('.detail-caption-below').evaluate(e => getComputedStyle(e).animationName);
    assert.equal(await namaGerak(), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await namaGerak(), 'buka-rincian');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('button', {name: 'Minuman', exact:true}).click();
    assert.equal(await page.locator('#detailMenuGrid article').count(), 2);
    await page.goBack();
    assert.equal(await page.locator('#searchTenantInput').inputValue(), 'soto');
    assert.match(page.url(), /kampus=B/);
    await page.locator('#searchTenantInput').fill('tidak-ada-stand');
    await page.locator('#resetFilter').click();
    assert.equal(await tenant.count(), 17);
    await page.goto(origin + '/tenant/warung-cak-min/survei');
    await page.getByRole('link', {name:'Daftar sekarang'}).click();
    await page.locator('#authRegEmail').fill('contoh@lab.unusa.ac.id');
    assert.equal(await page.locator('#authRegEmail').getAttribute('aria-invalid'), 'true');
    await page.locator('#authRegEmail').fill('contoh@student.unusa.ac.id');
    assert.equal(await page.locator('#authRegEmail').getAttribute('aria-invalid'), 'false');
    assert.ok(await page.locator('#authRegPassword').isDisabled());
    await page.getByRole('link', {name:'Coba formulir survei'}).click();
    assert.doesNotMatch(await page.locator('#screen-public-review').innerText(), kode);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    for (const key of ['rasa','kebersihan','porsi','kualitas','cara_pembayaran']) {
      await page.locator('label[for="rating_' + key + '_4"]').click();
    }
    await page.getByRole('button', {name:'Lihat ringkasan pratinjau'}).click();
    await page.locator('#screen-public-review-success').waitFor();
    assert.equal(await page.locator('#reviewSuccessScore').textContent(), '4,0');
    assert.doesNotMatch(await page.locator('#screen-public-review-success').innerText(), kode);
    assert.equal(dataStand.length, 0);
    await page.goto(origin + '/pratinjau/admin/tenant/baru');
    await page.locator('#tenant_form_name').waitFor();
    assert.ok(await page.locator('#tenant_form_name').isDisabled());
    for (const path of ['/pratinjau/admin','/pratinjau/admin/kampus','/pratinjau/admin/tenant','/pratinjau/admin/menu','/pratinjau/admin/pertanyaan','/pratinjau/admin/ulasan','/pratinjau/admin/laporan','/pratinjau/admin/qr','/pratinjau/pemilik']) {
      await page.goto(origin + path);
      await page.locator('#screen-internal h1').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + ' meluap pada ' + width);
      if (path === '/pratinjau/admin/tenant') {
        await page.locator('#adminTenantsSearch').fill('A-02');
        assert.equal(await page.locator('#adminTenantsTableBody tr').count(), 1);
        assert.match(await page.locator('#adminTenantsTableBody').innerText(), /Stand A-02.*Ayam Geprek/);
      }
      if (path === '/pratinjau/pemilik') {
        const teksPortal = await page.locator('#screen-tenant-dashboard').innerText();
        assert.deepEqual(teksPortal.match(/\b[A-C]-\d{2}\b/g), ['B-01']);
      }
      if (path === '/pratinjau/admin/menu') {
        await page.locator('#adminMenusFilterCategory').selectOption('minuman');
        const rows = page.locator('#adminMenusTableBody tr');
        assert.ok(await rows.count() > 0);
        assert.ok((await rows.allTextContents()).every(s => s.includes('Minuman')));
        await page.locator('[data-drawer="open"]').click();
        assert.equal(await page.locator('#drawer-admin-menus').evaluate(e => e.inert), false);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#drawer-admin-menus').evaluate(e => e.inert), true);
      }
      if (path === '/pratinjau/admin/laporan') {
        await page.locator('#reportFilterTenant').selectOption('warung-cak-min');
        assert.equal(await page.locator('#evaluationReportTableBody tr').count(), 1);
        assert.equal(await page.locator('#reportKpiReviews').textContent(), '6');
      }
      if (path === '/pratinjau/admin' && width === 1440) {
        await page.screenshot({ path: fileURLToPath(new URL('dasbor-pengelola.png', bukti)) });
      }
    }
    await page.goto(origin + '/admin');
    await page.locator('#authLoginIdentifier').waitFor();
    assert.equal(new URL(page.url()).pathname, '/masuk');
    await page.goto(origin + '/tenant/stand-tidak-ada');
    await page.getByRole('heading', {name:'Halaman tidak ditemukan'}).waitFor();
    await page.goto(origin + '/');
    await tenant.first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(`${width}px · ${columns} kolom · katalog, riwayat, akun, survei, 10 layar internal lulus`);
    jumlah++;
    await page.close();
  }
} finally { await browser.close(); }
assert.equal(jumlah, 3);
