export const ASPEK_INTI = [
  { kunci: 'rasa', label: 'Cita rasa' },
  { kunci: 'kebersihan', label: 'Kebersihan' },
  { kunci: 'porsi', label: 'Porsi' },
  { kunci: 'kualitas', label: 'Kualitas bahan' },
  { kunci: 'cara_pembayaran', label: 'Pembayaran' }
];

export const LABEL_KOSONG = 'Belum ada penilaian';

const formatterSkor = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const formatterJamWib = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  hourCycle: 'h23'
});

/**
 * Menentukan apakah ulasan berstatus tayang.
 * @param {Record<string, unknown>} ulasan
 * @returns {boolean}
 */
export function apakahUlasanTayang(ulasan) {
  if (!ulasan || typeof ulasan !== 'object') return false;
  if (typeof ulasan.tayang === 'boolean') return ulasan.tayang;
  const moderasi =
    ulasan.status_moderasi ??
    ulasan.statusModerasi ??
    ulasan.moderasi ??
    ulasan.visibilitas;
  if (moderasi !== undefined && moderasi !== null) {
    return String(moderasi).trim().toLowerCase() === 'tayang';
  }
  return true;
}

/**
 * Mengambil nilai aspek inti yang terisi (1-5) dari satu ulasan.
 * @param {Record<string, unknown>} ulasan
 * @returns {(number | null)[]}
 */
function ekstrakAspekInti(ulasan) {
  if (Array.isArray(ulasan.aspek)) {
    return ASPEK_INTI.map((_, i) => {
      const nilai = Number(ulasan.aspek[i]);
      return Number.isFinite(nilai) && nilai >= 1 && nilai <= 5 ? nilai : null;
    });
  }
  const sumber = ulasan.aspek_inti ?? ulasan.nilai_aspek ?? {};
  return ASPEK_INTI.map(({ kunci }) => {
    const raw = sumber[kunci];
    if (raw === null || raw === undefined || raw === '') return null;
    const nilai = Number(raw);
    return Number.isFinite(nilai) && nilai >= 1 && nilai <= 5 ? nilai : null;
  });
}

/**
 * Memformat angka rating ke format Indonesia atau label kosong.
 * @param {number | null | undefined} nilai
 * @returns {string}
 */
export function formatSkor(nilai) {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) {
    return LABEL_KOSONG;
  }
  return formatterSkor.format(nilai);
}

/**
 * Satu perhitungan rating dari aspek inti yang terisi pada ulasan tayang.
 * Dipakai bersama oleh katalog publik, dasbor admin, portal pemilik, PDF, dan XLSX.
 * @param {Record<string, unknown>[]} daftarUlasan
 */
export function hitungStatistikRating(daftarUlasan = []) {
  const semua = Array.isArray(daftarUlasan) ? daftarUlasan : [];
  const tayang = semua.filter(apakahUlasanTayang);

  if (!tayang.length) {
    return {
      nilai: null,
      label: LABEL_KOSONG,
      aspek: ASPEK_INTI.map(() => null),
      jumlah: 0,
      total_ulasan: semua.length,
      tersembunyi: semua.length,
      distribusi_jam_wib: Array(24).fill(0)
    };
  }

  const jumlahPerAspek = Array(ASPEK_INTI.length).fill(0);
  const totalPerAspek = Array(ASPEK_INTI.length).fill(0);
  const distribusiJamWib = Array(24).fill(0);

  let totalTerisi = 0;
  let jumlahTerisi = 0;

  for (const ulasan of tayang) {
    const nilaiAspek = ekstrakAspekInti(ulasan);
    for (let i = 0; i < ASPEK_INTI.length; i++) {
      const skor = nilaiAspek[i];
      if (skor !== null) {
        totalPerAspek[i] += skor;
        jumlahPerAspek[i] += 1;
        totalTerisi += skor;
        jumlahTerisi += 1;
      }
    }
    if (ulasan.waktu) {
      const tanggal = new Date(String(ulasan.waktu));
      if (!Number.isNaN(tanggal.getTime())) {
        const jam = Number(formatterJamWib.format(tanggal));
        if (jam >= 0 && jam < 24) distribusiJamWib[jam] += 1;
      }
    }
  }

  const aspek = totalPerAspek.map((total, i) =>
    jumlahPerAspek[i] > 0 ? total / jumlahPerAspek[i] : null
  );
  const nilai = jumlahTerisi > 0 ? totalTerisi / jumlahTerisi : null;

  return {
    nilai,
    label: formatSkor(nilai),
    aspek,
    jumlah: tayang.length,
    total_ulasan: semua.length,
    tersembunyi: semua.length - tayang.length,
    distribusi_jam_wib: distribusiJamWib
  };
}

/**
 * Menghitung ringkasan rating satu tenant untuk katalog dan laporan.
 * @param {{ slug: string, nama: string, ulasan?: Record<string, unknown>[] }} tenant
 */
export function ringkasanRatingTenant(tenant) {
  const statistik = hitungStatistikRating(tenant?.ulasan ?? []);
  return {
    slug: tenant.slug,
    nama: tenant.nama,
    ...statistik
  };
}
