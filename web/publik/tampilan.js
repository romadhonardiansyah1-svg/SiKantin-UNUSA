import { aspek, detailUrl, filterKatalog, harga, skor, statistik, surveiUrl } from './katalog.js';

const id = nama => document.getElementById(nama);
const entitas = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const teks = nilai => String(nilai).replace(/[&<>"']/g, huruf => entitas[huruf]);
const kelasKategori = { Makanan: '', Minuman: 'cat-minuman', Snack: 'cat-snack' };
const img = (path, alt) => `<img src="${teks(path)}" alt="${teks(alt)}" loading="lazy" decoding="async">`;
const bintang = nilai => '★'.repeat(Math.round(nilai)) + '☆'.repeat(5 - Math.round(nilai));

function kartu(t) {
  const ringkas = statistik(t.ulasan);
  const detail = detailUrl(t);
  const nilai = ringkas.jumlah ? `<span class="gf-star" aria-hidden="true">★</span><b class="gf-rating-val">${skor(ringkas.nilai)}</b> (${ringkas.jumlah} ulasan)` : 'Belum ada penilaian';
  const kategori = [...new Set(t.menu.map(m => m.kategori))].join(', ');
  const menu = t.menu.slice(0, 6).map(m => `
    <a class="gf-menu-item" href="${detail}"><div class="gf-menu-img-box">${img(m.foto, '')}
      <span class="gf-menu-cat-badge ${kelasKategori[m.kategori]}">${teks(m.kategori)}</span></div>
      <div class="gf-menu-price">${harga(m.harga)}</div><div class="gf-menu-name">${teks(m.nama)}</div></a>`).join('');
  const mulai = t.menu.length ? 'Mulai ' + harga(Math.min(...t.menu.map(m => m.harga))) : 'Menu belum tersedia';
  return `<article class="tenant-card gf-card">
    <div class="gf-header"><a href="${detail}" class="gf-thumb-wrap" aria-label="Lihat ${teks(t.nama)}">${img(t.foto, '')}</a>
    <div class="gf-info"><h3 class="gf-title"><a href="${detail}">${teks(t.nama)}</a></h3>
    <div class="gf-meta-row">${nilai}${kategori ? ' · ' + teks(kategori) : ''}</div>
    <div class="gf-campus-row"><span class="gf-campus-label">Kampus ${teks(t.kampus)} UNUSA</span><span class="gf-sep">|</span><span class="gf-pay-label">${teks(t.stand)}</span></div>
    <div class="gf-tags-row">${ringkas.nilai >= 4.5 ? '<span class="gf-tag-pill is-emerald">Rating Tinggi</span>' : ''}<span class="gf-tag-pill">${mulai}</span></div></div></div>
    <div class="gf-menu-carousel">${menu}<a class="gf-see-more-slot" href="${detail}"><span class="gf-see-more-circle" aria-hidden="true">→</span><span class="gf-see-more-label">Lihat lainnya</span></a></div>
    ${t.ulasan.length ? `<div class="gf-review-snippet"><span class="gf-review-snippet-text">“${teks(t.ulasan[0].komentar)}”</span></div>` : ''}
    <div class="gf-footer"><a class="gf-footer-link" href="${detail}">Kunjungi toko (${t.menu.length} menu) →</a>
    <a class="gf-footer-review-btn" href="${surveiUrl(t)}">Beri Ulasan</a></div></article>`;
}

export function katalog(daftar, params) {
  const hasil = filterKatalog(daftar, params);
  const kampus = params.get('kampus') ? 'KAMPUS_' + params.get('kampus') : 'ALL';
  id('searchTenantInput').value = params.get('q') || '';
  id('publicCategoryFilter').value = params.get('kategori') || 'ALL';
  id('publicSortSelect').value = params.get('urut') || 'default';
  for (const tombol of id('publicCampusFilterBar').querySelectorAll('[data-campus]')) {
    const kode = tombol.dataset.campus;
    const aktif = kode === kampus;
    tombol.classList.toggle('active', aktif);
    tombol.setAttribute('aria-pressed', aktif);
    id('badgeCount' + kode).textContent = kode === 'ALL' ? daftar.length : daftar.filter(t => 'KAMPUS_' + t.kampus === kode).length;
  }
  for (const el of id('facilityGrid').children) {
    const aktif = (el.dataset.campus || 'ALL') === kampus;
    el.hidden = !aktif;
    if (aktif) el.style.display = el.dataset.campus ? 'block' : 'flex';
  }
  id('tenantGrid').innerHTML = hasil.map(kartu).join('');
  id('noResultsMessage').style.display = hasil.length ? 'none' : 'block';
  id('jumlahHasil').textContent = hasil.length + ' stand ditemukan';
}

export function menuDetail(t, kategori = 'ALL') {
  const daftar = t.menu.filter(m => kategori === 'ALL' || m.kategori === kategori);
  for (const btn of id('detailMenuCatTabs').querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.cat === kategori);
    btn.setAttribute('aria-pressed', btn.dataset.cat === kategori);
  }
  id('detailMenuCountBadge').textContent = daftar.length + ' menu tersedia';
  id('detailMenuGrid').innerHTML = daftar.map(m => `
    <article class="menu-card-photo"><div class="menu-card-img-wrap">${img(m.foto, '')}<div class="menu-card-badges">
    <span class="menu-card-cat-pill ${kelasKategori[m.kategori]}">${teks(m.kategori)}</span>
    ${m.andalan ? '<span class="menu-card-rec-pill">★ Rekomendasi</span>' : ''}</div></div>
    <div class="menu-card-body"><h3 class="menu-card-title">${teks(m.nama)}</h3><p class="menu-card-desc">${teks(m.deskripsi)}</p>
    <div class="menu-card-footer"><span class="menu-card-price">${harga(m.harga)}</span><span class="badge badge-success">Tersedia</span></div></div></article>
  `).join('') || '<p class="empty-note">Belum ada menu pada kategori ini.</p>';
}

export function detail(t, kembali) {
  const nilai = statistik(t.ulasan);
  id('detailBreadcrumbCampus').textContent = id('detailCampusBadge').textContent = 'Kampus ' + t.kampus + ' UNUSA';
  id('detailBreadcrumbName').textContent = id('detailTenantName').textContent = t.nama;
  id('detailTenantDesc').textContent = t.deskripsi;
  id('detailTenantBannerImg').src = t.foto;
  id('detailTenantBannerImg').alt = 'Foto ' + t.nama;
  id('detailStall').textContent = t.stand;
  id('detailAvgScore').textContent = nilai.jumlah ? skor(nilai.nilai) : 'Belum ada penilaian';
  id('detailAvgScore').nextElementSibling.hidden = !nilai.jumlah;
  id('detailStarContainer').textContent = nilai.jumlah ? bintang(nilai.nilai) : '';
  id('detailReviewCount').textContent = nilai.jumlah + ' ulasan';
  id('detailAspectGrid').innerHTML = aspek.map((nama, i) => `<div class="aspect-box"><span>${nama}</span><strong>${nilai.jumlah ? skor(nilai.aspek[i]) + ' / 5' : '—'}</strong></div>`).join('');
  id('detailReviewsList').innerHTML = t.ulasan.map(u => `<article class="review-card"><strong>${teks(u.status)}</strong><p>${teks(u.komentar)}</p></article>`).join('') || '<p class="empty-note">Belum ada ulasan untuk stand ini.</p>';
  for (const link of id('screen-public-tenant-detail').querySelectorAll('[data-survey-link]')) link.href = surveiUrl(t);
  for (const link of id('screen-public-tenant-detail').querySelectorAll('[data-katalog-link]')) link.href = kembali;
  menuDetail(t);
}
