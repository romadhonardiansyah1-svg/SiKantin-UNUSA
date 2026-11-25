import { detailUrl, skor } from './katalog.js';

const id = nama => document.getElementById(nama);
const form = id('publicReviewForm');
const penilaian = ['rasa', 'kebersihan', 'porsi', 'kualitas', 'cara_pembayaran'];
const label = ['Sangat kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
let stand = null;
let ringkasan = null;

export function bukaSurvei(t) {
  if (stand?.slug !== t.slug) {
    form.reset();
    for (const feedback of form.querySelectorAll('.rating-feedback')) feedback.textContent = 'Belum dipilih';
    const tempat = id('reviewFormMenusCheckboxes');
    tempat.replaceChildren();
    for (const menu of t.menu) {
      const pembungkus = document.createElement('label');
      pembungkus.className = 'menu-chip';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'menu';
      input.value = menu.nama;
      const teks = document.createElement('span');
      teks.textContent = menu.nama;
      pembungkus.append(input, teks);
      tempat.append(pembungkus);
    }
    if (!t.menu.length) tempat.textContent = 'Belum ada menu yang dapat dipilih.';
  }
  stand = t;
  id('reviewFormCampusBadge').textContent = 'Kampus ' + t.kampus + ' UNUSA';
  id('reviewFormTenantName').textContent = t.nama;
  id('screen-public-review').querySelector('[data-detail-link]').href = detailUrl(t);
}

form.addEventListener('change', event => {
  const input = event.target;
  if (!input.name.startsWith('rating_')) return;
  input.closest('.rating-group').querySelector('.rating-feedback').textContent = input.value + ' / 5 · ' + label[Number(input.value) - 1];
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!stand || !form.reportValidity()) return;
  const values = new FormData(form);
  const nilai = penilaian.map(key => Number(values.get('rating_' + key)));
  if (nilai.some(n => n < 1 || n > 5)) return;
  ringkasan = { slug: stand.slug, nilai: nilai.reduce((a, b) => a + b, 0) / nilai.length };
  const target = '/pratinjau' + detailUrl(stand) + '/ringkasan';
  document.dispatchEvent(new CustomEvent('navigasi', { detail: target }));
});

export function hasilSurvei(t) {
  if (ringkasan?.slug !== t.slug) return false;
  id('reviewSuccessTenantName').textContent = t.nama;
  id('reviewSuccessScore').textContent = skor(ringkasan.nilai);
  id('reviewSuccessStars').textContent = '★'.repeat(Math.round(ringkasan.nilai));
  id('reviewSuccessBackTenantBtn').textContent = 'Lihat ' + t.nama;
  id('screen-public-review-success').querySelector('[data-detail-link]').href = detailUrl(t);
  return true;
}
