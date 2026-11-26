import { akun, sesi, tokenAkses } from './auth.ts';
import { fotoPublik, pengelola } from './admin.ts';
import { bacaJson, HttpError, json, rpc, siap, slug, teks, uuid, type Env } from './http.ts';

async function api(request: Request, env: Env, url: URL) {
  const bagian = url.pathname.split('/').slice(2);
  const lihat = request.method === 'GET';
  if (!lihat && request.headers.get('Origin') !== url.origin) {
    throw new HttpError(403, 'Asal permintaan tidak diizinkan.');
  }
  if (lihat && url.pathname === '/api/status') return json({ operasional: siap(env) });
  if (!siap(env)) throw new HttpError(503, 'Layanan operasional belum terhubung.');
  if (lihat && url.pathname === '/api/katalog') return json(await rpc(env, 'katalog'));
  if (bagian.length === 2 && bagian[0] === 'auth') return akun(request, env, bagian[1]);
  if (bagian.length <= 3 && bagian[0] === 'admin' && bagian[1]) {
    return pengelola(env, request, tokenAkses(request), bagian[1], bagian[2]);
  }
  if (lihat && url.pathname === '/api/laporan') {
    const tenant = url.searchParams.get('tenant');
    const kampus = url.searchParams.get('kampus');
    const bulan = url.searchParams.get('bulan');
    if ((tenant && !uuid.test(tenant)) || (kampus && !uuid.test(kampus)) || (bulan && !['3','6','12'].includes(bulan))) {
      throw new HttpError(422, 'Filter laporan tidak valid.');
    }
    return json(await rpc(env, 'laporan', {
      p_tenant: tenant || null, p_kampus: kampus || null, p_bulan: bulan ? Number(bulan) : null
    }, tokenAkses(request)));
  }
  if (lihat && url.pathname === '/api/pertanyaan') {
    const token = tokenAkses(request);
    if ((await sesi(env, token)).peran !== 'pelanggan') throw new HttpError(403, 'Survei khusus pelanggan.');
    return json(await rpc(env, 'pertanyaan', {}, token));
  }
  if (request.method === 'POST' && bagian.length === 3 && bagian[0] === 'tenant' && bagian[2] === 'ulasan' && slug.test(bagian[1])) {
    const token = tokenAkses(request);
    const data = await bacaJson(request);
    return json(await rpc(env, 'kirim_ulasan', {
      p_slug: bagian[1], p_kiriman: teks(data.kiriman), p_responden: teks(data.responden),
      p_komentar: teks(data.komentar), p_menu: data.menu ?? [], p_jawaban: data.jawaban ?? {}
    }, token), 201);
  }
  throw new HttpError(404, 'Layanan tidak ditemukan.');
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (url.pathname.startsWith('/foto/') && request.method === 'GET') return await fotoPublik(env, url.pathname);
      if (url.pathname.startsWith('/r/') && request.method === 'GET') {
        const kode = url.pathname.slice(3);
        if (siap(env) && /^[0-9a-f]{32}$/.test(kode)) {
          const tujuan = await rpc<string | null>(env, 'tujuan_qr', { p_token: kode });
          if (tujuan && slug.test(tujuan)) {
            return new Response(null, { status: 302, headers: {
              Location: '/tenant/' + tujuan + '/survei', 'Cache-Control': 'no-store'
            } });
          }
        }
        const halaman = await env.ASSETS.fetch(new Request(new URL('/', url), request));
        const headers = new Headers(halaman.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(halaman.body, { status: 404, headers });
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ pesan: error.message }, error.status);
      return json({ pesan: 'Layanan belum dapat dihubungi. Coba lagi.' }, 503);
    }
  }
};
