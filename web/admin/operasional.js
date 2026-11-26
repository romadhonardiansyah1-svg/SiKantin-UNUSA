import { pasangLayar, rute } from '../admin-ui/pratinjau.js';
import { daftarTenant, formulirTenant } from './tenant.js';
import { master, moderasi } from './master.js';
import { pasangKeluar } from './kontrol.js';

const modulMaster = { 'admin-campuses': 'kampus', 'admin-menus': 'menu', 'admin-questions': 'pertanyaan' };

export async function halamanInternal(path, katalog) {
  const idTenant = path.match(/^\/admin\/tenant\/([0-9a-f-]{36})$/i)?.[1];
  const ruteAcuan = idTenant ? '/admin/tenant/baru' : path === '/pemilik/laporan' ? '/pemilik' : path;
  const route = rute['/pratinjau' + ruteAcuan];
  if (!route) return null;
  const [key, judul] = route;
  const context = await pasangLayar(key, idTenant ? 'Ubah tenant' : judul, path, true);
  if (!context) return null;
  const { panel, signal } = context;
  panel.querySelector('.internal-page .preview-strip')?.remove();
  pasangKeluar(panel.querySelector('a.btn-danger[href="/"]'));
  if (modulMaster[key]) await master(modulMaster[key], context);
  else if (key === 'admin-tenants') await daftarTenant(context, katalog);
  else if (key === 'admin-tenant-form') await formulirTenant(context, idTenant);
  else if (key === 'admin-reviews') await moderasi(context);
  else if (key === 'admin-qr-print') {
    const { kartuQR } = await import('./qr.js');
    if (!signal.aborted) await kartuQR(context);
  } else {
    const { dasbor, laporanAdmin, laporanPemilik } = await import('../laporan/tampilan.js');
    if (signal.aborted) return null;
    if (key === 'admin-dashboard') await dasbor(context);
    else if (key === 'admin-report') await laporanAdmin(context);
    else await laporanPemilik(context);
  }
  return signal.aborted ? null : idTenant ? 'Ubah tenant' : judul;
}
