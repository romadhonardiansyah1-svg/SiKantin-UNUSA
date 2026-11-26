import type {
  ContractStatus,
  NormalizedTenantInput,
  ValidatedPhoto
} from './types.ts';

export const STATUS_KONTRAK: readonly ContractStatus[] = [
  'aktif',
  'akan_habis',
  'berakhir',
  'nonaktif'
];

export const BATAS_FOTO_BYTE = 2 * 1024 * 1024;

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_TELEPON = /^(?:\+62|62|0)[0-9]{7,14}$/;
const POLA_USERNAME = /^[a-z0-9._-]{3,32}$/;
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buatSlugTenant(nama: string): string {
  return String(nama || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function tanggalValid(nilai: string): boolean {
  if (!POLA_TANGGAL.test(nilai)) return false;
  const [tahun, bulan, hari] = nilai.split('-').map(Number);
  const dt = new Date(Date.UTC(tahun, bulan - 1, hari));
  return (
    dt.getUTCFullYear() === tahun &&
    dt.getUTCMonth() === bulan - 1 &&
    dt.getUTCDate() === hari
  );
}

export function validasiTenantPayload(
  raw: Record<string, unknown>,
  opsi: { isEdit?: boolean; campusIds?: string[]; previousUsername?: string | null } = {}
): {
  valid: boolean;
  errors: Record<string, string>;
  data: NormalizedTenantInput;
} {
  const isEdit = Boolean(opsi.isEdit);
  const campusIds = opsi.campusIds?.length ? opsi.campusIds.map(String) : ['1', '2', '3'];

  const campus_id = String(raw?.campus_id ?? '').trim();
  const stall_number = String(raw?.stall_number ?? '').trim();
  const name = String(raw?.name ?? '').trim();
  const owner_name = String(raw?.owner_name ?? '').trim();
  const phoneRaw = String(raw?.phone ?? '').trim();
  const phoneNormalized = phoneRaw.replace(/[\s\-()]/g, '');
  const description = String(raw?.description ?? '').trim();
  const contract_start = String(raw?.contract_start ?? '').trim();
  const contract_end = String(raw?.contract_end ?? '').trim();
  const contract_status = (String(raw?.contract_status ?? 'aktif').trim() || 'aktif') as ContractStatus;
  const is_active = Boolean(raw?.is_active);
  const username = String(raw?.username ?? '').trim().toLowerCase();
  const password = String(raw?.password ?? '');
  const owner_email = String(raw?.owner_email ?? '').trim().toLowerCase();
  const mou_number = String(raw?.mou_number ?? '').trim();

  const errors: Record<string, string> = {};

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
    errors.username =
      'Username hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung (3–32 karakter).';
  }
  if (password && password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.';
  } else if (password.length > 72) {
    errors.password = 'Kata sandi maksimal 72 karakter.';
  }

  const prevUsername = String(opsi.previousUsername || '').trim().toLowerCase();
  const usernameBaru = Boolean(username) && (!isEdit || username !== prevUsername);
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

function cekMagicBytes(bytes: Uint8Array): ValidatedPhoto['contentType'] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export async function validasiFotoUpload(
  file: File
): Promise<{ photo?: ValidatedPhoto; error?: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { error: 'Foto harus berformat JPG, PNG, atau WebP.' };
  }
  if (file.size <= 0 || file.size > BATAS_FOTO_BYTE) {
    return { error: 'Ukuran foto maksimal 2 MB.' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = cekMagicBytes(bytes);
  if (!detected || detected !== file.type) {
    return { error: 'Isi berkas foto tidak sesuai format JPG, PNG, atau WebP.' };
  }
  const extension = detected === 'image/jpeg' ? 'jpg' : detected === 'image/png' ? 'png' : 'webp';
  return {
    photo: {
      bytes,
      contentType: detected,
      extension,
      size: bytes.byteLength
    }
  };
}
