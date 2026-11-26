export const KAMPUS_BAKU = Object.freeze([
  Object.freeze({ id: '1', kode: 'KAMPUS_A', huruf: 'A', nama: 'Kampus A UNUSA' }),
  Object.freeze({ id: '2', kode: 'KAMPUS_B', huruf: 'B', nama: 'Kampus B UNUSA' }),
  Object.freeze({ id: '3', kode: 'KAMPUS_C', huruf: 'C', nama: 'Kampus C UNUSA' })
]);

export const STATUS_KONTRAK = Object.freeze([
  'aktif',
  'akan_habis',
  'berakhir',
  'nonaktif'
]);

export const LABEL_STATUS_KONTRAK = Object.freeze({
  aktif: 'Aktif',
  akan_habis: 'Akan Habis',
  berakhir: 'Berakhir',
  nonaktif: 'Nonaktif'
});

export const TIPE_FOTO_DIIZINKAN = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export const BATAS_FOTO_BYTE = 2 * 1024 * 1024;

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_TELEPON = /^(?:\+62|62|0)[0-9]{7,14}$/;
const POLA_USERNAME = /^[a-z0-9._-]{3,32}$/;
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatTanggal = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

/**
 * Mengubah nama tenant menjadi slug URL yang aman.
 * @param {string} nama
 * @returns {string}
 */
