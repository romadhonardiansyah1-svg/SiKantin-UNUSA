import { emailPelangganValid } from './domain.js';
import { dasbor } from './navigasi.js';
import { detailUrl, surveiUrl } from '../publik/katalog.js';
import { api, catatSesi, keluar, navigasi } from '../api.js';

const id = nama => document.getElementById(nama);
const masuk = id('unifiedLoginForm');
const baru = id('unifiedRegisterForm');
const notice = id('authNotice');
let tujuan = '';
let staf = false;
let aktif = false;

function tautan(href, nama) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = nama;
  return link;
}
function tombol(nama, aksi) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = nama;
  button.className = 'btn btn-primary btn-block';
  button.addEventListener('click', () => jalankan(button, 'Memproses…', aksi));
  return button;
}
async function jalankan(button, pesan, aksi) {
  if (button.disabled) return;
  notice.querySelector('[data-auth-error]')?.remove();
  button.disabled = true;
  const teks = button.textContent;
  button.textContent = pesan;
  try { await aksi(); }
  catch (error) {
    const feedback = document.createElement('p');
    feedback.dataset.authError = '';
    feedback.className = 'field-error';
    feedback.textContent = error.message;
    notice.append(feedback);
  }
  finally { button.textContent = teks; button.disabled = false; }
}
function sesudahMasuk(profil) {
  catatSesi(profil);
  navigasi(dasbor[profil.peran] || profil.kembali || '/');
}

