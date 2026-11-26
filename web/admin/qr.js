import qrcode from '../vendor/qrcode-2.0.4.mjs';
import { api } from '../api.js';
import { id, isi } from '../admin-ui/pratinjau.js';
import { admin, kelompok, pesanDi, pilih, tombol, unduh } from './kontrol.js';

function gambar(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const ukuran = qr.getModuleCount();
  const skala = 6;
  const kanvas = document.createElement('canvas');
  kanvas.width = kanvas.height = (ukuran + 8) * skala;
  kanvas.setAttribute('aria-label', 'Kode QR survei tenant');
  kanvas.setAttribute('role', 'img');
  const context = kanvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, kanvas.width, kanvas.height);
  context.fillStyle = '#000';
  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      if (qr.isDark(y,x)) context.fillRect((x + 4) * skala, (y + 4) * skala, skala, skala);
    }
  }
  return kanvas;
}

export async function kartuQR({ panel, signal }) {
  const [tenants, kampus] = await Promise.all([admin('tenant'),admin('kampus')]);
  if (signal.aborted) return;
  const select = id('qrPrintTenantSelect');
  const area = id('printQrContainer');
  const status = pesanDi(panel.querySelector('#screen-admin-qr-print'));
  const cetak = panel.querySelector('button[disabled]');
  cetak.dataset.print = '';
  cetak.removeAttribute('title');
  const buat = tombol('Buat QR', () => pilihQR('buat'));
  const ganti = tombol('Ganti QR', () => {
    if (window.confirm('Ganti QR? Kartu lama akan berhenti berlaku.')) pilihQR('ganti');
  });
  const cabut = tombol('Cabut QR', () => {
    if (window.confirm('Cabut QR aktif? Kartu ini akan berhenti berlaku.')) pilihQR('cabut');
  });
  let kanvas;
  const png = tombol('Unduh PNG', () => {
    const canvas = kanvas;
    const nama = tenants.find(t => t.id === select.value)?.slug ?? 'tenant';
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return status('PNG belum dapat dibuat.');
      unduh(blob, 'qr-' + nama + '.png');
    }, 'image/png');
  });
  const aksi = kelompok(buat,ganti,cabut,png);
  aksi.classList.add('no-print');
  cetak.before(aksi);
  pilih('qrPrintTenantSelect', tenants, t => t.nama);
  const pilihan = new URLSearchParams(location.search).get('tenant');
  if (tenants.some(t => t.id === pilihan)) select.value = pilihan;
  let giliran = 0;
  async function muat(tenant, aksi) {
    const proses = ++giliran;
    kanvas = null;
    area.replaceChildren();
    for (const b of [buat,ganti,cabut,png,cetak]) b.disabled = true;
    isi('qrPrintTenantName',tenant?.nama ?? 'Pilih tenant');
    isi('qrPrintStallCampusBadge',tenant ? [tenant.kode_stand,kampus.find(k => k.id === tenant.kampus_id)?.nama].filter(Boolean).join(' · ') : '');
    isi('qrPrintFallbackUrl', 'QR belum diterbitkan.');
    if (!tenant) return;
    const { url } = await api('/admin/qr/' + tenant.id, aksi ? { method: 'POST', data: { aksi } } : {});
    if (signal.aborted || proses !== giliran) return;
    if (url) {
      kanvas = gambar(url);
      area.append(kanvas);
      isi('qrPrintFallbackUrl', url);
    }
    buat.disabled = Boolean(url);
    for (const b of [ganti,cabut,png,cetak]) b.disabled = !url;
  }
  async function pilihQR(aksi) {
    status('');
    try { await muat(tenants.find(t => t.id === select.value), aksi); }
    catch (error) {
      status(error.message);
      buat.disabled = !select.value;
    }
  }
  select.addEventListener('change', () => pilihQR(), { signal });
  await pilihQR();
}
