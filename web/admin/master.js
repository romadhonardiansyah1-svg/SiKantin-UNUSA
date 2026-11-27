import { id, isi, tabel } from '../admin-ui/pratinjau.js';
import { harga, kunciAspek, skor } from '../publik/katalog.js';
import { admin, aksiData, cocok, cocokStatus, dataForm, field, filterStatus, isiForm, jalankan, konfirmasiHapus,
  kelompok, pesanDi, pilih, segarkanKatalog, simpan, tanggal, tombol, val } from './kontrol.js';

const layar = {
  kampus: {
    form: 'adminCampusForm', judul: 'campusFormTitle', tabel: 'adminCampuses', nama: 'kampus',
    bidang: {
      campus_code: 'kode', campus_name: 'nama', campus_address: 'alamat', campus_total_stalls: 'jumlah_stand',
      campus_facility_info: 'fasilitas', campus_aktif: 'aktif'
    }
  },
  menu: {
    form: 'adminMenuForm', judul: 'menuFormTitle', tabel: 'adminMenus', nama: 'menu',
    bidang: {
      menu_form_tenant_id: 'tenant_id', menu_form_name: 'nama', menu_form_category: 'kategori', menu_form_price: 'harga',
      menu_form_description: 'deskripsi', menu_form_is_available: 'tersedia', menu_form_is_recommended: 'andalan',
      menu_form_active: 'aktif'
    }
  },
  pertanyaan: {
    form: 'adminQuestionForm', judul: 'questionFormTitle', tabel: 'adminQuestions', nama: 'butir pertanyaan',
    bidang: {
      question_form_type: 'tipe', question_form_aspect_label: 'label', question_form_key: 'kunci',
      question_form_question_text: 'teks', question_form_order_num: 'urutan',
      question_form_required: 'wajib', question_form_is_active: 'aktif'
    }
  }
};

function centang(form, key, label) {
  const input = field(form, key, label, 'checkbox');
  input.className = '';
  input.defaultChecked = true;
  form.querySelector('button[type="submit"]').before(input.parentElement);
}

export async function master(modul, { panel, signal, drawer }) {
  const config = layar[modul];
  const { bidang } = config;
  let [daftar, tenant] = await Promise.all([admin(modul), ['menu','kampus'].includes(modul) ? admin('tenant') : []]);
  if (signal.aborted) return;
  const form = id(config.form);
  const status = pesanDi(form, true);
  const statusDaftar = pesanDi(id(config.tabel + 'CountBadge').closest('.table-card'));
  const filter = filterStatus(config.tabel, gambar, signal);
  const simpanBtn = form.querySelector('button[type="submit"]');
  simpanBtn.disabled = false;
  let foto, editing;
  if (modul === 'kampus') {
    centang(form, 'campus_aktif', 'Tampilkan kampus di katalog');
    id('campus_code').maxLength = 10;
  }
  if (modul === 'menu') {
    centang(form, 'menu_form_active', 'Tampilkan menu di katalog');
    foto = field(form, 'menu_form_foto', 'Foto menu', 'file');
    foto.accept = 'image/jpeg,image/png,image/webp';
    simpanBtn.before(foto.parentElement);
    pilih('menu_form_tenant_id', tenant, t => t.nama, 'Pilih tenant');
    pilih('adminMenusFilterTenant', tenant, t => t.nama, 'Semua tenant');
    id('menu_form_price').step = '1';
  }
  const namaTenant = new Map(tenant.map(t => [t.id,t.nama]));
  function edit(data, trigger) {
    editing = data.id ?? null;
    form.reset();
    isiForm(bidang, data);
    status('');
    isi(config.judul, (editing ? 'Ubah ' : 'Tambah ') + config.nama);
    if (modul === 'menu') id('menu_form_tenant_id').disabled = Boolean(editing);
    if (modul === 'pertanyaan') {
      const inti = kunciAspek.includes(data.kunci);
      id('question_form_key').readOnly = Boolean(editing);
      id('question_form_type').disabled = inti;
      const aktif = id('question_form_is_active');
      aktif.disabled = inti;
      if (inti) aktif.checked = true;
    }
    drawer(true, trigger);
  }
  function gambar() {
    const daftarTampil = daftar.filter(m => cocokStatus(m, filter) && (modul !== 'menu' || (
      cocok(val('adminMenusSearch'),m.nama,m.deskripsi) &&
      (!val('adminMenusFilterTenant') || m.tenant_id === val('adminMenusFilterTenant')) &&
      (!val('adminMenusFilterCategory') || m.kategori === val('adminMenusFilterCategory')))));
    tabel(config.tabel + 'TableBody', daftarTampil.map(data => {
      const inti = modul === 'pertanyaan' && kunciAspek.includes(data.kunci);
      const ubah = tombol('Ubah', button => edit(data,button));
      const tindakan = inti && data.aktif ? [] : aksiData(modul, data, statusDaftar, hapus => {
        if (signal.aborted) return;
        if (hapus) daftar = daftar.filter(row => row.id !== data.id);
        gambar();
        filter.focus();
      });
      const aksi = kelompok(ubah, ...(inti ? tindakan.slice(0, 1) : tindakan));
      if (modul === 'kampus') return [data.kode, [data.nama,data.alamat].filter(Boolean).join(' · '),
        data.fasilitas || '—', tenant.filter(t => t.kampus_id === data.id && t.aktif).length + ' / ' + data.jumlah_stand, aksi];
      if (modul === 'menu') return [data.nama + ' · ' + data.kategori, namaTenant.get(data.tenant_id) || '—',
        harga(data.harga), data.aktif ? (data.tersedia ? 'Tersedia' : 'Habis') : 'Diarsipkan', aksi];
      return [data.urutan, data.label + ' · ' + data.kunci, { rating: 'Bintang', text: 'Teks', boolean: 'Ya / Tidak' }[data.tipe],
        data.teks, data.aktif ? (data.wajib ? 'Aktif · Wajib' : 'Aktif') : 'Diarsipkan', aksi];
    }));
    isi(config.tabel + 'CountBadge', daftarTampil.length + ' ' + config.nama);
  }
  panel.querySelector('[data-drawer="open"]').addEventListener('click', event => edit({},event.currentTarget), { signal });
  if (modul === 'menu') {
    id('adminMenusSearch').addEventListener('input', gambar, { signal });
    id('adminMenusFilterTenant').addEventListener('change', gambar, { signal });
    id('adminMenusFilterCategory').addEventListener('change', gambar, { signal });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    jalankan(simpanBtn, status, async () => {
      const data = dataForm(bidang);
      const hasil = await simpan(modul, editing, data, foto?.files[0]);
      editing = hasil.id;
      segarkanKatalog();
      const terbaru = await admin(modul);
      if (signal.aborted) return;
      daftar = terbaru;
      if (!cocokStatus(data, filter)) filter.value = data.aktif ? 'aktif' : 'arsip';
      drawer(false);
      gambar();
      panel.querySelector('[data-drawer="open"]').focus();
    });
  }, { signal });
  gambar();
}

