export const aspek = ['Cita rasa', 'Kebersihan', 'Porsi', 'Kualitas bahan', 'Pembayaran'];
export const kunciAspek = ['rasa', 'kebersihan', 'porsi', 'kualitas', 'cara_pembayaran'];
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const harga = nilai => rupiah.format(nilai);
export const skor = nilai => nilai.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const detailUrl = tenant => '/tenant/' + encodeURIComponent(tenant.slug);
export function jamOperasional({ jam_buka, jam_tutup }) {
  if (!jam_buka || !jam_tutup) return '';
  const buka = jam_buka.slice(0, 5).replace(':', '.');
  const tutup = jam_tutup.slice(0, 5).replace(':', '.');
  return buka + '–' + tutup + ' WIB' + (tutup < buka ? ' (tutup esok hari)' : '');
}
export const surveiUrl = tenant => detailUrl(tenant) + '/survei';

export function statistik(ulasan) {
  if (!ulasan.length) return { nilai: null, aspek: aspek.map(() => null), jumlah: 0 };
  const rata = nilai => nilai.length ? nilai.reduce((a, b) => a + b, 0) / nilai.length : null;
  const skor = nilai => Number.isFinite(nilai);
  return {
    nilai: rata(ulasan.flatMap(u => u.aspek).filter(skor)),
    aspek: aspek.map((_, i) => rata(ulasan.map(u => u.aspek[i]).filter(skor))),
    jumlah: ulasan.length
  };
}
export const statistikTenant = tenant => tenant.statistik ?? statistik(tenant.ulasan);

export function filterKatalog(daftar, params) {
  const kampus = params.get('kampus');
  const kategori = params.get('kategori');
  const kata = (params.get('q') || '').trim().toLocaleLowerCase('id');
  const hasil = daftar.filter(t => {
    const menu = kategori ? t.menu.filter(m => m.kategori === kategori) : t.menu;
    return (!kampus || t.kampus === kampus) && (!kategori || menu.length > 0)
      && [t.nama, ...menu.map(m => m.nama)].some(n => n.toLocaleLowerCase('id').includes(kata));
  });
  switch (params.get('urut')) {
    case 'name_asc': return hasil.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    case 'reviews_desc': return hasil.sort((a, b) => statistikTenant(b).jumlah - statistikTenant(a).jumlah);
    case 'rating_desc': return hasil.sort((a, b) => (statistikTenant(b).nilai ?? 0) - (statistikTenant(a).nilai ?? 0));
    default: return hasil;
  }
}

export function tujuanSurvei(path, daftar) {
  return daftar.find(t => surveiUrl(t) === path);
}
