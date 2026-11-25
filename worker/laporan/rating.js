import {
  ASPEK_INTI,
  LABEL_KOSONG,
  apakahUlasanTayang,
  formatSkor,
  hitungStatistikRating,
  ringkasanRatingTenant
} from '../../web/laporan/rating.js';

export {
  ASPEK_INTI,
  LABEL_KOSONG,
  apakahUlasanTayang,
  formatSkor,
  hitungStatistikRating,
  ringkasanRatingTenant
};

/**
 * Membentuk respons JSON laporan rating dengan header privasi no-store.
 * @param {unknown} data
 * @param {number} [status=200]
 * @returns {Response}
 */
export function responsLaporanJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

/**
 * Membentuk ringkasan agregat laporan untuk dasbor/ekspor (PDF & XLSX)
 * dari daftar tenant yang sudah difilter.
 * @param {Array<{ slug: string, nama: string, ulasan?: Record<string, unknown>[] }>} daftarTenant
 */
export function bangunLaporanRating(daftarTenant = []) {
  const perTenant = daftarTenant.map(ringkasanRatingTenant);
  const semuaUlasan = daftarTenant.flatMap(t => t.ulasan ?? []);
  const agregat = hitungStatistikRating(semuaUlasan);

  return {
    agregat,
    tenant: perTenant
  };
}