function pemberitahuanDaftar(pemicu, pesan) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'judulPendaftaran');
  dialog.setAttribute('aria-describedby', 'pesanPendaftaran');
  Object.assign(dialog.style, {
    width: 'min(26rem, calc(100% - 2rem))', margin: 'auto', padding: '1.25rem',
    color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)'
  });
  dialog.innerHTML = `
    <h2 id="judulPendaftaran">Pendaftaran diterima</h2>
    <p id="pesanPendaftaran" class="status-note"></p>
    <form method="dialog"><button class="btn btn-primary btn-block" autofocus>Tutup</button></form>`;
  dialog.querySelector('p').textContent = pesan;
  dialog.addEventListener('close', () => {
    dialog.remove();
    pemicu.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

export function tampilkanAkun(daftar, tenant, internal, operasional = false, profil = null) {
  aktif = operasional;
  staf = internal;
  tujuan = tenant ? surveiUrl(tenant) : '';
  id('unifiedLoginForm').hidden = daftar;
  id('unifiedRegisterForm').hidden = !daftar;
  id('unifiedRegisterForm').style.removeProperty('display');
  id('authCardTitle').textContent = daftar ? 'Daftar Akun SiKantin' : 'Masuk ke SiKantin UNUSA';
  id('authCardSubtitle').textContent = tenant ? 'Beri ulasan untuk ' + tenant.nama + '.' : internal ? 'Masuk dengan akun pengelola atau pemilik tenant.' : 'Gunakan akun SiKantin Anda.';
  id('authLoginIdentifier').type = internal ? 'text' : 'email';
  id('authLoginIdentifier').placeholder = internal ? 'Email atau nama pengguna' : 'nama@student.unusa.ac.id';
  document.querySelector('label[for="authLoginIdentifier"]').textContent = internal ? 'Email atau nama pengguna' : 'Email';
  for (const form of [masuk, baru]) {
    form.querySelector('button[type="submit"]').disabled = !aktif;
    form.querySelector('input[type="password"]').disabled = !aktif;
  }
  notice.replaceChildren();
  notice.hidden = false;
  if (profil) {
    masuk.hidden = baru.hidden = true;
    id('authCardTitle').textContent = 'Akun SiKantin';
    const path = dasbor[profil.peran] || tujuan || '/';
    const teks = profil.peran === 'pelanggan' ? (tujuan ? 'Lanjut ke survei' : 'Kembali ke katalog') : 'Buka dasbor';
    notice.append(tautan(path, teks), tombol('Keluar', keluar));
    return;
  }
  if (!aktif) notice.append('Layanan akun belum aktif di pratinjau ini. ');
  if (aktif && !daftar && new URLSearchParams(location.search).get('konfirmasi') === 'berhasil') {
    notice.append('Email sudah terkonfirmasi. Masuk untuk melanjutkan. ');
  }
  if (tenant) {
    if (!aktif) notice.append(tautan('/pratinjau' + tujuan, 'Coba formulir survei'), ' · ');
    notice.append(tautan(detailUrl(tenant), 'Kembali ke ' + tenant.nama));
  } else if (aktif && !internal) notice.append(tautan('/masuk?akses=internal', 'Masuk sebagai pengelola atau pemilik'));
  notice.hidden = !notice.hasChildNodes();
  const suffix = tujuan ? '?kembali=' + encodeURIComponent(tujuan) : '';
  masuk.querySelector('a').href = '/daftar' + suffix;
  baru.querySelector('a').href = '/masuk' + suffix;
}

export function tampilkanKonfirmasi(hash, tenant) {
  const tersimpan = history.state?.konfirmasiEmail;
  const params = new URLSearchParams(location.search);
  const token = hash || params.get('token_hash') || tersimpan?.token;
  const kembali = tenant ? surveiUrl(tenant) : tersimpan?.kembali || params.get('kembali');
  const tujuanMasuk = new URLSearchParams();
  if (kembali && kembali !== '/') tujuanMasuk.set('kembali', kembali);
  const keMasuk = '/masuk' + (tujuanMasuk.size ? '?' + tujuanMasuk : '');
  const fragmen = new URLSearchParams(location.hash.slice(1));
  if (!token && fragmen.get('type') === 'signup' && fragmen.has('access_token')) {
    // Tautan bawaan Supabase sudah memverifikasi akun sebelum mengalihkan.
    location.replace(keMasuk);
    return;
  }
  masuk.hidden = baru.hidden = true;
  id('authCardTitle').textContent = 'Konfirmasi email';
  id('authCardSubtitle').textContent = tenant ? 'Lanjutkan pendaftaran untuk mengulas ' + tenant.nama + '.' : 'Aktifkan akun SiKantin Anda.';
  notice.hidden = false;
  if (!token || tersimpan?.berhasil) {
    const kedaluwarsa = (fragmen.get('error_code') || params.get('error_code')) === 'otp_expired';
    let pesan = 'Tautan konfirmasi tidak lengkap. Buka tautan terbaru dari email pendaftaran.';
    if (tersimpan?.berhasil) pesan = 'Email sudah terkonfirmasi.';
    else if (kedaluwarsa) pesan = 'Tautan konfirmasi kedaluwarsa atau sudah digunakan. Jika akun sudah aktif, silakan masuk.';
    notice.replaceChildren(pesan + ' ', tautan(keMasuk, 'Masuk'));
    return;
  }
  history.replaceState({ ...history.state, konfirmasiEmail: { token, kembali } }, '', '/konfirmasi');
  notice.replaceChildren(tombol('Konfirmasi email', async () => {
    await api('/auth/konfirmasi', { method: 'POST', sesi: false, data: { token_hash: token } });
    history.replaceState({ ...history.state, konfirmasiEmail: { kembali, berhasil: true } }, '', '/konfirmasi');
    catatSesi(null);
    tujuanMasuk.set('konfirmasi', 'berhasil');
    navigasi('/masuk?' + tujuanMasuk);
  }), tautan(keMasuk, 'Sudah konfirmasi? Masuk'));
}
const email = id('authRegEmail');
function periksaEmail() {
  const pesan = email.value && !emailPelangganValid(email.value) ? 'Gunakan @gmail.com, @unusa.ac.id, atau @student.unusa.ac.id.' : '';
  email.setCustomValidity(pesan);
  email.setAttribute('aria-invalid', String(Boolean(pesan)));
  id('domainError').textContent = pesan;
}
email.addEventListener('blur', periksaEmail);
email.addEventListener('input', periksaEmail);
masuk.addEventListener('submit', event => {
  event.preventDefault();
  if (!aktif) return;
  notice.hidden = false;
  jalankan(masuk.querySelector('button'), 'Sedang masuk…', async () => {
    const profil = await api('/auth/masuk', { method: 'POST', sesi: false, data: {
      identitas: id('authLoginIdentifier').value, sandi: id('authLoginPassword').value, internal: staf, kembali: tujuan
    } });
    masuk.reset();
    sesudahMasuk(profil);
  });
});
baru.addEventListener('submit', event => {
  event.preventDefault();
  if (!aktif) return;
  notice.hidden = false;
  const pemicu = baru.querySelector('button[type="submit"]');
  jalankan(pemicu, 'Mendaftar…', async () => {
    const hasil = await api('/auth/daftar', { method: 'POST', sesi: false, data: {
      nama: id('authRegName').value, email: email.value, sandi: id('authRegPassword').value,
      status: id('authRegStatus').value, kembali: tujuan
    } });
    id('authRegPassword').value = '';
    notice.textContent = hasil.pesan;
    if (baru.getClientRects().length) pemberitahuanDaftar(pemicu, hasil.pesan);
  });
});
