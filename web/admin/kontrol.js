import { api, keluar, segarkanKatalog } from '../api.js';

const id = nama => document.getElementById(nama);
export function pilih(key, daftar, label, semua) {
  const el = id(key);
  el.replaceChildren(...(semua !== undefined ? [new Option(semua, '')] : []),
    ...daftar.map(x => new Option(label(x), x.id)));
}
export function tombol(label, klik) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-outline preview-action';
  b.style.whiteSpace = 'nowrap';
  b.textContent = label;
  b.addEventListener('click', () => klik(b));
  return b;
}
export function kelompok(...nodes) {
  const wrap = document.createElement('div');
  wrap.className = 'admin-aksi';
  for (const node of nodes) {
    if (node instanceof HTMLAnchorElement) node.style.whiteSpace = 'nowrap';
  }
  wrap.append(...nodes);
  return wrap;
}
export function unduh(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = nama;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function pesanDi(wadah, diForm = false) {
  const el = document.createElement('p');
  el.className = 'status-note';
  el.hidden = true;
  el.setAttribute('role', 'status');
  if (diForm) wadah.querySelector('button[type="submit"]').before(el);
  else wadah.prepend(el);
  return pesan => { el.textContent = pesan; el.hidden = !pesan; };
}
export async function jalankan(button, status, aksi) {
  if (button.disabled) return;
  button.disabled = true;
  status('');
  try { await aksi(); }
  catch (error) { status(error.message); }
  finally { button.disabled = false; }
}
export function pasangKeluar(link) {
  if (!link) return;
  const status = pesanDi(link.parentElement);
  const tombolKeluar = tombol('Keluar', button => jalankan(button, status, keluar));
  tombolKeluar.className = link.className;
  link.replaceWith(tombolKeluar);
}
export const admin = modul => api('/admin/' + modul);
export function simpan(modul, id, data, foto) {
  if (foto?.size) {
    const body = new FormData();
    body.set('data', JSON.stringify(data));
    body.set('foto', foto);
    data = body;
  }
  return api('/admin/' + modul + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', data });
}

export function filterStatus(key, gambar, signal) {
  const hitung = id(key + 'CountBadge');
  const filter = document.createElement('select');
  filter.setAttribute('aria-label', 'Status data');
  filter.className = 'form-control';
  filter.style.width = 'auto';
  filter.append(new Option('Aktif', 'aktif'), new Option('Diarsipkan', 'arsip'), new Option('Semua status', 'semua'));
  hitung.before(kelompok(filter));
  filter.parentElement.append(hitung);
  filter.addEventListener('change', gambar, { signal });
  return filter;
}

export const cocokStatus = (data, filter) => filter.value === 'semua' || data.aktif === (filter.value === 'aktif');

export function konfirmasiHapus(pemicu, judul, pesan, hapus) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', judul);
  Object.assign(dialog.style, {
    maxWidth: 'min(26rem, calc(100% - 2rem))', padding: '1.25rem',
    color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)'
  });
  const judulDialog = document.createElement('h3');
  judulDialog.textContent = judul;
  const keterangan = document.createElement('p');
  keterangan.textContent = pesan;
  const batal = tombol('Batal', () => dialog.close());
  batal.autofocus = true;
  const setuju = tombol('Hapus sekarang', () => dialog.close('hapus'));
  setuju.classList.replace('btn-outline', 'btn-danger');
  dialog.append(judulDialog, keterangan, kelompok(batal, setuju));
  pemicu.after(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue === 'hapus') hapus();
  }, { once: true });
  dialog.showModal();
}

export function aksiData(modul, data, status, selesai) {
  let sibuk = false;
  const url = '/admin/' + modul + '/' + data.id;
  const aktif = !data.aktif;
  function ubah(hapus, button) {
    if (sibuk) return;
    sibuk = true;
    return jalankan(button, status, async () => {
      await api(url, hapus ? { method: 'DELETE' } : { method: 'PATCH', data: { aktif } });
      if (!hapus) data.aktif = aktif;
      segarkanKatalog();
      selesai(hapus);
      status(hapus ? 'Data dihapus.' : aktif ? 'Data diaktifkan.' : 'Data diarsipkan.');
    }).finally(() => { sibuk = false; });
  }
  const tindakan = [tombol(aktif ? 'Aktifkan' : 'Arsipkan', button => ubah(false, button))];
  if (data.alasan_hapus) {
    const alasan = document.createElement('small');
    alasan.textContent = data.alasan_hapus;
    tindakan.push(alasan);
  } else {
    const pesan = modul === 'tenant' ? 'Menu dan QR tenant ikut dihapus. Akses pemilik dicabut.'
      : 'Data ini akan dihapus secara permanen.';
    tindakan.push(tombol('Hapus', button => {
      if (!sibuk) konfirmasiHapus(button, 'Hapus ' + (data.nama || data.label) + '?', pesan, () => ubah(true, button));
    }));
  }
  return tindakan;
}
export { segarkanKatalog };
export const tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
export const cocok = (q, ...data) => data.join(' ').toLocaleLowerCase('id').includes(q.trim().toLocaleLowerCase('id'));
export const val = key => id(key)?.value || '';

export function isiForm(bidang, data) {
  for (const [key, nama] of Object.entries(bidang)) {
    const input = id(key);
    input.disabled = false;
    if (input.type === 'checkbox') input.checked = data[nama] === undefined ? input.defaultChecked : data[nama];
    else if (data[nama] != null) input.value = data[nama];
  }
}
export function dataForm(bidang) {
  return Object.fromEntries(Object.entries(bidang).map(([key,nama]) => {
    const input = id(key);
    return [nama, input.type === 'checkbox' ? input.checked : input.value.trim()];
  }));
}
export function field(wadah, key, label, tipe = 'text') {
  const div = document.createElement('div');
  div.className = 'form-group';
  const nama = document.createElement('label');
  nama.className = 'form-label';
  nama.htmlFor = key;
  nama.textContent = label;
  const input = document.createElement('input');
  input.type = tipe;
  input.id = key;
  input.className = 'form-control';
  div.append(nama, input);
  wadah.append(div);
  return input;
}