export function buatSlugTenant(nama) {
  return String(nama || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Memeriksa tipe dan ukuran berkas foto tenant (JPG/PNG/WebP, maks 2 MB).
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {string} Pesan galat atau string kosong jika valid.
 */
export function validasiFotoTenant(file) {
  if (!file) return '';
  if (!TIPE_FOTO_DIIZINKAN.includes(file.type)) {
    return 'Foto harus berformat JPG, PNG, atau WebP.';
  }
  if (typeof file.size !== 'number' || file.size <= 0 || file.size > BATAS_FOTO_BYTE) {
    return 'Ukuran foto maksimal 2 MB.';
  }
  return '';
}

function tanggalValid(nilai) {
  if (!POLA_TANGGAL.test(nilai)) return false;
  const [tahun, bulan, hari] = nilai.split('-').map(Number);
  const dt = new Date(Date.UTC(tahun, bulan - 1, hari));
  return (
    dt.getUTCFullYear() === tahun &&
    dt.getUTCMonth() === bulan - 1 &&
    dt.getUTCDate() === hari
  );
}

/**
 * Memvalidasi dan menormalkan payload formulir tambah/ubah tenant.
 * @param {Record<string, unknown>} input
 * @param {{ isEdit?: boolean, campusIds?: string[], previousUsername?: string }} [opsi]
 */
export function validasiTenant(input, opsi = {}) {
  const isEdit = Boolean(opsi.isEdit);
  const campusIds = Array.isArray(opsi.campusIds) && opsi.campusIds.length
    ? opsi.campusIds.map(String)
    : KAMPUS_BAKU.map(c => c.id);

  const campus_id = String(input?.campus_id ?? '').trim();
  const stall_number = String(input?.stall_number ?? '').trim();
  const name = String(input?.name ?? '').trim();
  const owner_name = String(input?.owner_name ?? '').trim();
  const phoneRaw = String(input?.phone ?? '').trim();
  const phoneNormalized = phoneRaw.replace(/[\s\-()]/g, '');
  const description = String(input?.description ?? '').trim();
  const contract_start = String(input?.contract_start ?? '').trim();
  const contract_end = String(input?.contract_end ?? '').trim();
  const contract_status = String(input?.contract_status ?? 'aktif').trim() || 'aktif';
  const is_active = Boolean(input?.is_active);
  const username = String(input?.username ?? '').trim().toLowerCase();
  const password = String(input?.password ?? '');
  const owner_email = String(input?.owner_email ?? '').trim().toLowerCase();
  const mou_number = String(input?.mou_number ?? '').trim();

  /** @type {Record<string, string>} */
  const errors = {};

  if (!campus_id || !campusIds.includes(campus_id)) {
    errors.campus_id = 'Pilih lokasi kampus yang valid.';
  }
  if (stall_number.length < 2 || stall_number.length > 40) {
    errors.stall_number = 'Nomor stan wajib diisi (2–40 karakter).';
  }
  if (name.length < 2 || name.length > 120) {
    errors.name = 'Nama tenant wajib diisi (2–120 karakter).';
  } else if (!buatSlugTenant(name)) {
    errors.name = 'Nama tenant harus memuat huruf atau angka.';
  }
  if (owner_name.length < 2 || owner_name.length > 120) {
    errors.owner_name = 'Nama pemilik wajib diisi (2–120 karakter).';
  }
  if (phoneRaw && !POLA_TELEPON.test(phoneNormalized)) {
    errors.phone = 'Nomor telepon/WhatsApp tidak valid (contoh: 081234567890).';
  }
  if (description.length > 1000) {
    errors.description = 'Deskripsi tenant maksimal 1000 karakter.';
  }
  if (contract_start && !tanggalValid(contract_start)) {
    errors.contract_start = 'Format tanggal awal kontrak tidak valid.';
  }
  if (contract_end && !tanggalValid(contract_end)) {
    errors.contract_end = 'Format tanggal akhir kontrak tidak valid.';
  }
  if (
    contract_start &&
    contract_end &&
    !errors.contract_start &&
    !errors.contract_end &&
    contract_end < contract_start
  ) {
    errors.contract_end = 'Akhir kontrak tidak boleh lebih awal dari awal kontrak.';
  }
  if (!STATUS_KONTRAK.includes(contract_status)) {
    errors.contract_status = 'Status kontrak tidak valid.';
  }

  if (username && !POLA_USERNAME.test(username)) {
    errors.username = 'Username hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung (3–32 karakter).';
  }
  if (password && password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.';
  } else if (password.length > 72) {
    errors.password = 'Kata sandi maksimal 72 karakter.';
  }
  const usernameBaru = username && (!isEdit || username !== String(opsi.previousUsername || '').trim().toLowerCase());
  if (usernameBaru && !password) {
    errors.password = 'Kata sandi minimal 6 karakter wajib diisi untuk akun pemilik baru.';
  }
  if (password && !username) {
    errors.username = 'Username wajib diisi jika kata sandi pemilik diatur.';
  }
  if (owner_email && !POLA_EMAIL.test(owner_email)) {
    errors.owner_email = 'Format email pemilik tidak valid.';
  }
  if (mou_number.length > 60) {
    errors.mou_number = 'Nomor MoU maksimal 60 karakter.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      campus_id,
      stall_number,
      name,
      slug: buatSlugTenant(name),
      owner_name,
      phone: phoneRaw,
      description,
      contract_start: contract_start || null,
      contract_end: contract_end || null,
      contract_status,
      is_active,
      username: username || null,
      password: password || null,
      owner_email: owner_email || null,
      mou_number: mou_number || null
    }
  };
}

/**
 * Menyaring daftar tenant berdasarkan kampus dan kata kunci pencarian.
 * @param {Array<Record<string, any>>} daftar
 * @param {{ campusId?: string | number, query?: string }} [kriteria]
 */
export function filterDaftarTenant(daftar, kriteria = {}) {
  const campusFilter = String(kriteria.campusId || '0').trim();
  const kata = String(kriteria.query || '').trim().toLocaleLowerCase('id');
  return daftar.filter(item => {
    const cocokKampus = !campusFilter || campusFilter === '0' || String(item.campus_id) === campusFilter;
    if (!cocokKampus) return false;
    if (!kata) return true;
    const kandidat = [
      item.name,
      item.stall_number,
      item.owner_name,
      item.phone,
      item.slug,
      item.username
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('id');
    return kandidat.includes(kata);
  });
}

/**
 * Memformat tanggal ISO YYYY-MM-DD ke tampilan bahasa Indonesia.
 * @param {string | null | undefined} tanggalIso
 * @returns {string}
 */
export function formatTanggalIndo(tanggalIso) {
  if (!tanggalIso || !tanggalValid(tanggalIso)) return '—';
  const [tahun, bulan, hari] = tanggalIso.split('-').map(Number);
  return formatTanggal.format(new Date(Date.UTC(tahun, bulan - 1, hari)));
}
