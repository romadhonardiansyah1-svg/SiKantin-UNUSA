import { api } from '../api.js';
import { grafik, id, isi, tabel, tautan } from '../admin-ui/pratinjau.js';
import { aspek, skor } from '../publik/katalog.js';
import { admin, jalankan, pesanDi, pilih, tanggal, unduh, val } from '../admin/kontrol.js';

const nilai = x => x == null ? '—' : skor(x);
const daftarJam = Array.from({ length: 24 }, (_, jam) => String(jam).padStart(2, '0') + ':00');
const periode = { '3_months': 3, '6_months': 6, '1_year': 12 };

function grafikLaporan(a, b, laporan) {
  grafik(a, 'Skor per aspek', 'bar', aspek, laporan.statistik.aspek);
  grafik(b, 'Waktu pengisian ulasan (WIB)', 'line', daftarJam, laporan.jam);
  const bagianJam = id(b).parentElement.parentElement;
  bagianJam.querySelector('h3,h4').textContent = 'Waktu pengisian ulasan (WIB)';
  const p = bagianJam.querySelector('p');
  const puncak = Math.max(...laporan.jam);
  if (p) p.textContent = puncak ? 'Paling banyak pada ' + daftarJam[laporan.jam.indexOf(puncak)] + ' WIB.' : 'Belum ada ulasan pada periode ini.';
}

function komentar(key, rows) {
  const list = id(key);
  list.replaceChildren();
  const tampil = rows.filter(u => u.komentar);
  if (!tampil.length) { list.textContent = 'Belum ada komentar.'; return; }
  for (const u of tampil) {
    const item = document.createElement('article');
    item.className = 'review-card';
    const label = document.createElement('strong');
    label.textContent = [u.tenant,u.status,tanggal.format(new Date(u.waktu)) + ' WIB'].join(' · ');
    const isi = document.createElement('p');
    isi.textContent = u.komentar;
    item.append(label,isi);
    list.append(item);
  }
}

const lihatLaporan = params => {
  const query = new URLSearchParams(Object.entries(params).filter(([,value]) => value));
  return api('/laporan' + (query.size ? '?' + query : ''));
};

export async function dasbor({ panel, signal }) {
  const [kampus, laporan] = await Promise.all([admin('kampus'),lihatLaporan({})]);
  if (signal.aborted) return;
  pilih('adminDashboardCampusFilter', kampus, k => k.nama, 'Semua kampus');
  isi('adminSumberUlasan', 'Ringkasan ulasan yang tayang.');
  const filter = id('adminDashboardCampusFilter');
  const status = pesanDi(panel.querySelector('#screen-admin-dashboard'));
  id('adminAttentionCard').hidden = true;
  function gambar(data) {
    isi('adminStatTenants', data.per_tenant.length);
    isi('adminStatMenus', data.jumlah_menu);
    isi('adminStatReviews', data.statistik.jumlah);
    isi('adminStatAvgRating', nilai(data.statistik.nilai));
    grafikLaporan('aspectChart','peakHoursChart',data);
    tabel('adminDashboardLatestReviewsBody', data.ulasan.slice(0,5).map(u =>
      [tanggal.format(new Date(u.waktu)) + ' WIB',u.tenant,u.status,nilai(u.nilai),u.komentar || '—']));
    const list = id('adminDashboardTopTenantsList');
    const top = data.per_tenant.filter(t => t.statistik.nilai != null)
      .sort((a,b) => b.statistik.nilai - a.statistik.nilai).slice(0,5);
    list.replaceChildren(...top.map(t => tautan('/admin/laporan?tenant=' + t.id, t.nama + ' · ' + nilai(t.statistik.nilai))));
    if (!top.length) list.textContent = 'Belum ada penilaian.';
  }
  gambar(laporan);
  filter.addEventListener('change', async () => {
    const dipilih = filter.value;
    status('');
    try {
      const data = await lihatLaporan({ kampus: dipilih });
      if (!signal.aborted && filter.value === dipilih) gambar(data);
    } catch (error) { status(error.message); }
  }, { signal });
}

