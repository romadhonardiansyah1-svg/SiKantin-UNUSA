import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BATAS_FOTO_BYTE,
  buatSlugTenant,
  filterDaftarTenant,
  formatTanggalIndo,
  validasiFotoTenant,
  validasiTenant
} from '../web/admin/validasi.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('buatSlugTenant menormalisasi nama tenant menjadi slug URL aman', () => {
  assert.equal(buatSlugTenant('Warung Cak Min! (Cabang B)'), 'warung-cak-min-cabang-b');
  assert.equal(buatSlugTenant('  Soto & Rawon — Bu Siti  '), 'soto-rawon-bu-siti');
  assert.equal(buatSlugTenant('---'), '');
});

test('validasiTenant menerima data valid dan menolak isian tidak sah', () => {
  const ok = validasiTenant({
    campus_id: '2',
    stall_number: 'Stand B-09',
    name: 'Warung Barokah',
    owner_name: 'Ibu Aminah',
    phone: '0812-3456-7890',
    description: 'Aneka penyetan dan sayur segar.',
    contract_start: '2026-01-01',
    contract_end: '2026-12-31',
    contract_status: 'aktif',
    is_active: true,
    username: 'warung.barokah',
    password: 'Password123'
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.data.slug, 'warung-barokah');

  const gagal = validasiTenant({
    campus_id: '99',
    stall_number: 'A',
    name: '!',
    owner_name: '',
    phone: '12345',
    contract_start: '2026-12-31',
    contract_end: '2026-01-01',
    contract_status: 'asal',
    username: 'A B',
    password: '123'
  });
  assert.equal(gagal.valid, false);
  assert.ok(gagal.errors.campus_id);
  assert.ok(gagal.errors.stall_number);
  assert.ok(gagal.errors.name);
  assert.ok(gagal.errors.owner_name);
  assert.ok(gagal.errors.phone);
  assert.ok(gagal.errors.contract_end);
  assert.ok(gagal.errors.contract_status);
  assert.ok(gagal.errors.username);
  assert.ok(gagal.errors.password);
});

test('validasiTenant pada mode ubah mengizinkan sandi kosong jika username tidak berubah', () => {
  const editOk = validasiTenant(
    {
      campus_id: '1',
      stall_number: 'Stand A-01',
      name: 'Warung Nasi Bu Siti',
      owner_name: 'Bu Siti',
      contract_status: 'aktif',
      is_active: true,
      username: 'busiti',
      password: ''
    },
    { isEdit: true, previousUsername: 'busiti' }
  );
  assert.equal(editOk.valid, true);

  const editNewUserNoPass = validasiTenant(
    {
      campus_id: '1',
      stall_number: 'Stand A-01',
      name: 'Warung Nasi Bu Siti',
      owner_name: 'Bu Siti',
      contract_status: 'aktif',
      is_active: true,
      username: 'busiti_baru',
      password: ''
    },
    { isEdit: true, previousUsername: 'busiti' }
  );
  assert.equal(editNewUserNoPass.valid, false);
  assert.ok(editNewUserNoPass.errors.password);
});

test('validasiFotoTenant membatasi tipe JPG/PNG/WebP dan ukuran maksimal 2 MB', () => {
  assert.equal(validasiFotoTenant(null), '');
  assert.equal(validasiFotoTenant({ type: 'image/jpeg', size: 1024 }), '');
  assert.equal(validasiFotoTenant({ type: 'image/png', size: BATAS_FOTO_BYTE }), '');
  assert.equal(validasiFotoTenant({ type: 'image/webp', size: 500_000 }), '');
  assert.notEqual(validasiFotoTenant({ type: 'image/svg+xml', size: 1000 }), '');
  assert.notEqual(validasiFotoTenant({ type: 'image/png', size: BATAS_FOTO_BYTE + 1 }), '');
});

test('filterDaftarTenant menyaring berdasarkan kampus dan kata kunci nama, stand, atau pemilik', () => {
  const sample = [
    { campus_id: '1', name: 'Warung Nasi Bu Siti', stall_number: 'Stand A-01', owner_name: 'Ibu Siti', slug: 'warung-nasi-bu-siti' },
    { campus_id: '2', name: 'Warung Cak Min', stall_number: 'Stand B-01', owner_name: 'Cak Min', slug: 'warung-cak-min' }
  ];
  assert.equal(filterDaftarTenant(sample, { campusId: '2' }).length, 1);
  assert.equal(filterDaftarTenant(sample, { query: 'B-01' }).length, 1);
  assert.equal(filterDaftarTenant(sample, { query: 'Ibu Siti' }).length, 1);
  assert.equal(filterDaftarTenant(sample, { campusId: '3', query: 'soto' }).length, 0);
  assert.equal(formatTanggalIndo('2026-12-31').includes('2026'), true);
});

test('modul admin mematuhi CSP dan endpoint menolak akses selain pengelola', () => {
  const html = read('web/admin/index.html');
  assert.match(html, /<html lang="id">/);
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)|\bon(?:click|submit|input|change)\s*=/i);

  const worker = read('worker/admin/tenants.ts');
  assert.match(worker, /session\.role !== 'admin'/);
  assert.match(worker, /403/);
  assert.match(worker, /'Cache-Control': 'no-store'/);
});
