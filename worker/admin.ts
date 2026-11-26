import { emailPelangganValid } from '../web/auth/domain.js';
import { sesi } from './auth.ts';
import { bacaJson, HttpError, isi, json, objek, rpc, supabase, teks, uuid, type Env } from './http.ts';

const modul = new Set(['kampus', 'tenant', 'menu', 'pertanyaan', 'ulasan']);
const folder = '/storage/v1/object/foto-kantin';
const batasFoto = 2 * 1024 * 1024;
const format = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

function jenisFoto(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if ([137,80,78,71,13,10,26,10].every((x, i) => bytes[i] === x)) return 'png';
  const header = new TextDecoder().decode(bytes.subarray(0,12));
  if (header.startsWith('RIFF') && header.endsWith('WEBP')) return 'webp';
  throw new HttpError(422, 'Foto harus berformat JPG, PNG, atau WebP.');
}

async function dataAdmin(request: Request) {
  const tipe = request.headers.get('Content-Type') || '';
  if (!tipe.startsWith('multipart/form-data')) return { data: await bacaJson(request) };
  const bytes = await isi(request, batasFoto + 64 * 1024);
  try {
    const form = await new Response(bytes, { headers: { 'Content-Type': tipe } }).formData();
    const file = form.get('foto');
    return { data: objek(JSON.parse(String(form.get('data')))), file: typeof file === 'object' ? file : null };
  } catch {
    throw new HttpError(422, 'Formulir tidak dapat dibaca.');
  }
}

export async function fotoPublik(env: Env, path: string) {
  const cocok = path.match(/^\/foto\/([0-9a-f-]+)\.(jpg|png|webp)$/);
  if (!cocok || !uuid.test(cocok[1]) || !env.SUPABASE_URL) throw new HttpError(404, 'Foto tidak ditemukan.');
  const sumber = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/storage/v1/object/public/foto-kantin/' + cocok[1] + '.' + cocok[2], {
    signal: AbortSignal.timeout(10000)
  });
  if (!sumber.ok) throw new HttpError(sumber.status >= 500 ? 502 : 404, 'Foto tidak tersedia.');
  return new Response(sumber.body, { headers: {
    'Content-Type': format[cocok[2] as keyof typeof format],
    'Cache-Control': 'public, max-age=86400, immutable',
    'X-Content-Type-Options': 'nosniff'
  } });
}

async function simpanPemilik(env: Env, request: Request, token: string, tenant: string) {
  if (request.method === 'DELETE') {
    return json(await rpc(env, 'tautkan_pemilik', { p_tenant: tenant, p_akun: null, p_username: null }, token));
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Metode tidak diizinkan.');
  const data = await bacaJson(request);
  const username = teks(data.username).toLowerCase();
  const email = teks(data.email).toLowerCase();
  const sandi = data.sandi;
  if (!/^[a-z0-9_.-]{3,40}$/.test(username) || !emailPelangganValid(email) || email.length > 254
      || typeof sandi !== 'string' || sandi.length < 8 || sandi.length > 72) {
    throw new HttpError(422, 'Periksa nama pengguna, domain email dan kata sandi 8–72 karakter.');
  }
  const akun = await supabase<{ id: string }>(env, '/auth/v1/admin/users', { rahasia: true, data: {
    email, password: sandi, email_confirm: true, app_metadata: { sikantin_staf: true }
  } });
  try {
    await rpc(env, 'tautkan_pemilik', { p_tenant: tenant, p_akun: akun.id, p_username: username }, token);
  } catch (error) {
    // Hapus akun baru hanya ketika database pasti menolak penautan.
    if (error instanceof HttpError && error.status < 500) {
      await supabase(env, '/auth/v1/admin/users/' + akun.id, { rahasia: true, method: 'DELETE' });
    }
    throw error;
  }
  return json({ berhasil: true }, 201);
}

export async function pengelola(env: Env, request: Request, token: string, bagian: string, id?: string) {
  if ((await sesi(env, token)).peran !== 'admin') throw new HttpError(403, 'Khusus pengelola kantin.');
  if (id && !uuid.test(id)) throw new HttpError(422, 'ID tidak valid.');
  if (bagian === 'pemilik' && id) return simpanPemilik(env, request, token, id);
  if (bagian === 'qr' && id) {
    if (!['GET','POST'].includes(request.method)) throw new HttpError(405, 'Metode tidak diizinkan.');
    const aksi = request.method === 'GET' ? 'lihat' : (await bacaJson(request)).aksi;
    const kode = await rpc<string | null>(env, 'qr', { p_tenant: id, p_aksi: aksi }, token);
    return json({ url: kode ? new URL('/r/' + kode, request.url).href : null });
  }
  const slide = bagian === 'slide' && !id;
  if (!slide && !modul.has(bagian)) throw new HttpError(404, 'Bagian pengelola tidak ditemukan.');
  if (!slide && request.method === 'GET' && !id) return json(await rpc(env, 'admin', { p_modul: bagian }, token));
  if (!(request.method === 'POST' && !id) && !(request.method === 'PUT' && id)) {
    throw new HttpError(405, 'Metode tidak diizinkan.');
  }
  const { data, file } = await dataAdmin(request);
  const posisi = data.posisi;
  const alt = teks(data.alt);
  if (slide && (typeof posisi !== 'number' || ![1, 2, 3].includes(posisi) || !alt || alt.length > 120 || !file?.size)) {
    throw new HttpError(422, 'Pilih slide, isi deskripsi, dan unggah gambar baru.');
  }
  if (bagian === 'tenant' && !id) {
    data.slug = teks(data.nama).normalize('NFD').toLowerCase().replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-').slice(0,120).replace(/^-|-$/g, '');
    if (!data.slug) throw new HttpError(422, 'Nama tenant harus memuat huruf atau angka.');
  }
  delete data.foto;
  let namaFoto;
  if (file?.size) {
    if (!['menu','tenant','slide'].includes(bagian)) throw new HttpError(422, 'Bagian ini tidak memerlukan foto.');
    if (file.size > batasFoto) throw new HttpError(413, 'Foto maksimal 2 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ekstensi = jenisFoto(bytes);
    if (file.type !== format[ekstensi]) throw new HttpError(422, 'Format berkas foto tidak sesuai.');
    namaFoto = crypto.randomUUID() + '.' + ekstensi;
    await supabase(env, folder + '/' + namaFoto, { body: bytes, tipe: format[ekstensi], token });
    data.foto = '/foto/' + namaFoto;
  }
  try {
    if (slide) return json(await rpc(env, 'simpan_slide', { p_posisi: posisi, p_foto: data.foto, p_alt: alt }, token));
    const hasil = await rpc(env, 'simpan', { p_modul: bagian, p_id: id || null, p_data: data }, token);
    return json({ id: hasil }, id ? 200 : 201);
  } catch (error) {
    if (namaFoto && error instanceof HttpError && error.status < 500) {
      await supabase(env, folder, { token, method: 'DELETE', data: { prefixes: [namaFoto] } });
    }
    throw error;
  }
}
