import { aspek, detailUrl, filterKatalog, harga, skor, statistikTenant, surveiUrl } from './katalog.js';

const id = nama => document.getElementById(nama);
const entitas = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const teks = nilai => String(nilai).replace(/[&<>"']/g, huruf => entitas[huruf]);
const kelasKategori = { Makanan: '', Minuman: 'cat-minuman', Snack: 'cat-snack' };
const foto = path => typeof path === 'string' && /^\/(?:assets|foto)\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(path) ? path : '';
const img = (path, alt) => foto(path) ? `<img src="${teks(path)}" alt="${teks(alt)}" loading="lazy" decoding="async">` : '';
const bintang = nilai => '★'.repeat(Math.round(nilai)) + '☆'.repeat(5 - Math.round(nilai));

function kartu(t) {
  const ringkas = statistikTenant(t);
  const detail = detailUrl(t);
  const nilai = ringkas.nilai != null ? `<span class="gf-star" aria-hidden="true">★</span><span class="gf-rating-val">${skor(ringkas.nilai)}</span><span>(${ringkas.jumlah} ulasan)</span>` : 'Belum ada penilaian';
  const kategori = [...new Set(t.menu.map(m => m.kategori))].join(', ');
  const menu = t.menu.slice(0, 6).map(m => `
    <a class="gf-menu-item" href="${detail}"><div class="gf-menu-img-box">${img(m.foto, '')}
      <span class="gf-menu-cat-badge ${kelasKategori[m.kategori]}">${teks(m.kategori)}</span></div>
      <div class="gf-menu-price">${harga(m.harga)}</div><div class="gf-menu-name">${teks(m.nama)}</div></a>`).join('');
  const mulai = t.menu.length ? 'Mulai ' + harga(Math.min(...t.menu.map(m => m.harga))) : 'Menu belum tersedia';
  return `<article class="tenant-card gf-card">
    <div class="gf-header"><a href="${detail}" class="gf-thumb-wrap" aria-label="Lihat ${teks(t.nama)}">${img(t.foto, '')}</a>
    <div class="gf-info"><h3 class="gf-title"><a href="${detail}">${teks(t.nama)}</a></h3>
    <div class="gf-meta-row">${nilai}${kategori ? '<span class="gf-sep" aria-hidden="true">|</span><span>' + teks(kategori) + '</span>' : ''}</div>
    <div class="gf-campus-row"><span class="gf-campus-label">
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      Kampus ${teks(t.kampus)} UNUSA</span><span class="gf-sep" aria-hidden="true">|</span><span class="gf-pay-label">Tunai &amp; QRIS</span></div>
    <div class="gf-tags-row">${ringkas.nilai >= 4.5 ? '<span class="gf-tag-pill is-emerald">Rating Tinggi</span>' : ''}<span class="gf-tag-pill">${mulai}</span></div></div></div>
    <div class="gf-menu-carousel">${menu}<a class="gf-see-more-slot" href="${detail}"><span class="gf-see-more-circle">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span><span class="gf-see-more-label">Lihat lainnya</span></a></div>
    ${t.ulasan.length ? `<div class="gf-review-snippet"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span class="gf-review-snippet-text">“${teks(t.ulasan[0].komentar)}”</span></div>` : ''}
    <div class="gf-footer"><a class="gf-footer-link" href="${detail}">Kunjungi toko (${t.menu.length} menu)
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></a>
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
    tombol.querySelector('.badge').textContent = kode === 'ALL' ? daftar.length : daftar.filter(t => 'KAMPUS_' + t.kampus === kode).length;
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

const awalTombol = id('publicCampusFilterBar').querySelector('button[data-campus="KAMPUS_A"]').cloneNode(true);
const awalFasilitas = id('facilityGrid').querySelector('.facility-card').cloneNode(true);
export function kampusKatalog(daftar) {
  const bar = id('publicCampusFilterBar');
  const fasilitas = id('facilityGrid');
  bar.querySelectorAll('button:not([data-campus="ALL"])').forEach(button => button.remove());
  fasilitas.querySelectorAll('.facility-card').forEach(card => card.remove());
  id('facilitySummaryStrip').firstElementChild.textContent = 'Fasilitas Kantin UNUSA';
  for (const { kode, nama, alamat, fasilitas: info } of daftar) {
    const tombol = awalTombol.cloneNode(true);
    tombol.dataset.campus = 'KAMPUS_' + kode;
    tombol.firstElementChild.textContent = 'Kampus ' + kode;
    tombol.lastElementChild.removeAttribute('id');
    bar.append(tombol);
    const card = awalFasilitas.cloneNode(true);
    card.dataset.campus = tombol.dataset.campus;
    card.querySelector('.facility-title').textContent = nama;
    const [lokasi, rincian] = card.querySelectorAll('.facility-item');
    lokasi.textContent = alamat || 'Alamat belum dicatat.';
    rincian.textContent = info || 'Fasilitas belum dicatat.';
    fasilitas.append(card);
  }
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
    <div class="menu-card-footer"><span class="menu-card-price">${harga(m.harga)}</span><span class="badge ${m.tersedia === false ? 'badge-danger' : 'badge-success'}">${m.tersedia === false ? 'Habis' : 'Tersedia'}</span></div></div></article>
  `).join('') || '<p class="empty-note">Belum ada menu pada kategori ini.</p>';
}

export function detail(t, kembali) {
  const nilai = statistikTenant(t);
  id('detailBreadcrumbCampus').textContent = id('detailCampusBadge').textContent = 'Kampus ' + t.kampus + ' UNUSA';
  id('detailBreadcrumbName').textContent = id('detailTenantName').textContent = t.nama;
  id('detailTenantDesc').textContent = t.deskripsi;
  const banner = id('detailTenantBannerImg');
  const path = foto(t.foto);
  banner.hidden = !path;
  if (path) banner.src = path;
  else banner.removeAttribute('src');
  id('detailTenantBannerImg').alt = 'Foto ' + t.nama;
  id('detailAvgScore').textContent = nilai.nilai != null ? skor(nilai.nilai) : 'Belum ada penilaian';
  id('detailAvgScore').nextElementSibling.hidden = nilai.nilai == null;
  id('detailStarContainer').textContent = nilai.nilai != null ? bintang(nilai.nilai) : '';
  id('detailReviewCount').textContent = nilai.jumlah + ' ulasan';
  id('detailAspectGrid').innerHTML = aspek.map((nama, i) => `<div class="aspect-box"><span>${nama}</span><strong>${nilai.aspek[i] != null ? skor(nilai.aspek[i]) + ' / 5' : '—'}</strong></div>`).join('');
  id('detailReviewsList').innerHTML = t.ulasan.map(u => `<article class="review-card"><strong>${teks(u.status)}</strong><p>${teks(u.komentar)}</p></article>`).join('') || '<p class="empty-note">Belum ada ulasan untuk stand ini.</p>';
  for (const link of id('screen-public-tenant-detail').querySelectorAll('[data-survey-link]')) link.href = surveiUrl(t);
  for (const link of id('screen-public-tenant-detail').querySelectorAll('[data-katalog-link]')) link.href = kembali;
  menuDetail(t);
}
