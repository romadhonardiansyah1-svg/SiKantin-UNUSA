import { api, navigasi } from '../api.js';

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
  b.textContent = label;
  b.addEventListener('click', () => klik(b));
  return b;
}
export function kelompok(...nodes) {
  const wrap = document.createElement('div');
  wrap.className = 'admin-aksi';
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
  const keluar = tombol('Keluar', button => jalankan(button, status, async () => {
    await api('/auth/keluar', { method: 'POST', sesi: false });
    navigasi('/');
  }));
  keluar.className = link.className;
  link.replaceWith(keluar);
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
export const segarkanKatalog = () => document.dispatchEvent(new Event('katalog-berubah'));
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
