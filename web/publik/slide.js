import { api } from '../api.js';

export const fotoSlide = [...document.querySelectorAll('#heroPosterTrack .hero-poster-slide img')];

for (const gambar of fotoSlide) {
  const { src, alt } = gambar;
  gambar.addEventListener('error', () => {
    if (gambar.src === src) return;
    gambar.alt = alt;
    gambar.src = src;
  });
}

export function ubahSlide({ posisi, foto, alt }) {
  const gambar = fotoSlide[posisi - 1];
  if (!gambar || typeof foto !== 'string' || !/^\/foto\/[0-9a-f-]+\.(jpg|png|webp)$/.test(foto)) return;
  gambar.alt = alt;
  gambar.src = foto;
}

let permintaan;
export function muatSlide() {
  permintaan ??= api('/slide', { sesi: false }).then(daftar => daftar.forEach(ubahSlide)).catch(error => {
    permintaan = undefined;
    throw error;
  });
  return permintaan;
}
