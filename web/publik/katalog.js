export const aspek = ['Cita rasa', 'Kebersihan', 'Porsi', 'Kualitas bahan', 'Pembayaran'];
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const harga = nilai => rupiah.format(nilai);
export const skor = nilai => nilai.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const detailUrl = tenant => '/tenant/' + encodeURIComponent(tenant.slug);
export const surveiUrl = tenant => detailUrl(tenant) + '/survei';

export function statistik(ulasan) {
  if (!ulasan.length) return { nilai: null, aspek: aspek.map(() => null), jumlah: 0 };
  const rerata = aspek.map((_, i) => ulasan.reduce((total, u) => total + u.aspek[i], 0) / ulasan.length);
  return { nilai: rerata.reduce((a, b) => a + b, 0) / rerata.length, aspek: rerata, jumlah: ulasan.length };
}

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
    case 'reviews_desc': return hasil.sort((a, b) => b.ulasan.length - a.ulasan.length);
    case 'rating_desc': return hasil.sort((a, b) => (statistik(b.ulasan).nilai ?? 0) - (statistik(a.ulasan).nilai ?? 0));
    default: return hasil;
  }
}

export function tujuanSurvei(path, daftar) {
  return daftar.find(t => surveiUrl(t) === path);
}
