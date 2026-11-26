import { KAMPUS_BAKU } from './validasi.js';

export class ApiAdminError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, fieldErrors?: Record<string, string>, code?: string }} [detail]
   */
  constructor(message, detail = {}) {
    super(message);
    this.name = 'ApiAdminError';
    this.status = detail.status || 0;
    this.fieldErrors = detail.fieldErrors || {};
    this.code = detail.code || 'API_ERROR';
  }
}

async function mintaJson(url, opsi = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...opsi
    });
  } catch {
    throw new ApiAdminError(
      'Koneksi ke server terputus. Periksa jaringan Anda, lalu coba lagi.',
      { status: 0, code: 'NETWORK_ERROR' }
    );
  }

  let body = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Sesi pengelola berakhir. Silakan masuk kembali.'
        : response.status === 403
          ? 'Akses ditolak. Hanya pengelola kantin yang diizinkan mengubah data tenant.'
          : response.status === 404
            ? 'Data tenant tidak ditemukan.'
            : 'Permintaan gagal diproses oleh server.';
    throw new ApiAdminError(body?.error || fallback, {
      status: response.status,
      fieldErrors: body?.fieldErrors || {},
      code: body?.code || 'HTTP_' + response.status
    });
  }

  return body;
}

function buatBodyTenant(payload, photoFile) {
  if (!photoFile) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
  }
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  form.set('photo', photoFile);
  return { body: form };
}

/**
 * Mengambil daftar kampus untuk dropdown pengelola.
 */
export async function ambilKampusAdmin() {
  try {
    const data = await mintaJson('/api/admin/campuses', { method: 'GET' });
    if (Array.isArray(data?.campuses) && data.campuses.length) {
      return data.campuses;
    }
  } catch (err) {
    if (err instanceof ApiAdminError && (err.status === 401 || err.status === 403)) {
      throw err;
    }
  }
  return KAMPUS_BAKU;
}

/**
 * Mengambil daftar tenant dari backend pengelola.
 * @param {{ campusId?: string, q?: string }} [filter]
 */
export async function ambilDaftarTenant(filter = {}) {
  const params = new URLSearchParams();
  if (filter.campusId && filter.campusId !== '0') params.set('campus_id', String(filter.campusId));
  if (filter.q && filter.q.trim()) params.set('q', filter.q.trim());
  const query = params.toString();
  const data = await mintaJson('/api/admin/tenants' + (query ? '?' + query : ''), {
    method: 'GET'
  });
  return Array.isArray(data?.tenants) ? data.tenants : [];
}

/**
 * Mengambil satu data tenant berdasarkan ID atau slug.
 * @param {string | number} idAtauSlug
 */
export async function ambilDetailTenant(idAtauSlug) {
  const data = await mintaJson('/api/admin/tenants/' + encodeURIComponent(String(idAtauSlug)), {
    method: 'GET'
  });
  return data?.tenant || null;
}

/**
 * Menyimpan tenant baru.
 * @param {Record<string, unknown>} payload
 * @param {File | null} [photoFile]
 */
export async function simpanTenantBaru(payload, photoFile = null) {
  const { headers, body } = buatBodyTenant(payload, photoFile);
  const data = await mintaJson('/api/admin/tenants', {
    method: 'POST',
    headers,
    body
  });
  return data?.tenant;
}

/**
 * Memperbarui data tenant yang sudah ada.
 * @param {string | number} id
 * @param {Record<string, unknown>} payload
 * @param {File | null} [photoFile]
 */
export async function perbaruiTenant(id, payload, photoFile = null) {
  const { headers, body } = buatBodyTenant(payload, photoFile);
  const data = await mintaJson('/api/admin/tenants/' + encodeURIComponent(String(id)), {
    method: 'PUT',
    headers,
    body
  });
  return data?.tenant;
}

/**
 * Menghapus atau mengarsipkan tenant (arsip otomatis bila sudah memiliki ulasan).
 * @param {string | number} id
 */
export async function arsipAtauHapusTenant(id) {
  return mintaJson('/api/admin/tenants/' + encodeURIComponent(String(id)), {
    method: 'DELETE'
  });
}
