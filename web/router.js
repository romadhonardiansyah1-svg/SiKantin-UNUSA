import { surveiUrl, tujuanSurvei } from './publik/katalog.js';
import { katalog, detail, kampusKatalog, menuDetail } from './publik/tampilan.js';
import { tampilkanAkun, tampilkanKonfirmasi } from './auth/formulir.js';
import { bukaSurvei, hasilSurvei } from './publik/survei.js';
import { internal, tutupInternal } from './admin-ui/pratinjau.js';
import { api, layananAktif, sesiAktif } from './api.js';

const id = nama => document.getElementById(nama);
const layar = [...document.querySelectorAll('#konten > section')];
let daftar = [];
let contoh;
let tenant = null;
let posisiRute = 0;
let operasional = false;
let katalogUsang = false;
let konfirmasi;
async function muatContoh() {
  const response = await fetch('/publik/katalog-contoh.json');
  if (!response.ok) throw new Error('Data pratinjau gagal dimuat.');
  return response.json();
}
async function muatKatalog() {
  const data = await api('/katalog', { sesi: false });
  daftar = data.tenant;
  kampusKatalog(data.kampus);
  katalogUsang = false;
}
function tampil(nama, judul, fokus) {
  const kini = id('screen-' + nama);
  for (const el of layar) {
    el.hidden = el !== kini;
    el.classList.toggle('active', el === kini);
  }
  document.title = judul + ' · SiKantin UNUSA';
  document.body.classList.toggle('admin-preview-open', nama === 'internal' && kini.classList.contains('internal-admin'));
  if (fokus) { kini.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
function ke(url, ganti = false) {
  const state = { katalog: location.pathname === '/' ? '/' + location.search : history.state?.katalog || '/' };
  history[ganti ? 'replaceState' : 'pushState'](state, '', url);
  renderAman(true);
}
function gagal(judul, pesan, ulang = false) {
  const halaman = id('screen-tidak-ditemukan');
  halaman.querySelector('h1').textContent = judul;
  halaman.querySelector('p').textContent = pesan;
  const link = halaman.querySelector('a');
  link.textContent = ulang ? 'Coba lagi' : 'Kembali ke katalog';
  link.href = ulang ? location.pathname + location.search : '/';
  link.onclick = ulang ? event => { event.preventDefault(); event.stopPropagation(); location.reload(); } : null;
  tampil('tidak-ditemukan', judul, true);
}
async function renderAman(fokus = false) {
  const sebelum = posisiRute + 1;
  try { await render(fokus); }
  catch (error) {
    if (posisiRute === sebelum) gagal('Halaman gagal dimuat', error.message, true);
  }
}

async function render(fokus = false) {
  const giliran = ++posisiRute;
  tutupInternal();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(location.search);
  tutupMenu(false);
  if (operasional && katalogUsang && /^(\/$|\/tenant\/|\/(?:masuk|daftar|konfirmasi)$)/.test(path)) {
    await muatKatalog();
    if (giliran !== posisiRute) return;
  }
  if (path === '/') {
    katalog(daftar, params);
    tampil('public-index', 'Katalog kantin', fokus);
    if (location.hash === '#tenantGrid') id('tenantGrid').scrollIntoView();
    return;
  }
  const rute = path.match(/^(\/pratinjau)?\/tenant\/([a-z0-9-]+)(?:\/(survei|ringkasan))?$/);
  if (rute?.[1] && operasional) {
    contoh ??= await muatContoh();
    if (giliran !== posisiRute) return;
  }
  tenant = rute && (rute[1] ? contoh ?? daftar : daftar).find(t => t.slug === rute[2]);
  if (tenant && !rute[1] && !rute[3]) {
    const kembali = history.state?.katalog || '/';
    detail(tenant, /^\/(?:\?[^#]*)?$/.test(kembali) ? kembali : '/');
    tampil('public-tenant-detail', tenant.nama, fokus);
    return;
  }
  if (tenant && rute[3]) {
    const pratinjau = Boolean(rute[1]);
    if (rute[3] === 'ringkasan') {
      if (!hasilSurvei(tenant, pratinjau)) return ke((pratinjau ? '/pratinjau' : '') + surveiUrl(tenant), true);
      tampil('public-review-success', pratinjau ? 'Ringkasan simulasi' : 'Ulasan terkirim', fokus);
    } else {
      if (!pratinjau) {
        const profil = operasional ? await sesiAktif() : null;
        if (giliran !== posisiRute) return;
        if (!profil) return ke((operasional ? '/daftar' : '/masuk') + '?kembali=' + encodeURIComponent(surveiUrl(tenant)), true);
        if (profil.peran !== 'pelanggan') return gagal('Survei pelanggan', 'Masuk dengan akun pelanggan untuk mengirim ulasan.');
        const pertanyaan = await api('/pertanyaan');
        if (giliran !== posisiRute) return;
        bukaSurvei(tenant, pertanyaan);
      } else bukaSurvei(tenant);
      tampil('public-review', 'Survei · ' + tenant.nama, fokus);
    }
    return;
  }
  if (/^\/(admin|pemilik)(\/|$)/.test(path)) {
    const profil = operasional ? await sesiAktif() : null;
    if (giliran !== posisiRute) return;
    if (!profil) return ke('/masuk?akses=internal', true);
    if (profil.peran !== path.split('/')[1]) return gagal('Akses ditolak', 'Halaman ini dibatasi sesuai peran akun.');
    const { halamanInternal } = await import('./admin/operasional.js');
    if (giliran !== posisiRute) return;
    const judul = await halamanInternal(path, daftar);
    if (giliran !== posisiRute) return;
    if (judul) return tampil('internal', judul, fokus);
  }
  if (path === '/masuk' || path === '/daftar') {
    const daftarAkun = path === '/daftar';
    const profil = operasional ? await sesiAktif() : null;
    if (giliran !== posisiRute) return;
    tampilkanAkun(daftarAkun, tujuanSurvei(params.get('kembali'), daftar), params.get('akses') === 'internal', operasional, profil);
    tampil('tenant-login', daftarAkun ? 'Daftar akun' : 'Masuk', fokus);
    return;
  }
  if (path === '/konfirmasi' && operasional) {
    const hash = new URLSearchParams(location.hash.slice(1)).get('token_hash');
    if (hash) {
      konfirmasi = { hash, kembali: params.get('kembali') };
      history.replaceState(history.state, '', '/konfirmasi');
    }
    tampilkanKonfirmasi(konfirmasi?.hash, tujuanSurvei(konfirmasi?.kembali, daftar));
    return tampil('tenant-login', 'Konfirmasi email', fokus);
  }
  if (/^\/pratinjau\/(?:admin(?:\/|$)|pemilik$)/.test(path)) {
    contoh ??= operasional ? await muatContoh() : daftar;
    if (giliran !== posisiRute) return;
    const ada = await internal(path, contoh);
    if (giliran !== posisiRute) return;
    if (ada) return tampil('internal', id('screen-internal').querySelector('h1').textContent, fokus);
  }
  const qr = path.startsWith('/r/');
  gagal(qr ? (operasional ? 'Kode QR tidak berlaku' : 'Kode QR belum tersedia') : 'Halaman tidak ditemukan',
    qr ? 'Buka halaman tenant di katalog untuk mengisi survei.' : 'Periksa tautan atau pilih tenant dari katalog.');
}

function ubahFilter(nama, nilai, tambah = false) {
  const url = new URL(location.href);
  if (nilai && nilai !== 'ALL' && nilai !== 'default') url.searchParams.set(nama, nilai);
  else url.searchParams.delete(nama);
  url.hash = '';
  history[tambah ? 'pushState' : 'replaceState']({}, '', url);
  katalog(daftar, url.searchParams);
}
const drawer = id('mobileNavDrawer');
const tombolMenu = document.querySelector('.mobile-nav-toggle');
function tutupMenu(fokus) {
  const terbuka = drawer.classList.contains('open');
  drawer.classList.remove('open');
  id('mobileNavBackdrop').classList.remove('open');
  document.body.classList.remove('drawer-open');
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  tombolMenu.setAttribute('aria-expanded', 'false');
  if (fokus && terbuka) tombolMenu.focus();
}
tombolMenu.addEventListener('click', () => {
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open');
  id('mobileNavBackdrop').classList.add('open');
  document.body.classList.add('drawer-open');
  tombolMenu.setAttribute('aria-expanded', 'true');
  drawer.querySelector('button').focus();
});
drawer.querySelector('button').addEventListener('click', () => tutupMenu(true));
id('mobileNavBackdrop').addEventListener('click', () => tutupMenu(true));
document.addEventListener('keydown', event => {
  if (drawer.inert) return;
  if (event.key === 'Escape') { tutupMenu(true); return; }
  if (event.key !== 'Tab') return;
  const links = [...drawer.querySelectorAll('button,a')];
  const ujung = event.shiftKey ? links[0] : links.at(-1);
  if (document.activeElement === ujung) { event.preventDefault(); (event.shiftKey ? links.at(-1) : links[0]).focus(); }
});
matchMedia('(min-width: 901px)').addEventListener('change', () => tutupMenu(false));
document.addEventListener('click', event => {
  const a = event.target.closest('a[href]');
  if (!a || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || a.target || a.hasAttribute('download')
      || a.origin !== location.origin || a.pathname.startsWith('/r/')) return;
  if (a.hash && a.pathname === location.pathname && (!a.search || a.search === location.search)) {
    const tujuan = document.getElementById(a.hash.slice(1));
    if (tujuan) { event.preventDefault(); tujuan.focus({ preventScroll: true }); tujuan.scrollIntoView(); }
    return;
  }
  event.preventDefault();
  ke(a.pathname + a.search + a.hash);
});
document.addEventListener('navigasi', e => ke(e.detail));
document.addEventListener('katalog-berubah', () => { katalogUsang = true; });
window.addEventListener('popstate', () => renderAman(true));
id('searchTenantInput').addEventListener('input', e => ubahFilter('q', e.target.value));
id('publicCategoryFilter').addEventListener('change', e => ubahFilter('kategori', e.target.value, true));
id('publicSortSelect').addEventListener('change', e => ubahFilter('urut', e.target.value, true));
id('publicCampusFilterBar').addEventListener('click', e => {
  const btn = e.target.closest('[data-campus]');
  if (btn) ubahFilter('kampus', btn.dataset.campus.replace('KAMPUS_', ''), true);
});
id('resetFilter').addEventListener('click', () => ke('/'));
id('detailMenuCatTabs').addEventListener('click', e => {
  const btn = e.target.closest('[data-cat]');
  if (tenant && btn) menuDetail(tenant, btn.dataset.cat);
});

const poster = id('heroPosterTrack');
const kontrol = document.querySelector('.poster-control');
const gerak = matchMedia('(prefers-reduced-motion: reduce)');
let jeda = gerak.matches;
function tombolPoster() {
  kontrol.textContent = jeda ? '▶' : 'Ⅱ';
  kontrol.setAttribute('aria-label', jeda ? 'Putar poster' : 'Jeda poster');
  kontrol.title = kontrol.getAttribute('aria-label');
}
kontrol.addEventListener('click', () => { jeda = !jeda; tombolPoster(); });
gerak.addEventListener('change', () => { jeda = gerak.matches; tombolPoster(); });
tombolPoster();
setInterval(() => {
  if (jeda || document.hidden || !poster.clientWidth || poster.matches(':hover, :focus-within')) return;
  const posisi = (Math.round(poster.scrollLeft / poster.clientWidth) + 1) % poster.children.length;
  poster.scrollTo({ left: posisi * poster.clientWidth, behavior: gerak.matches ? 'instant' : 'smooth' });
}, 4200);

try {
  operasional = await layananAktif();
  id('previewStatus').hidden = operasional;
  if (operasional) {
    document.querySelectorAll('a[href^="/pratinjau"]').forEach(link => { link.hidden = true; });
    await muatKatalog();
  } else daftar = contoh = await muatContoh();
  await renderAman();
} catch {
  gagal('Katalog gagal dimuat', 'Periksa koneksi Anda, lalu coba lagi.', true);
}