export async function laporanAdmin({ panel, signal }) {
  const [kampus, tenant] = await Promise.all([admin('kampus'),admin('tenant')]);
  if (signal.aborted) return;
  pilih('reportFilterCampus', kampus, k => k.nama, 'Semua kampus');
  pilih('reportFilterTenant', tenant, t => t.nama, 'Semua tenant');
  isi('reportSumber', 'Skor dihitung dari jawaban aspek inti pada ulasan yang tayang.');
  isi('reportTanda', 'Pengelola kantin');
  const awal = new URLSearchParams(location.search).get('tenant');
  if (tenant.some(t => t.id === awal)) id('reportFilterTenant').value = awal;
  const status = pesanDi(panel.querySelector('#screen-admin-report'));
  const terapkan = panel.querySelector('[data-filter]');
  const xlsx = panel.querySelector('button[disabled]');
  const print = panel.querySelector('[data-print]');
  xlsx.removeAttribute('title');
  let hasil, judulPeriode, waktu;
  async function muat() {
    const pilihan = id('reportFilterPeriod').selectedOptions[0];
    const data = await lihatLaporan({ tenant: val('reportFilterTenant'), kampus: val('reportFilterCampus'), bulan: periode[pilihan.value] });
    if (signal.aborted) return;
    hasil = data;
    judulPeriode = pilihan.textContent;
    waktu = tanggal.format(new Date()) + ' WIB';
    isi('periodeContoh', judulPeriode);
    isi('waktuLaporan', waktu);
    isi('reportKpiReviews', data.statistik.jumlah);
    isi('reportKpiAvg', nilai(data.statistik.nilai));
    isi('reportKpiStatus', 'Kriteria belum ditetapkan');
    tabel('evaluationReportTableBody', data.per_tenant.map((t,i) => [
      i + 1, [t.kode_stand,t.nama].filter(Boolean).join(' · '),t.kampus,t.pemilik || '—',
      ...t.statistik.aspek.map(nilai),nilai(t.statistik.nilai),t.statistik.jumlah,'—'
    ]));
    komentar('reportCommentsList', data.ulasan);
    grafikLaporan('reportAspectChart','reportPeakChart',data);
    xlsx.disabled = print.disabled = false;
  }
  terapkan.addEventListener('click', () => jalankan(terapkan, status, muat), { signal });
  xlsx.addEventListener('click', () => jalankan(xlsx, status, async () => {
    const { buatXlsx } = await import('./ekspor.js');
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    unduh(new Blob([buatXlsx(hasil,judulPeriode,waktu)], { type: mime }), 'laporan-sikantin.xlsx');
  }), { signal });
  print.disabled = true;
  await muat();
}

export async function laporanPemilik({ panel, signal }) {
  const data = await lihatLaporan({});
  if (signal.aborted) return;
  const judul = panel.querySelector('h1');
  judul.textContent = 'Portal Evaluasi · ' + data.tenant;
  judul.nextElementSibling.hidden = true;
  const stand = panel.querySelector('.badge-stall');
  stand.textContent = data.kode_stand || '';
  stand.hidden = !data.kode_stand;
  panel.querySelector('.badge-campus').textContent = data.kampus_nama;
  panel.querySelector('.badge').textContent = 'Pemilik tenant';
  panel.querySelector('a[href^="/admin/qr"]').remove();
  panel.querySelector('a[href^="/tenant/"]').href = '/tenant/' + data.slug;
  isi('tenantKpiAvg', nilai(data.statistik.nilai));
  isi('tenantKpiReviews', data.statistik.jumlah);
  isi('tenantKpiMenus', data.jumlah_menu);
  const terbaik = Math.max(0,...data.statistik.aspek);
  isi('tenantKpiBestAspect', terbaik ? aspek[data.statistik.aspek.indexOf(terbaik)] : '—');
  isi('tenantKpiBestScore', terbaik ? 'Aspek terbaik · ' + nilai(terbaik) + ' / 5' : 'Belum ada penilaian');
  id('tenantPortalReviewsList').previousElementSibling.textContent = 'Komentar yang tampil di katalog untuk tenant ini.';
  komentar('tenantPortalReviewsList',data.ulasan);
  grafikLaporan('tenantAspectChart','tenantPeakChart',data);
}