const statusUlasan = { menunggu: 'Menunggu', tayang: 'Tayang', sembunyi: 'Disembunyikan', spam: 'Spam' };
export async function moderasi({ panel, signal }) {
  const [tenant, daftar] = await Promise.all([admin('tenant'),admin('ulasan')]);
  if (signal.aborted) return;
  pilih('adminReviewsFilterTenant', tenant, t => t.nama, 'Semua tenant');
  const filter = id('adminReviewsFilterStatus');
  filter.replaceChildren(new Option('Semua status', ''),
    ...Object.entries(statusUlasan).map(([key,nama]) => new Option(nama,key)));
  const status = pesanDi(panel.querySelector('#screen-admin-reviews'));
  function gambar() {
    const t = val('adminReviewsFilterTenant');
    const rows = daftar.filter(u => u.status !== 'dihapus' && (!t || u.tenant_id === t)
      && (!filter.value || u.status === filter.value) && cocok(val('adminReviewsSearch'),u.komentar,u.tenant,...(u.menu ?? [])));
    tabel('adminReviewsTableBody', rows.map(u => {
      const aksi = [['Tampilkan kembali','tayang'],['Sembunyikan','sembunyi'],['Tandai spam','spam'],['Hapus','dihapus']]
        .filter(([,target]) => u.status !== target)
        .map(([label,target]) => tombol(label, button => {
          const ubah = () => jalankan(button, status, async () => {
            await simpan('ulasan',u.id,{ status: target });
            u.status = target;
            segarkanKatalog();
            if (!signal.aborted) gambar();
          });
          if (target === 'dihapus') konfirmasiHapus(button, 'Hapus ulasan?', 'Ulasan akan dihapus dari moderasi dan laporan.', ubah);
          else ubah();
        }));
      const detail = document.createElement('details');
      const judul = document.createElement('summary');
      judul.textContent = [(u.nilai == null ? '—' : skor(u.nilai)), u.komentar].filter(Boolean).join(' · ');
      const jawaban = document.createElement('ul');
      for (const q of u.jawaban ?? []) {
        const li = document.createElement('li');
        li.textContent = q.label + ' · ' + (typeof q.nilai === 'boolean' ? q.nilai ? 'Ya' : 'Tidak' : q.nilai);
        jawaban.append(li);
      }
      if (u.menu?.length) {
        const menu = document.createElement('p');
        menu.textContent = 'Menu · ' + u.menu.join(', ');
        detail.append(judul, menu, jawaban);
      } else detail.append(judul,jawaban);
      return [tanggal.format(new Date(u.waktu)) + ' WIB · ' + u.responden, u.tenant, detail, statusUlasan[u.status], kelompok(...aksi)];
    }));
    isi('adminReviewsCountBadge', rows.length + ' ulasan');
  }
  for (const k of ['adminReviewsFilterTenant','adminReviewsFilterStatus']) id(k).addEventListener('change', gambar, { signal });
  id('adminReviewsSearch').addEventListener('input', gambar, { signal });
  gambar();
}
