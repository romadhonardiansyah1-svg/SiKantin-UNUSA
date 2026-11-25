import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LABEL_KOSONG,
  formatSkor,
  hitungStatistikRating,
  ringkasanRatingTenant
} from '../../web/laporan/rating.js';
import {
  bangunLaporanRating,
  responsLaporanJson
} from '../../worker/laporan/rating.js';

const bacaJson = path =>
  JSON.parse(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'));

test('tenant tanpa ulasan menampilkan "Belum ada penilaian"', () => {
  const hasil = hitungStatistikRating([]);
  assert.equal(hasil.nilai, null);
  assert.equal(hasil.label, 'Belum ada penilaian');
  assert.equal(formatSkor(hasil.nilai), LABEL_KOSONG);
  assert.equal(hasil.jumlah, 0);
  assert.deepEqual(hasil.aspek, [null, null, null, null, null]);
});

test('tenant dengan satu ulasan tayang menghitung rerata aspek inti dengan benar', () => {
  const ulasan = [
    {
      status_moderasi: 'tayang',
      aspek: [5, 4, 5, 4, 5],
      waktu: '2026-11-25T11:30:00+07:00'
    }
  ];
  const hasil = hitungStatistikRating(ulasan);
  assert.equal(hasil.jumlah, 1);
  assert.equal(hasil.tersembunyi, 0);
  assert.equal(hasil.nilai, 4.6);
  assert.equal(hasil.label, '4,6');
  assert.deepEqual(hasil.aspek, [5, 4, 5, 4, 5]);
  assert.equal(hasil.distribusi_jam_wib[11], 1);
});

test('tenant dengan satu ulasan tersembunyi tidak dihitung dan menampilkan "Belum ada penilaian"', () => {
  const ulasan = [
    {
      status_moderasi: 'tersembunyi',
      aspek: [1, 1, 1, 1, 1],
      waktu: '2026-11-25T12:00:00+07:00'
    }
  ];
  const hasil = hitungStatistikRating(ulasan);
  assert.equal(hasil.jumlah, 0);
  assert.equal(hasil.total_ulasan, 1);
  assert.equal(hasil.tersembunyi, 1);
  assert.equal(hasil.nilai, null);
  assert.equal(hasil.label, 'Belum ada penilaian');
  assert.deepEqual(hasil.aspek, [null, null, null, null, null]);
  assert.ok(hasil.distribusi_jam_wib.every(n => n === 0));
});

test('ulasan tersembunyi, menunggu, dan spam tidak mengubah hasil ulasan tayang', () => {
  const dasar = [
    {
      status_moderasi: 'tayang',
      aspek: [5, 4, 5, 4, 5],
      waktu: '2026-11-25T10:15:00+07:00'
    }
  ];
  const denganModerasiLain = [
    ...dasar,
    {
      status_moderasi: 'tersembunyi',
      aspek: [1, 1, 1, 1, 1],
      waktu: '2026-11-25T13:45:00+07:00'
    },
    {
      status_moderasi: 'menunggu',
      aspek: [2, 2, 2, 2, 2],
      waktu: '2026-11-25T14:00:00+07:00'
    },
    {
      tayang: false,
      aspek: [1, 2, 1, 2, 1],
      waktu: '2026-11-25T15:00:00+07:00'
    }
  ];

  const hasilDasar = hitungStatistikRating(dasar);
  const hasilCampuran = hitungStatistikRating(denganModerasiLain);

  assert.equal(hasilCampuran.nilai, hasilDasar.nilai);
  assert.equal(hasilCampuran.label, hasilDasar.label);
  assert.equal(hasilCampuran.jumlah, hasilDasar.jumlah);
  assert.deepEqual(hasilCampuran.aspek, hasilDasar.aspek);
  assert.deepEqual(hasilCampuran.distribusi_jam_wib, hasilDasar.distribusi_jam_wib);
  assert.equal(hasilCampuran.tersembunyi, 3);
});

test('perhitungan hanya merata-ratakan aspek inti yang terisi pada ulasan tayang', () => {
  const hasil = hitungStatistikRating([
    {
      status_moderasi: 'tayang',
      aspek_inti: {
        rasa: 5,
        kebersihan: 4,
        porsi: null,
        kualitas: 5,
        cara_pembayaran: null
      }
    },
    {
      status_moderasi: 'tayang',
      aspek_inti: {
        rasa: 3,
        kebersihan: 4,
        porsi: 4,
        kualitas: 3,
        cara_pembayaran: 2
      }
    }
  ]);

  // Total skor terisi = (5+4+5) + (3+4+4+3+2) = 30 dari 8 aspek terisi => 3.75
  assert.equal(hasil.jumlah, 2);
  assert.equal(hasil.nilai, 3.75);
  assert.equal(hasil.label, '3,8');
  assert.deepEqual(hasil.aspek, [4, 4, 4, 4, 2]);
});

test('contoh hasil untuk Agen 2 cocok dengan perhitungan rating', () => {
  const contoh = bacaJson('web/laporan/contoh-rating-agen2.json');
  for (const item of contoh.kasus_uji) {
    const aktual = ringkasanRatingTenant(item.tenant);
    assert.equal(aktual.nilai, item.hasil_harapan.nilai, item.kasus);
    assert.equal(aktual.label, item.hasil_harapan.label, item.kasus);
    assert.equal(aktual.jumlah, item.hasil_harapan.jumlah, item.kasus);
    assert.deepEqual(aktual.aspek, item.hasil_harapan.aspek, item.kasus);
  }
});

test('worker laporan memakai angka yang sama dan header cache-control no-store', async () => {
  const contoh = bacaJson('web/laporan/contoh-rating-agen2.json');
  const daftarTenant = contoh.kasus_uji.map(k => k.tenant);
  const laporan = bangunLaporanRating(daftarTenant);

  assert.equal(laporan.tenant.length, 4);
  assert.equal(laporan.agregat.jumlah, 2);
  assert.equal(laporan.agregat.tersembunyi, 2);
  assert.equal(laporan.agregat.nilai, 4.6);

  const res = responsLaporanJson(laporan);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.agregat.label, '4,6');
});
