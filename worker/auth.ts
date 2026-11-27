import { emailPelangganValid } from '../web/auth/domain.js';
import { bacaJson, HttpError, json, rpc, supabase, teks, tujuanSurvei, type Env } from './http.ts';

type Token = { access_token: string; refresh_token: string; expires_in: number };
export type Sesi = { peran: 'admin' | 'pemilik' | 'pelanggan'; tenant_id: string | null; status: string | null };
export const responden = ['Mahasiswa', 'Dosen', 'Tenaga Kependidikan', 'Pengunjung'];
const pesanDomain = 'Gunakan @gmail.com, @unusa.ac.id, atau @student.unusa.ac.id.';
const namaAkses = 'sikantin_akses';
const namaSegar = 'sikantin_segar';

function cookie(request: Request, nama: string) {
  for (const bagian of (request.headers.get('Cookie') || '').split(';')) {
    const teks = bagian.trim();
    if (teks.startsWith(nama + '=')) return teks.slice(nama.length + 1);
  }
  return '';
}

export function tokenAkses(request: Request) {
  const token = cookie(request, namaAkses);
  if (!token || token.length > 3700) throw new HttpError(401, 'Masuk untuk melanjutkan.');
  return token;
}

function setCookie(request: Request, token?: Token) {
  const aman = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const opsi = '; HttpOnly; SameSite=Lax' + aman;
  const headers = new Headers();
  headers.append('Set-Cookie', namaAkses + '=' + (token?.access_token ?? '') + opsi + '; Path=/; Max-Age=' + (token?.expires_in ?? 0));
  headers.append('Set-Cookie', namaSegar + '=' + (token?.refresh_token ?? '') + opsi + '; Path=/api/auth; Max-Age=' + (token ? 2592000 : 0));
  return headers;
}

export async function sesi(env: Env, token: string) {
  const data = await rpc<Sesi | null>(env, 'sesi', {}, token);
  if (!data) throw new HttpError(403, 'Akun belum terverifikasi atau aksesnya telah dicabut.');
  return data;
}

const auth = <T>(env: Env, path: string, data: unknown) => supabase<T>(env, '/auth/v1/' + path, { data });

function sandi(data: Record<string, unknown>, min: number) {
  const value = data.sandi;
  if (typeof value !== 'string' || value.length < min || value.length > 72) {
    throw new HttpError(422, min > 1 ? 'Gunakan kata sandi 8–72 karakter.' : 'Isi kata sandi.');
  }
  return value;
}

async function segarkan(env: Env, request: Request) {
  const refresh = cookie(request, namaSegar);
  if (!refresh || refresh.length > 300) throw new HttpError(401, 'Sesi berakhir. Masuk kembali.');
  try {
    return await auth<Token>(env, 'token?grant_type=refresh_token', { refresh_token: refresh });
  } catch (error) {
    if (error instanceof HttpError && [400,401,403].includes(error.status)) throw new HttpError(401, 'Sesi berakhir. Masuk kembali.');
    throw error;
  }
}

export async function akun(request: Request, env: Env, aksi: string) {
  if (aksi === 'sesi' && request.method === 'GET') return json(await sesi(env, tokenAkses(request)));
  if (request.method !== 'POST') throw new HttpError(405, 'Metode tidak diizinkan.');
  if (aksi === 'keluar') {
    if (cookie(request, namaAkses) || cookie(request, namaSegar)) {
      try {
        const token = cookie(request, namaAkses) || (await segarkan(env, request)).access_token;
        await supabase(env, '/auth/v1/logout?scope=local', { method: 'POST', token });
      } catch (error) {
        if (!(error instanceof HttpError) || ![401,403].includes(error.status)) throw error;
      }
    }
    return json({ berhasil: true }, 200, setCookie(request));
  }
  if (aksi === 'refresh') {
    const token = await segarkan(env, request);
    return json(await sesi(env, token.access_token), 200, setCookie(request, token));
  }
  const data = await bacaJson(request);
  const kembali = tujuanSurvei(data.kembali);
  if (aksi === 'daftar') {
    const email = teks(data.email).toLowerCase();
    const nama = teks(data.nama);
    const status = teks(data.status);
    if (email.length > 254 || !emailPelangganValid(email)) throw new HttpError(422, pesanDomain);
    if (!nama || nama.length > 100 || !responden.includes(status)) throw new HttpError(422, 'Isi nama dan status Anda di UNUSA.');
    const redirect = new URL('/konfirmasi', request.url);
    redirect.searchParams.set('kembali', kembali || '/');
    await auth(env, 'signup?redirect_to=' + encodeURIComponent(redirect.href), {
      email, password: sandi(data, 8), data: { nama, status }
    });
    return json({ pesan: 'Cek email Anda untuk mengonfirmasi pendaftaran.' }, 201);
  }
  if (aksi === 'masuk') {
    const identitas = teks(data.identitas).toLowerCase();
    let email = identitas;
    if (!identitas.includes('@') && /^[a-z0-9_.-]{3,40}$/.test(identitas)) {
      email = await supabase<string | null>(env, '/rest/v1/rpc/sikantin_email_staf', {
        data: { p_username: identitas }, rahasia: true
      }) || '';
    }
    if (!email || email.length > 254) throw new HttpError(401, 'Email atau kata sandi salah.');
    let token: Token;
    try {
      token = await auth<Token>(env, 'token?grant_type=password', { email, password: sandi(data, 1) });
    } catch (error) {
      if (error instanceof HttpError && error.code === 'email_not_confirmed') throw new HttpError(403, 'Konfirmasi email sebelum masuk.');
      if (error instanceof HttpError && [400,401].includes(error.status)) throw new HttpError(401, 'Email atau kata sandi salah.');
      throw error;
    }
    const profil = await sesi(env, token.access_token);
    if (data.internal === true && profil.peran === 'pelanggan') throw new HttpError(403, 'Gunakan akun pengelola atau pemilik tenant.');
    return json({ ...profil, kembali }, 200, setCookie(request, token));
  }
  if (aksi === 'konfirmasi') {
    const hash = teks(data.token_hash);
    if (!/^[0-9a-z_-]{20,160}$/i.test(hash)) throw new HttpError(422, 'Tautan konfirmasi tidak valid.');
    try { await auth(env, 'verify', { token_hash: hash, type: 'email' }); }
    catch (error) {
      if (error instanceof HttpError && [400,401,403,422].includes(error.status)) {
        throw new HttpError(422, 'Tautan konfirmasi kedaluwarsa atau sudah digunakan.');
      }
      throw error;
    }
    return json({ berhasil: true }, 200, setCookie(request));
  }
  throw new HttpError(404, 'Layanan akun tidak ditemukan.');
}
