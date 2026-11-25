import { aspek, harga, skor, statistik } from '../publik/katalog.js';

const rute = {
  '/pratinjau/admin': ['admin-dashboard', 'Dasbor analitik pengelola kantin'],
  '/pratinjau/admin/kampus': ['admin-campuses', 'Manajemen kampus'],
  '/pratinjau/admin/tenant': ['admin-tenants', 'Tenant & kode QR'],
  '/pratinjau/admin/tenant/baru': ['admin-tenant-form', 'Tambah tenant'],
  '/pratinjau/admin/menu': ['admin-menus', 'Katalog menu'],
  '/pratinjau/admin/pertanyaan': ['admin-questions', 'Butir pertanyaan'],
  '/pratinjau/admin/ulasan': ['admin-reviews', 'Moderasi ulasan'],
  '/pratinjau/admin/laporan': ['admin-report', 'Laporan evaluasi'],
  '/pratinjau/admin/qr': ['admin-qr-print', 'Kartu QR meja'],
  '/pratinjau/pemilik': ['tenant-dashboard', 'Portal evaluasi pemilik']
};
const id = key => document.getElementById(key);
const isi = (key, value) => { id(key).textContent = value; };
const val = key => id(key)?.value || '';
const tanggal = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' });
const jam = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' });
const nilai = data => data.jumlah ? skor(data.nilai) : '—';
const charts = [];
let sumber;
let events;

export function tutupInternal() {
  events?.abort();
  for (const chart of charts.splice(0)) chart.destroy();
  id('screen-internal').replaceChildren();
}

async function templates() {
  if (!sumber) {
    sumber = fetch('/admin-ui/layar').then(async response => {
      if (!response.ok) throw new Error('layar');
      return new DOMParser().parseFromString(await response.text(), 'text/html');
    }).catch(err => { sumber = null; throw err; });
  }
  return sumber;
}

function tabel(key, baris) {
  const body = id(key);
  body.replaceChildren();
  if (!baris.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = body.closest('table').tHead.rows[0].cells.length;
    cell.textContent = 'Tidak ada data untuk pilihan ini.';
    return;
  }
  for (const row of baris) {
    const tr = body.insertRow();
    for (const value of row) {
      const cell = tr.insertCell();
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value;
    }
  }
}
function tautan(url, nama) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = nama;
  a.className = 'btn btn-outline preview-action';
  return a;
}
function pilihTenant(key, tenants, semua = true) {
  const el = id(key);
  if (!el) return;
  const options = tenants.map(t => new Option(t.nama, t.slug));
  el.replaceChildren(...(semua ? [new Option('Semua tenant', '')] : []), ...options);
}
const kampus = (key, t) => !Number(val(key)) || 'ABC'[Number(val(key)) - 1] === t.kampus;
const cocok = (key, t) => !val(key) || val(key) === t.slug;
const cari = (key, ...values) => values.join(' ').toLocaleLowerCase('id').includes(val(key).trim().toLocaleLowerCase('id'));
const tanggapan = tenants => tenants.flatMap(t => t.ulasan.map(u => ({ t, u }))).sort((a,b) => b.u.waktu.localeCompare(a.u.waktu));

