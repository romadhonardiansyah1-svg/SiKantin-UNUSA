import { ConflictError, SupabaseTenantRepository } from './supabase-repo.ts';
import type {
  AdminEnv,
  AuthSession,
  TenantRepository,
  ValidatedPhoto
} from './types.ts';
import { validasiFotoUpload, validasiTenantPayload } from './validasi.ts';

const METODE_TULIS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

function originDiizinkan(request: Request, env: AdminEnv): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return true;
  const extra = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

async function bacaPayloadDanFoto(request: Request): Promise<{
  raw?: Record<string, unknown>;
  photo?: ValidatedPhoto | null;
  error?: string;
}> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return { error: 'Format multipart formulir tidak valid.' };
    }
    const payloadStr = formData.get('payload');
    if (typeof payloadStr !== 'string') {
      return { error: 'Data payload tenant tidak ditemukan.' };
    }
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(payloadStr);
    } catch {
      return { error: 'Format JSON payload tidak valid.' };
    }
    const fotoEntry = formData.get('photo');
    let photo: ValidatedPhoto | null = null;
    if (fotoEntry && typeof fotoEntry === 'object' && 'arrayBuffer' in fotoEntry && fotoEntry.size > 0) {
      const checked = await validasiFotoUpload(fotoEntry as File);
      if (checked.error) return { error: checked.error };
      photo = checked.photo || null;
    }
    return { raw, photo };
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'Payload harus berupa objek JSON.' };
    }
    return { raw, photo: null };
  } catch {
    return { error: 'Format JSON tidak valid.' };
  }
}

/**
 * Handler Worker untuk manajemen tenant oleh Pengelola Kantin (`/api/admin/tenants*` & `/api/admin/campuses`).
 * Memastikan hanya pengguna dengan peran `admin` yang diizinkan mengakses atau mengubah data.
 */
export async function handleAdminTenantsRequest(
  request: Request,
  env: AdminEnv,
  session: AuthSession | null,
  customRepo?: TenantRepository
): Promise<Response> {
  if (!session || !session.userId) {
    return jsonResponse(
      { error: 'Autentikasi diperlukan. Silakan masuk sebagai pengelola.' },
      401
    );
  }

  if (session.role !== 'admin') {
    return jsonResponse(
      { error: 'Akses ditolak. Hanya pengelola kantin yang dapat mengelola data tenant.' },
      403
    );
  }

  if (METODE_TULIS.has(request.method) && !originDiizinkan(request, env)) {
    return jsonResponse({ error: 'Asal permintaan tidak diizinkan.' }, 403);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const repo = customRepo || new SupabaseTenantRepository(env, session);

  try {
    if (path === '/api/admin/campuses') {
      if (request.method !== 'GET') {
        return jsonResponse({ error: 'Metode tidak diizinkan.' }, 405, { Allow: 'GET' });
      }
      const campuses = await repo.listCampuses();
      return jsonResponse({ campuses }, 200);
    }

    if (path === '/api/admin/tenants') {
      if (request.method === 'GET') {
        const campusId = url.searchParams.get('campus_id') || undefined;
        const query = url.searchParams.get('q') || undefined;
        const tenants = await repo.listTenants({ campusId, query });
        return jsonResponse({ tenants }, 200);
      }

      if (request.method === 'POST') {
        const parsed = await bacaPayloadDanFoto(request);
        if (parsed.error || !parsed.raw) {
          return jsonResponse({ error: parsed.error || 'Payload tidak valid.' }, 400);
        }
        const campuses = await repo.listCampuses();
        const checked = validasiTenantPayload(parsed.raw, {
          isEdit: false,
          campusIds: campuses.map(c => c.id)
        });
        if (!checked.valid) {
          return jsonResponse(
            {
              error: 'Periksa kembali isian formulir tenant.',
              fieldErrors: checked.errors
            },
            422
          );
        }
        const tenant = await repo.createTenant(checked.data, parsed.photo);
        return jsonResponse({ tenant }, 201);
      }

      return jsonResponse({ error: 'Metode tidak diizinkan.' }, 405, { Allow: 'GET, POST' });
    }

    const detailMatch = path.match(/^\/api\/admin\/tenants\/([^/]+)$/);
    if (detailMatch) {
      const idOrSlug = decodeURIComponent(detailMatch[1]);

      if (request.method === 'GET') {
        const tenant = await repo.getTenant(idOrSlug);
        if (!tenant) return jsonResponse({ error: 'Tenant tidak ditemukan.' }, 404);
        return jsonResponse({ tenant }, 200);
      }

      if (request.method === 'PUT' || request.method === 'PATCH') {
        const existing = await repo.getTenant(idOrSlug);
        if (!existing) return jsonResponse({ error: 'Tenant tidak ditemukan.' }, 404);

        const parsed = await bacaPayloadDanFoto(request);
        if (parsed.error || !parsed.raw) {
          return jsonResponse({ error: parsed.error || 'Payload tidak valid.' }, 400);
        }
        const campuses = await repo.listCampuses();
        const checked = validasiTenantPayload(parsed.raw, {
          isEdit: true,
          campusIds: campuses.map(c => c.id),
          previousUsername: existing.username
        });
        if (!checked.valid) {
          return jsonResponse(
            {
              error: 'Periksa kembali isian formulir tenant.',
              fieldErrors: checked.errors
            },
            422
          );
        }
        const updated = await repo.updateTenant(existing.id, checked.data, parsed.photo);
        if (!updated) return jsonResponse({ error: 'Tenant tidak ditemukan.' }, 404);
        return jsonResponse({ tenant: updated }, 200);
      }

      if (request.method === 'DELETE') {
        const result = await repo.archiveOrDeleteTenant(idOrSlug);
        if (!result) return jsonResponse({ error: 'Tenant tidak ditemukan.' }, 404);
        return jsonResponse(result, 200);
      }

      return jsonResponse({ error: 'Metode tidak diizinkan.' }, 405, {
        Allow: 'GET, PUT, PATCH, DELETE'
      });
    }

    return jsonResponse({ error: 'Endpoint admin tidak ditemukan.' }, 404);
  } catch (err) {
    if (err instanceof ConflictError) {
      return jsonResponse({ error: err.message, fieldErrors: err.fieldErrors }, 409);
    }
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan pada server.' },
      500
    );
  }
}
