const konten = document.getElementById('konten');
const kerangka = document.createElement('div');
kerangka.className = 'container muat-halaman';
kerangka.id = 'kerangkaMuat';
kerangka.hidden = true;
kerangka.setAttribute('aria-hidden', 'true');
konten.append(kerangka);

const pesan = document.createElement('p');
pesan.className = 'sr-only';
pesan.setAttribute('role', 'status');
konten.before(pesan);

const garis = '<div class="muat-bentuk muat-garis"></div>';
const kartu = `<div class="muat-panel"><div class="muat-bentuk muat-foto"></div>${garis}${garis}</div>`;
const daftar = `<div class="muat-grid">${kartu.repeat(2)}</div>`;
const isian = '<div class="muat-bentuk muat-isian"></div>';
const barisTabel = `<div class="muat-baris-tabel">${garis.repeat(3)}</div>`;
const isi = {
  katalog: `<div class="muat-bentuk muat-hero"></div>${garis}${daftar}`,
  tenant: `<div class="muat-panel"><div class="muat-bentuk muat-hero"></div>${garis}${garis}</div>${daftar}`,
  formulir: `<div class="muat-panel muat-formulir">${garis}${isian.repeat(3)}${garis}</div>`,
  internal: `${garis}<div class="muat-grid">${isian.repeat(2)}</div><div class="muat-panel">${barisTabel.repeat(4)}</div>`
};

function bentuk(path) {
  if (path === '/') return ['katalog', 'Memuat katalog kantin…'];
  if (/^\/(?:pratinjau\/)?(?:admin|pemilik)(?:\/|$)/.test(path)) {
    return ['internal', path.includes('/laporan') ? 'Memuat laporan…' : 'Memuat dasbor…'];
  }
  if (path.endsWith('/survei')) return ['formulir', 'Memuat survei…'];
  if (path.startsWith('/tenant/')) return ['tenant', 'Memuat informasi tenant…'];
  if (['/masuk', '/daftar', '/konfirmasi'].includes(path)) return ['formulir', 'Memuat halaman akun…'];
  return ['formulir', 'Memuat halaman…'];
}

const lokasi = () => location.pathname.replace(/\/+$/, '') || '/';
let selesai;
let menunggu;
let timer;

const amati = new MutationObserver(() => {
  selesai = lokasi();
  menunggu = undefined;
  clearTimeout(timer);
  kerangka.hidden = true;
  konten.removeAttribute('aria-busy');
  konten.removeAttribute('data-muat');
  pesan.textContent = '';
  if (document.getElementById('screen-tidak-ditemukan').hidden) {
    document.getElementById('previewStatus').dataset.siap = '';
  }
});
// Router menampilkan halaman atau pesan galat dengan mengubah hidden pada layar utama.
for (const layar of konten.querySelectorAll(':scope > section')) {
  amati.observe(layar, { attributes: true, attributeFilter: ['hidden'] });
}

export function mulaiMuat(endpoint) {
  const path = lokasi();
  if (path === selesai || path === menunggu || endpoint === '/slide') return;

  clearTimeout(timer);
  menunggu = path;
  timer = setTimeout(() => {
    if (menunggu !== path || lokasi() !== path) return;
    const [jenis, teks] = bentuk(path);
    kerangka.innerHTML = `<p class="muat-pesan">${teks}</p>${isi[jenis]}`;
    kerangka.hidden = false;
    konten.setAttribute('aria-busy', 'true');
    konten.dataset.muat = '';
    pesan.textContent = teks;
    if (selesai) window.scrollTo(0, 0);
  }, kerangka.hidden ? 180 : 0);
}
