import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emailPelangganValid } from '../web/auth/domain.js';
import { filterKatalog, statistik, tujuanSurvei } from '../web/publik/katalog.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const daftar = JSON.parse(read('web/publik/katalog-contoh.json'));
const filter = query => filterKatalog(daftar, new URLSearchParams(query));

test('pendaftaran menerima tepat tiga domain', () => {
  for (const e of ['aa@gmail.com', ' dosen@UNUSA.AC.ID ', 'nim+kantin@student.unusa.ac.id']) assert.ok(emailPelangganValid(e));
  for (const e of ['x@fakegmail.com', 'x@gmail.com.invalid', 'x@lab.unusa.ac.id', 'x@@gmail.com', '@gmail.com', 'x @gmail.com', 'x@yahoo.com']) assert.equal(emailPelangganValid(e), false, e);
});
test('filter menggabungkan kampus, kategori dan nama menu', () => {
  const hasil = filter('kampus=B&kategori=Makanan&q=soto');
  assert.deepEqual(hasil.map(t => t.slug), ['warung-cak-min']);
  assert.equal(filter('kampus=C&q=soto').length, 0);
  assert.equal(filter('kategori=Minuman&q=soto').length, 0);
  assert.deepEqual(filter('urut=name_asc').map(t => t.nama), daftar.map(t => t.nama).sort((a,b) => a.localeCompare(b, 'id')));
});
test('rata-rata dari lima aspek dan keadaan tanpa ulasan', () => {
  assert.equal(statistik([]).nilai, null);
  assert.deepEqual(statistik([{ aspek:[4,5,4,5,2] }, { aspek:[2,3,2,3,4] }]), { aspek:[3,4,3,4,3], jumlah:2, nilai:3.4 });
});
test('tujuan kembali hanya survei tenant yang dikenal', () => {
  assert.equal(tujuanSurvei('/tenant/warung-cak-min/survei', daftar)?.slug, 'warung-cak-min');
  for (const path of [null, '/admin', '//contoh.com', 'https://contoh.com/', '/tenant/asing/survei']) assert.equal(tujuanSurvei(path, daftar), undefined);
});
test('paket publik memuat aset yang ada dan kolom katalog yang diizinkan', () => {
  for (const t of daftar) {
    assert.deepEqual(Object.keys(t).sort(), ['slug','nama','kampus','deskripsi','foto','menu','ulasan'].sort());
    assert.match(t.slug, /^[a-z0-9-]+$/);
    for (const item of [t,...t.menu]) {
      assert.match(item.foto, /^\/assets\/[\w-]+\.jpg$/);
      assert.ok(readFileSync(new URL('../web' + item.foto, import.meta.url)).length);
    }
    for (const u of t.ulasan) {
      assert.deepEqual(Object.keys(u).sort(), ['aspek','komentar','status','waktu']);
      assert.match(u.waktu, /\+07:00$/);
      assert.ok(u.aspek.length === 5 && u.aspek.every(n => Number.isInteger(n) && n >= 1 && n <= 5));
    }
  }
});
test('formulir pratinjau dan router tidak memakai handler asli atau sandi operasional', () => {
  const html = read('web/index.html');
  assert.doesNotMatch(html, /\bStand\s+[A-Z]-\d+\b|reviewFormStallBadge|detailStall/i);
  assert.doesNotMatch(html, /\bon(?:click|submit|input|change)\s*=|quickPreviewRole|QR_UNUSA|data:image|owner_phone/i);
  const password = html.match(/<input\b[^>]*\btype="password"[^>]*>/g);
  assert.equal(password.length, 2);
  assert.ok(password.every(input => /\bdisabled\b/.test(input)));
  assert.match(read('web/_headers'), /form-action 'none'/);
});

test('template internal membawa 10 layar acuan tanpa data akun atau aksi prototipe', () => {
  const data = read('web/admin-ui/layar.html');
  assert.equal((data.match(/<template id="/g) || []).length, 11);
  assert.doesNotMatch(data, /\bon(?:click|submit|input|change)\s*=|qr_unusa|0812\d{5}|@student\.unusa|quickPreviewRole|Cak Solihin|<script/i);
});

test('kode stand contoh dapat dirujuk lewat slug di layar internal', async () => {
  const { kodeStand } = await import('../web/admin-ui/stand-contoh.js');
  assert.deepEqual(Object.keys(kodeStand).sort(), daftar.map(t => t.slug).sort());
  assert.equal(new Set(Object.values(kodeStand)).size, daftar.length);
  assert.equal(kodeStand['ayam-geprek-juara-unusa'], 'Stand A-02');
  assert.equal(kodeStand['warung-cak-min'], 'Stand B-01');
});
