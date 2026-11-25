import { emailPelangganValid } from './domain.js';
import { detailUrl, surveiUrl } from '../publik/katalog.js';

const id = nama => document.getElementById(nama);
export function tampilkanAkun(daftar, tenant, internal) {
  id('unifiedLoginForm').hidden = daftar;
  id('unifiedRegisterForm').hidden = !daftar;
  id('unifiedRegisterForm').style.removeProperty('display');
  id('authCardTitle').textContent = daftar ? 'Daftar Akun SiKantin' : 'Masuk ke SiKantin UNUSA';
  id('authCardSubtitle').textContent = tenant ? 'Beri ulasan untuk ' + tenant.nama + '.' : internal ? 'Masuk dengan akun pengelola atau pemilik tenant.' : 'Gunakan akun SiKantin Anda.';
  id('authLoginIdentifier').type = internal ? 'text' : 'email';
  id('authLoginIdentifier').placeholder = internal ? 'Email atau nama pengguna' : 'nama@student.unusa.ac.id';
  document.querySelector('label[for="authLoginIdentifier"]').textContent = internal ? 'Email atau nama pengguna' : 'Email';
  const notice = id('authNotice');
  notice.replaceChildren('Layanan akun belum aktif di pratinjau ini.');
  if (tenant) {
    const link = document.createElement('a');
    link.href = '/pratinjau' + surveiUrl(tenant);
    link.textContent = 'Coba formulir survei';
    const kembali = document.createElement('a');
    kembali.href = detailUrl(tenant);
    kembali.textContent = 'Kembali ke ' + tenant.nama;
    notice.append(document.createElement('br'), link, ' · ', kembali);
  }
  const suffix = tenant ? '?kembali=' + encodeURIComponent(surveiUrl(tenant)) : '';
  id('unifiedLoginForm').querySelector('a').href = '/daftar' + suffix;
  id('unifiedRegisterForm').querySelector('a').href = '/masuk' + suffix;
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
for (const form of [id('unifiedLoginForm'), id('unifiedRegisterForm')]) {
  form.addEventListener('submit', event => event.preventDefault());
}
