import { fotoSlide, muatSlide, ubahSlide } from '../publik/slide.js';
import { jalankan, pesanDi, simpan } from './kontrol.js';

export function pasangSlide({ panel, signal }) {
  const bagian = document.createElement('details');
  bagian.id = 'adminSlideBeranda';
  bagian.className = 'stat-card';
  bagian.style.marginBottom = '1rem';
  bagian.innerHTML = `
    <summary><strong>Gambar slide beranda</strong></summary>
    <form style="max-width:26rem; margin-top:1rem">
      <fieldset style="border:0; padding:0; margin:0; min-width:0" disabled>
        <div class="form-group">
          <label class="form-label" for="nomorSlide">Nomor slide</label>
          <select class="form-control" id="nomorSlide">
            <option value="1">Slide 1</option><option value="2">Slide 2</option><option value="3">Slide 3</option>
          </select>
        </div>
        <img alt="" decoding="async" style="display:block; width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:.5rem; margin-bottom:.8rem">
        <div class="form-group">
          <label class="form-label" for="deskripsiSlide">Deskripsi gambar</label>
          <input class="form-control" id="deskripsiSlide" maxlength="120" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="berkasSlide">Gambar baru</label>
          <input class="form-control" type="file" id="berkasSlide" aria-describedby="batasSlide" accept="image/jpeg,image/png,image/webp" required>
          <small id="batasSlide" class="field-hint">JPG, PNG, atau WebP. Maksimal 2 MB.</small>
        </div>
        <button class="btn btn-primary" type="submit">Simpan gambar</button>
      </fieldset>
    </form>`;
  panel.querySelector('#screen-admin-dashboard').prepend(bagian);
  const form = bagian.querySelector('form');
  const fieldset = form.querySelector('fieldset');
  const nomor = form.querySelector('select');
  const pratinjau = form.querySelector('img');
  const deskripsi = form.querySelector('#deskripsiSlide');
  const berkas = form.querySelector('#berkasSlide');
  const tombol = form.querySelector('button[type="submit"]');
  const status = pesanDi(form, true);
  let dimuat = false;

  function tampil() {
    const gambar = fotoSlide[Number(nomor.value) - 1];
    pratinjau.src = gambar.src;
    pratinjau.alt = deskripsi.value = gambar.alt;
    berkas.value = '';
  }

  bagian.addEventListener('toggle', async () => {
    if (!bagian.open || dimuat) return;
    dimuat = true;
    status('Memuat gambar…');
    try {
      await muatSlide();
      if (signal.aborted) return;
      tampil();
      fieldset.disabled = false;
      status('');
    } catch (error) {
      dimuat = false;
      status(error.message + ' Tutup lalu buka pengaturan untuk mencoba lagi.');
    }
  }, { signal });
  nomor.addEventListener('change', () => { tampil(); status(''); }, { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    jalankan(tombol, status, async () => {
      const posisi = Number(nomor.value);
      const file = berkas.files[0];
      if (file?.size > 2 * 1024 * 1024) throw new Error('Foto maksimal 2 MB.');
      fieldset.disabled = true;
      status('Menyimpan gambar…');
      try {
        ubahSlide(await simpan('slide', null, { posisi, alt: deskripsi.value.trim() }, file));
        if (signal.aborted) return;
        tampil();
        status(`Gambar slide ${posisi} tersimpan.`);
      } finally { fieldset.disabled = false; }
    });
  }, { signal });
}
