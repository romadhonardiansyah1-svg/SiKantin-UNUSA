import { keluar, layananAktif, profilAktif, sesiAktif } from '../api.js';

export const dasbor = { admin: '/admin', pemilik: '/pemilik/laporan' };

const desktop = document.getElementById('publicAuthNavBtn');
const ponsel = document.querySelector('#mobileNavDrawer a[href="/masuk"]');
const footer = document.querySelectorAll('footer a:is([href="/masuk"], [href="/daftar"])');
const navigasiAkun = [desktop, ponsel].map(tautan => {
  const label = tautan.querySelector('span') ?? tautan;
  const teksMasuk = label.textContent;
  const tombol = document.createElement('button');
  tombol.className = 'nav-btn-subtle';
  tombol.type = 'button';
  tombol.textContent = 'Keluar';
  tombol.hidden = tautan.hidden = true;
  if (tautan === ponsel) tombol.style.minHeight = '44px';
  const pesan = document.createElement('small');
  pesan.className = 'field-error';
  pesan.setAttribute('role', 'status');
  pesan.hidden = true;
  tautan.after(tombol, pesan);
  tombol.addEventListener('click', async () => {
    tombol.disabled = true;
    pesan.hidden = true;
    try { await keluar(); }
    catch (error) {
      pesan.textContent = error.message;
      pesan.hidden = false;
    } finally { tombol.disabled = false; }
  });
  return { tautan, label, teksMasuk, tombol, pesan };
});
for (const tautan of footer) tautan.hidden = true;

function tampilAkun() {
  const tujuan = dasbor[profilAktif?.peran];
  for (const { tautan, label, teksMasuk, tombol, pesan } of navigasiAkun) {
    tautan.href = tujuan ?? '/masuk';
    label.textContent = tujuan ? 'Dasbor' : teksMasuk;
    tautan.hidden = profilAktif?.peran === 'pelanggan';
    tombol.hidden = !tautan.hidden;
    pesan.hidden = true;
  }
  for (const tautan of footer) tautan.hidden = Boolean(profilAktif);
}

document.addEventListener('sesi-berubah', tampilAkun);
layananAktif().then(aktif => aktif ? sesiAktif() : tampilAkun()).catch(tampilAkun);
