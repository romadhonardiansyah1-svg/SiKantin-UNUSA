export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = '') {
    super(message);
  }
}

export const siap = (env: Env) => Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
export const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const tujuanSurvei = (path: unknown) =>
  typeof path === 'string' && /^\/tenant\/[a-z0-9]+(?:-[a-z0-9]+)*\/survei$/.test(path) && path.length <= 145 ? path : '';

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { status, headers: h });
}

export async function isi(request: Request, batas: number) {
  if (Number(request.headers.get('Content-Length')) > batas) throw new HttpError(413, 'Berkas atau isian terlalu besar.');
  const reader = request.body?.getReader();
  const bagian: Uint8Array[] = [];
  let jumlah = 0;
  while (reader) {
    const { value, done } = await reader.read();
    if (done) break;
    jumlah += value.length;
    if (jumlah > batas) {
      await reader.cancel();
      throw new HttpError(413, 'Berkas atau isian terlalu besar.');
    }
    bagian.push(value);
  }
  const hasil = new Uint8Array(jumlah);
  let posisi = 0;
  for (const potong of bagian) {
    hasil.set(potong, posisi);
    posisi += potong.length;
  }
  return hasil;
}

export function objek(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(422, 'Isian tidak valid.');
  return data as Record<string, unknown>;
}

export async function bacaJson(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Gunakan format JSON.');
  const bytes = await isi(request, 32 * 1024);
  try {
    return objek(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'JSON tidak dapat dibaca.');
  }
}

export const teks = (isi: unknown) => typeof isi === 'string' ? isi.trim() : '';

export async function supabase<T>(env: Env, path: string, options: {
  token?: string;
  rahasia?: boolean;
  data?: unknown;
  body?: BodyInit;
  method?: string;
  tipe?: string;
} = {}): Promise<T> {
  const key = options.rahasia ? env.SUPABASE_SECRET_KEY : env.SUPABASE_PUBLISHABLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new HttpError(503, 'Konfigurasi Supabase belum lengkap.');
  const headers = new Headers({ apikey: key });
  // Kunci JWT lokal lama perlu Authorization. Kunci sb_* memakai apikey.
  const bearer = options.token || (key.startsWith('eyJ') ? key : '');
  if (bearer) headers.set('Authorization', 'Bearer ' + bearer);
  if (options.tipe || options.data !== undefined) headers.set('Content-Type', options.tipe ?? 'application/json');
  const response = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + path, {
    method: options.method ?? (options.data !== undefined || options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body ?? (options.data === undefined ? undefined : JSON.stringify(options.data)),
    signal: AbortSignal.timeout(10000)
  });
  const raw = await response.text();
  let hasil;
  try { hasil = raw ? JSON.parse(raw) : null; }
  catch { throw new HttpError(502, 'Respons Supabase tidak terbaca.'); }
  if (response.ok) return hasil;
  const kode = String(hasil?.error_code || hasil?.code || '');
  if (/^PT(403|404|409|422|429)$/.test(kode)) throw new HttpError(Number(kode.slice(2)), hasil.message, kode);
  if (kode === '23505') throw new HttpError(409, 'Data dengan kode atau nama tersebut sudah terdaftar.', kode);
  if (/^(22|23)[A-Z0-9]{3}$/.test(kode)) throw new HttpError(422, 'Periksa nilai dan hubungan data yang diisi.', kode);
  const status = response.status >= 500 ? 502 : response.status;
  throw new HttpError(status, status === 429 ? 'Tunggu sebentar sebelum mencoba lagi.' : 'Permintaan Supabase gagal.', kode);
}

export const rpc = <T>(env: Env, nama: string, data: Record<string, unknown> = {}, token?: string) =>
  supabase<T>(env, '/rest/v1/rpc/sikantin_' + nama, { data, token });
