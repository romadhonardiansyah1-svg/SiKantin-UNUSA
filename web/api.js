export class ApiError extends Error {
  constructor(status, pesan) {
    super(pesan);
    this.status = status;
  }
}

async function permintaan(path, method, data) {
  const options = { method, cache: 'no-store' };
  if (data instanceof FormData) options.body = data;
  else if (data !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(data);
  }
  let respons;
  try { respons = await fetch('/api' + path, options); }
  catch { throw new ApiError(503, 'Koneksi terputus. Coba lagi.'); }
  const json = respons.headers.get('Content-Type')?.includes('application/json');
  if (!json) throw new ApiError(respons.ok ? 502 : respons.status, 'Layanan belum dapat dihubungi. Coba lagi.');
  const hasil = await respons.json();
  if (!respons.ok) throw new ApiError(respons.status, hasil.pesan || 'Permintaan belum berhasil.');
  return hasil;
}

let refresh;
export async function api(path, { method = 'GET', data, sesi = true } = {}) {
  try { return await permintaan(path, method, data); }
  catch (error) {
    if (!sesi || error.status !== 401) throw error;
    refresh ??= permintaan('/auth/refresh', 'POST').finally(() => { refresh = undefined; });
    await refresh;
    return permintaan(path, method, data);
  }
}

let cekLayanan;
export function layananAktif() {
  return cekLayanan ??= api('/status', { sesi: false }).then(hasil => hasil.operasional).catch(error => {
    if (error.status === 404) return false;
    throw error;
  });
}

export let profilAktif = null;
let cekSesi;
export function catatSesi(profil) {
  cekSesi = undefined;
  profilAktif = profil;
  document.dispatchEvent(new Event('sesi-berubah'));
}

export function sesiAktif() {
  if (cekSesi) return cekSesi;
  const permintaan = api('/auth/sesi').catch(error => {
    if ([401,403].includes(error.status)) return null;
    throw error;
  }).then(profil => {
    if (cekSesi === permintaan) catatSesi(profil);
    return profilAktif;
  }).finally(() => {
    if (cekSesi === permintaan) cekSesi = undefined;
  });
  cekSesi = permintaan;
  return permintaan;
}

export const navigasi = tujuan => document.dispatchEvent(new CustomEvent('navigasi', { detail: tujuan }));
export const segarkanKatalog = () => document.dispatchEvent(new Event('katalog-berubah'));

export async function keluar() {
  await api('/auth/keluar', { method: 'POST', sesi: false });
  catatSesi(null);
  navigasi('/');
}