function grafik(key, judul, tipe, labels, data) {
  const canvas = id(key);
  canvas.setAttribute('aria-label', judul + '. ' + labels.map((l, i) => l + ' ' + (data[i] ?? '—')).join(', '));
  const old = window.Chart.getChart(canvas);
  if (old) {
    old.data.datasets[0].data = data;
    old.update('none');
    return;
  }
  const chart = new window.Chart(canvas, {
    type: tipe, data: { labels, datasets: [{ label: judul, data, borderColor: '#007546',
      backgroundColor: tipe === 'bar' ? ['#006837','#10b981','#fbbf24','#34b778','#059669'] : '#10b98126',
      borderWidth: 2, borderRadius: 6, fill: tipe === 'line', tension: .3 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, suggestedMax: tipe === 'bar' ? 5 : 1, ticks: { precision: 0 } } } }
  });
  charts.push(chart);
}
function diagram(aspectKey, peakKey, reviews) {
  const distribusi = Array(24).fill(0);
  for (const u of reviews) distribusi[Number(jam.format(new Date(u.waktu)))]++;
  const bagianJam = id(peakKey).parentElement.parentElement;
  bagianJam.querySelector('h3, h4').textContent = 'Waktu pengisian ulasan (WIB)';
  const keterangan = bagianJam.querySelector('p');
  if (keterangan) keterangan.textContent = 'Jumlah ulasan contoh menurut jam pengisian.';
  grafik(aspectKey, 'Rata-rata penilaian', 'bar', aspek, statistik(reviews).aspek);
  grafik(peakKey, 'Jumlah ulasan per jam (WIB)', 'line', distribusi.map((_, h) => String(h).padStart(2,'0')), distribusi);
}
function komentar(key, rows) {
  const kontainer = id(key);
  kontainer.replaceChildren();
  for (const {t, u} of rows) {
    const artikel = document.createElement('article');
    artikel.className = 'review-card';
    const judul = document.createElement('strong');
    judul.textContent = t.nama + ' · ' + tanggal.format(new Date(u.waktu));
    const p = document.createElement('p');
    p.textContent = u.komentar;
    artikel.append(judul, p);
    kontainer.append(artikel);
  }
  if (!rows.length) kontainer.textContent = 'Belum ada ulasan dalam pilihan ini.';
}
function dasbor(daftar) {
  id('adminDashboardCampusFilter').parentElement.previousElementSibling.textContent = 'Ringkasan ulasan contoh di kampus yang dipilih.';
  const tenants = daftar.filter(t => kampus('adminDashboardCampusFilter',t));
  const rows = tanggapan(tenants);
  const reviews = rows.map(r => r.u);
  const urut = tenants.map(t => ({t, s:statistik(t.ulasan)})).filter(x => x.s.jumlah).sort((a,b) => b.s.nilai - a.s.nilai);
  isi('adminStatTenants', tenants.length);
  isi('adminStatMenus', tenants.reduce((n,t) => n+t.menu.length,0));
  isi('adminStatReviews', rows.length);
  isi('adminStatAvgRating', nilai(statistik(reviews)));
  isi('adminAttentionList', urut.filter(x => x.s.nilai < 4.2).map(x => x.t.nama).join(' · ') || 'Tidak ada tenant dengan skor di bawah 4,2.');
  id('adminDashboardTopTenantsList').replaceChildren(...urut.slice(0,5).map(x => {
    const p = document.createElement('p');
    p.textContent = x.t.nama + ' · ' + nilai(x.s);
    return p;
  }));
  tabel('adminDashboardLatestReviewsBody', rows.slice(0,5).map(({t,u}) => [tanggal.format(new Date(u.waktu)),t.nama,u.status,nilai(statistik([u])),u.komentar]));
  diagram('aspectChart','peakHoursChart',reviews);
}
function laporan(daftar) {
  const tanggalContoh = Math.max(...daftar.flatMap(t => t.ulasan.map(u => Date.parse(u.waktu))));
  const batas = new Date(tanggalContoh);
  const bulan = { '3_months':3, '6_months':6, '1_year':12 }[val('reportFilterPeriod')];
  if (bulan) batas.setUTCMonth(batas.getUTCMonth() - bulan);
  const tenants = daftar.filter(t => kampus('reportFilterCampus',t) && cocok('reportFilterTenant',t))
    .map(t => ({ ...t, ulasan:t.ulasan.filter(u => !bulan || Date.parse(u.waktu) >= batas.getTime()) }));
  const rows=tanggapan(tenants), reviews=rows.map(r => r.u);
  isi('periodeContoh', bulan ? tanggal.format(batas) + ' – ' + tanggal.format(tanggalContoh) : 'Semua tanggal pada data contoh');
  isi('waktuLaporan','Contoh laporan · WIB');
  isi('reportKpiReviews',reviews.length);
  isi('reportKpiAvg',nilai(statistik(reviews)));
  isi('reportKpiStatus','Pratinjau');
  tabel('evaluationReportTableBody',tenants.map((t,i) => {
    const s=statistik(t.ulasan);
    return [i+1,t.nama,t.kampus,'—',...s.aspek.map(x => x === null ? '—' : skor(x)),nilai(s),s.jumlah,'—'];
  }));
  komentar('reportCommentsList',rows);
  diagram('reportAspectChart','reportPeakChart',reviews);
}
function proses(key, daftar) {
  if (key==='admin-dashboard') return dasbor(daftar);
  if (key==='admin-report') return laporan(daftar);
  if (key==='admin-tenants') {
    const ts=daftar.filter(t => kampus('adminTenantsFilterCampus',t) && cari('adminTenantsSearch',t.nama,t.stand));
    isi('adminTenantsCountBadge',ts.length+' tenant');
    tabel('adminTenantsTableBody',ts.map(t => [t.stand+' · '+t.nama,t.kampus,'—','—',nilai(statistik(t.ulasan))+' / '+t.ulasan.length+' ulasan','Belum terbit',tautan('/pratinjau/admin/qr?tenant='+t.slug,'Kartu QR')]));
  } else if (key==='admin-menus') {
    const menu=daftar.filter(t=>cocok('adminMenusFilterTenant',t)).flatMap(t=>t.menu.filter(m=>(!val('adminMenusFilterCategory') || m.kategori.toLowerCase()===val('adminMenusFilterCategory')) && cari('adminMenusSearch',m.nama,t.nama)).map(m=>[m.nama+' · '+m.kategori,t.nama,harga(m.harga),'Tersedia','—']));
    isi('adminMenusCountBadge',menu.length+' menu');
    tabel('adminMenusTableBody',menu);
  } else if (key==='admin-reviews') {
    const rows=tanggapan(daftar.filter(t=>cocok('adminReviewsFilterTenant',t))).filter(({t,u})=>['','published'].includes(val('adminReviewsFilterStatus')) && cari('adminReviewsSearch',u.komentar,t.nama,u.status));
    isi('adminReviewsCountBadge',rows.length+' ulasan');
    tabel('adminReviewsTableBody',rows.map(({t,u})=>[tanggal.format(new Date(u.waktu))+' · '+u.status,t.nama,nilai(statistik([u]))+' · '+u.komentar,'Tayang','—']));
  } else if (key==='admin-qr-print') {
    const t=daftar.find(t=>t.slug===val('qrPrintTenantSelect'));
    if (!t) return;
    isi('qrPrintStallCampusBadge',t.stand+' · Kampus '+t.kampus);
    isi('qrPrintTenantName',t.nama);
    isi('printQrContainer','QR belum diterbitkan.');
    isi('qrPrintFallbackUrl','');
  } else if (key==='tenant-dashboard') {
    const t=daftar.find(t=>t.slug==='warung-cak-min');
    id('screen-tenant-dashboard').querySelector('.badge-stall').textContent = t.stand;
    const s=statistik(t.ulasan);
    isi('tenantKpiAvg',nilai(s));
    isi('tenantKpiMenus',t.menu.length);
    isi('tenantKpiReviews',s.jumlah);
    const idx=s.aspek.indexOf(Math.max(...s.aspek));
    isi('tenantKpiBestAspect',s.jumlah ? aspek[idx] : '—');
    isi('tenantKpiBestScore',s.jumlah ? skor(s.aspek[idx])+' / 5' : 'Belum ada penilaian');
    komentar('tenantPortalReviewsList',tanggapan([t]));
    diagram('tenantAspectChart','tenantPeakChart',t.ulasan);
  }
}
export async function internal(path, katalogPublik) {
  const route=rute[path];
  if (!route) return false;
  const controller=new AbortController();
  events=controller;
  const {signal}=controller;
  const [key,title]=route;
  const panel=id('screen-internal');
  const perluStand = ['admin-tenants', 'admin-qr-print', 'tenant-dashboard'].includes(key);
  let doc, standContoh;
  try {
    [doc, standContoh] = await Promise.all([
      templates(),
      perluStand ? import('./stand-contoh.js') : null,
      ['admin-dashboard','admin-report','tenant-dashboard'].includes(key) ? import('../vendor/chart-4.6.2.js') : null
    ]);
  } catch {
    if (signal.aborted) return false;
    panel.replaceChildren();
    const h=document.createElement('h1');
    h.textContent='Pratinjau gagal dimuat';
    panel.append(h, tautan(path, 'Coba lagi'));
    return true;
  }
  if(signal.aborted) return false;
  const daftar = standContoh
    ? katalogPublik.map(t => ({ ...t, stand: standContoh.kodeStand[t.slug] ?? 'Belum ditetapkan' }))
    : katalogPublik;
  const clone=key => doc.getElementById(key).content.cloneNode(true);
  const admin=key.startsWith('admin-') && key!=='admin-qr-print';
  panel.classList.toggle('internal-admin',admin);
  panel.replaceChildren(clone(admin?'layout':key));
  if(admin){
    panel.querySelector('main').append(clone(key));
    isi('adminTopbarTitle',title);
    isi('adminTopbarDate','Pratinjau · Data contoh');
    const kembali = panel.querySelector('.admin-sidebar .btn-danger');
    kembali.replaceChildren(kembali.querySelector('svg'), 'Kembali ke katalog');
    for(const a of panel.querySelectorAll('.admin-nav-item'))a.classList.toggle('active',a.pathname===path);
  }
  for(const k of ['adminMenusFilterTenant','adminReviewsFilterTenant','reportFilterTenant']) pilihTenant(k,daftar);
  pilihTenant('qrPrintTenantSelect',daftar,false);
  if(key==='admin-qr-print'){
    const tujuan=new URLSearchParams(location.search).get('tenant');
    if(daftar.some(t=>t.slug===tujuan)) id('qrPrintTenantSelect').value=tujuan;
  }
  function panelSamping(buka) {
    id('adminSidebar')?.classList.toggle('open',buka);
    id('adminSidebarBackdrop')?.classList.toggle('open',buka);
    id('sidebarToggle')?.setAttribute('aria-expanded',buka);
  }
  let pemicu;
  function drawer(buka) {
    const box=panel.querySelector('.crud-drawer-panel');
    if(!box) return;
    box.classList.toggle('open',buka);
    id('crudDrawerBackdrop')?.classList.toggle('open',buka);
    box.inert=!buka;
    if(buka) box.querySelector('[data-drawer="close"]')?.focus();
    else pemicu?.focus();
  }
  drawer(false);
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button,[data-drawer],.crud-drawer-backdrop,.admin-sidebar-backdrop');
    if(!b)return;
    if(b.id==='sidebarToggle') panelSamping(!id('adminSidebar').classList.contains('open'));
    if(b.id==='adminSidebarBackdrop') panelSamping(false);
    if(b.dataset.drawer==='open'){pemicu=b;drawer(true);}
    if(b.dataset.drawer==='close'||b.id==='crudDrawerBackdrop') drawer(false);
    if(b.hasAttribute('data-print'))window.print();
    if(b.hasAttribute('data-filter'))proses(key,daftar);
  },{signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){drawer(false);panelSamping(false);}}, {signal});
  panel.addEventListener('change',()=>proses(key,daftar),{signal});
  panel.addEventListener('input',e=>{if(e.target.matches('input[type="text"],input[type="search"]'))proses(key,daftar);},{signal});
  panel.addEventListener('submit',e=>e.preventDefault(),{signal});
  proses(key,daftar);
  return true;
}
