import { detailUrl, skor } from './katalog.js';
import { api, navigasi, profilAktif, segarkanKatalog } from '../api.js';

const id = nama => document.getElementById(nama);
const form = id('publicReviewForm');
const penilaian = ['rasa', 'kebersihan', 'porsi', 'kualitas', 'cara_pembayaran'];
const label = ['Sangat kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
const kartuBintang = form.querySelector('.rating-unified-card');
const acuan = kartuBintang.cloneNode(true);
const tambahan = id('customSurveyQuestionsContainer');
const tombol = form.querySelector('button[type="submit"]');
const notice = id('reviewNotice');
const pilihanStatus = form.querySelector('[name="customer_type"]').closest('label').parentElement;
const statusAkun = document.createElement('p');
statusAkun.id = 'reviewStatusAkun';
statusAkun.className = 'status-note';
statusAkun.style.margin = '0';
statusAkun.hidden = true;
pilihanStatus.before(statusAkun);
let stand = null;
let ringkasan = null;
let pertanyaan = null;
let kiriman;

function pesan(teks) {
  notice.textContent = teks;
  notice.hidden = !teks;
}
function gambarPertanyaan(daftar) {
  kartuBintang.replaceChildren();
  tambahan.replaceChildren();
  if (!daftar) {
    kartuBintang.append(...acuan.cloneNode(true).children);
    return;
  }
  for (const q of daftar) {
    const key = 'rating_' + q.kunci;
    if (q.tipe === 'rating') {
      const group = acuan.firstElementChild.cloneNode(true);
      group.querySelector('.rating-label').textContent = q.label + (q.wajib ? ' *' : '');
      group.querySelector('.rating-desc').textContent = q.teks;
      for (const input of group.querySelectorAll('input')) {
        input.name = key;
        input.id = key + '_' + input.value;
        input.required = q.wajib;
        input.nextElementSibling.htmlFor = input.id;
      }
      kartuBintang.append(group);
      continue;
    }
    const group = document.createElement('div');
    group.className = 'status-note';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = key;
    label.textContent = q.teks + (q.wajib ? ' *' : '');
    const kontrol = document.createElement(q.tipe === 'text' ? 'textarea' : 'select');
    kontrol.className = 'form-control';
    kontrol.id = kontrol.name = key;
    kontrol.required = q.wajib;
    if (q.tipe === 'text') {
      kontrol.maxLength = 1000;
      kontrol.rows = 3;
    } else {
      kontrol.append(new Option('Pilih jawaban', ''), new Option('Ya', 'ya'), new Option('Tidak', 'tidak'));
    }
    group.append(label, kontrol);
    tambahan.append(group);
  }
}

export function bukaSurvei(t, daftar = null) {
  if (stand?.slug !== t.slug || daftar?.map(q => q.id).join() !== pertanyaan?.map(q => q.id).join() || !kiriman) {
    form.reset();
    gambarPertanyaan(daftar);
    kiriman = daftar ? crypto.randomUUID() : 'pratinjau';
    const tempat = id('reviewFormMenusCheckboxes');
    tempat.replaceChildren();
    for (const menu of t.menu) {
      const pembungkus = document.createElement('label');
      pembungkus.className = 'menu-chip';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'menu';
      input.value = menu.id || menu.nama;
      const teks = document.createElement('span');
      teks.textContent = menu.nama;
      pembungkus.append(input, teks);
      tempat.append(pembungkus);
    }
    if (!t.menu.length) tempat.textContent = 'Belum ada menu yang dapat dipilih.';
  }
  pertanyaan = daftar;
  stand = t;
  pilihanStatus.hidden = Boolean(daftar);
  statusAkun.hidden = !daftar;
  statusAkun.textContent = profilAktif?.status ?? 'Pengunjung';
  tombol.textContent = daftar ? 'Kirim ulasan' : 'Lihat ringkasan pratinjau';
  pesan(daftar ? '' : 'Simulasi survei. Isian hanya tampil di perangkat ini.');
  id('reviewFormCampusBadge').textContent = 'Kampus ' + t.kampus + ' UNUSA';
  id('reviewFormTenantName').textContent = t.nama;
  id('screen-public-review').querySelector('[data-detail-link]').href = detailUrl(t);
}

form.addEventListener('change', event => {
  const input = event.target;
  if (input.type !== 'radio' || !input.closest('.rating-group')) return;
  input.closest('.rating-group').querySelector('.rating-feedback').textContent = input.value + ' / 5 · ' + label[Number(input.value) - 1];
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!stand || tombol.disabled || !form.reportValidity()) return;
  const values = new FormData(form);
  const tenant = stand;
  const tujuan = detailUrl(tenant) + '/ringkasan';
  if (!pertanyaan) {
    const nilai = penilaian.map(key => Number(values.get('rating_' + key)));
    ringkasan = { slug: tenant.slug, nilai: nilai.reduce((a, b) => a + b, 0) / nilai.length, pratinjau: true };
    navigasi('/pratinjau' + tujuan);
    return;
  }
  const jawaban = {};
  for (const q of pertanyaan) {
    const value = values.get('rating_' + q.kunci)?.trim();
    if (value) jawaban[q.id] = q.tipe === 'rating' ? Number(value) : q.tipe === 'boolean' ? value === 'ya' : value;
  }
  tombol.disabled = true;
  tombol.textContent = 'Mengirim ulasan…';
  pesan('');
  try {
    const hasil = await api(detailUrl(tenant) + '/ulasan', { method: 'POST', data: {
      kiriman, jawaban, menu: values.getAll('menu'), komentar: values.get('comment')
    } });
    ringkasan = { slug: tenant.slug, nilai: hasil.nilai, pratinjau: false };
    kiriman = null;
    navigasi(tujuan);
    segarkanKatalog();
  } catch (error) {
    pesan(error.message);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Kirim ulasan';
  }
});

export function hasilSurvei(t, pratinjau) {
  if (ringkasan?.slug !== t.slug || ringkasan.pratinjau !== pratinjau) return false;
  id('reviewSuccessMessage').textContent = pratinjau ? 'Simulasi untuk' : 'Ulasan Anda terkirim untuk';
  id('reviewSuccessTenantName').textContent = t.nama;
  id('reviewSuccessScore').textContent = ringkasan.nilai == null ? '—' : skor(ringkasan.nilai);
  id('reviewSuccessStars').textContent = ringkasan.nilai == null ? '' : '★'.repeat(Math.round(ringkasan.nilai));
  id('screen-public-review-success').querySelector('h1').textContent = pratinjau ? 'Ringkasan Simulasi' : 'Ulasan terkirim';
  id('reviewSuccessBackTenantBtn').textContent = 'Lihat ' + t.nama;
  id('screen-public-review-success').querySelector('[data-detail-link]').href = detailUrl(t);
  return true;
}
