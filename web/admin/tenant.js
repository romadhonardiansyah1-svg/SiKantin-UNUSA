import { api, navigasi } from '../api.js';
import { id, isi, tabel, tautan } from '../admin-ui/pratinjau.js';
import { skor, statistikTenant } from '../publik/katalog.js';
import { admin, aksiData, cocok, cocokStatus, dataForm, field, filterStatus, isiForm, jalankan,
  kelompok, pesanDi, pilih, segarkanKatalog, simpan, tombol, val } from './kontrol.js';

const bidang = {
  tenant_form_campus_id: 'kampus_id',
  tenant_form_name: 'nama', tenant_form_owner_name: 'nama_pemilik', tenant_form_phone: 'kontak',
  tenant_form_description: 'deskripsi', tenant_form_contract_start: 'kontrak_mulai',
  tenant_form_contract_end: 'kontrak_selesai', tenant_form_contract_status: 'status_kontrak',
  tenant_form_mou: 'mou_nomor', tenant_form_is_active: 'aktif'
};

export async function daftarTenant({ signal }, publik) {
  const [daftar,kampus] = await Promise.all([admin('tenant'),admin('kampus')]);
  if (signal.aborted) return;
  let tenant = daftar;
  const status = pesanDi(id('adminTenantsCountBadge').closest('.table-card'));
  const filter = filterStatus('adminTenants', gambar, signal);
  if (new URLSearchParams(location.search).get('status') === 'arsip') filter.value = 'arsip';
  pilih('adminTenantsFilterCampus', kampus, k => k.nama, 'Semua kampus');
  const namaKampus = new Map(kampus.map(k => [k.id,k.kode]));
  function gambar() {
    const q = val('adminTenantsSearch');
    const filterKampus = val('adminTenantsFilterCampus');
    const rows = tenant.filter(t => cocokStatus(t, filter) && (!filterKampus || t.kampus_id === filterKampus)
      && cocok(q, t.nama, t.kode_stand, t.nama_pemilik));
    tabel('adminTenantsTableBody', rows.map(t => {
      const reg = publik.find(p => p.slug === t.slug);
      const statistik = reg ? statistikTenant(reg) : null;
      const tindakan = aksiData('tenant', t, status, hapus => {
        if (signal.aborted) return;
        if (hapus) tenant = tenant.filter(row => row.id !== t.id);
        gambar();
        filter.focus();
      });
      return [
        [t.kode_stand,t.nama].filter(Boolean).join(' · '),
        namaKampus.get(t.kampus_id) || '—',
        [t.nama_pemilik,t.kontak].filter(Boolean).join(' · ') || '—',
        [t.kontrak_mulai,t.kontrak_selesai].filter(Boolean).join(' – ') || '—',
        statistik?.nilai == null ? 'Belum ada penilaian' : skor(statistik.nilai) + ' / ' + statistik.jumlah + ' ulasan',
        kelompok(tautan('/admin/qr?tenant=' + t.id, 'Kartu QR')),
        kelompok(tautan('/admin/tenant/' + t.id, 'Ubah'), ...tindakan)
      ];
    }));
    isi('adminTenantsCountBadge', rows.length + ' tenant');
  }
  id('adminTenantsFilterCampus').addEventListener('change', gambar, { signal });
  id('adminTenantsSearch').addEventListener('input', gambar, { signal });
  gambar();
}

export async function formulirTenant({ signal }, tenantId) {
  const [kampus,tenant] = await Promise.all([admin('kampus'), tenantId ? admin('tenant') : []]);
  if (signal.aborted) return;
  const data = tenantId ? tenant.find(t => t.id === tenantId) : {};
  if (!data) throw new Error('Tenant tidak ditemukan.');
  const form = id('adminTenantForm');
  pilih('tenant_form_campus_id', kampus, k => k.nama, 'Pilih kampus');
  const sandi = id('tenant_form_password');
  const username = id('tenant_form_username');
  const akses = sandi.closest('.form-group').parentElement;
  const email = field(akses, 'tenant_form_owner_email', 'Email akun pemilik', 'email');
  field(id('tenant_form_contract_status').closest('.form-group').parentElement, 'tenant_form_mou', 'Nomor MoU (opsional)');
  const nomor = id('tenant_form_stall_number');
  nomor.disabled = false;
  nomor.required = false;
  nomor.readOnly = true;
  nomor.value = data.kode_stand ?? '';
  nomor.placeholder = 'Dibuat otomatis saat disimpan';
  const foto = id('tenant_form_photo');
  foto.disabled = false;
  sandi.minLength = 8;
  sandi.maxLength = 72;
  sandi.autocomplete = 'new-password';
  username.autocomplete = 'off';
  username.pattern = '[a-z0-9_.\\-]{3,40}';
  isiForm(bidang, data);
  const submit = id('tenantFormSubmitBtn');
  const status = pesanDi(form, true);
  submit.disabled = false;
  if (tenantId) isi('tenantFormTitle', 'Ubah tenant');
  function akunTerhubung(nama) {
    username.value = nama ?? '';
    for (const control of [username,sandi,email]) control.disabled = Boolean(nama);
  }
  akunTerhubung(data.username);
  if (data.username) akses.append(tombol('Cabut akses pemilik', button => {
    if (!window.confirm('Cabut akses laporan pemilik tenant ini?')) return;
    return jalankan(button, status, async () => {
      await api('/admin/pemilik/' + tenantId, { method: 'DELETE' });
      akunTerhubung(null);
      button.remove();
      status('Akses pemilik dicabut.');
    });
  }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    jalankan(submit, status, async () => {
      const buatAkun = !username.disabled && [username,email,sandi].some(input => input.value);
      if (buatAkun && [username,email,sandi].some(input => !input.value)) {
        throw new Error('Isi nama pengguna, email, dan kata sandi pemilik.');
      }
      const isian = dataForm(bidang);
      const hasil = await simpan('tenant', tenantId, isian, foto.files[0]);
      tenantId = hasil.id;
      foto.value = '';
      history.replaceState(history.state, '', '/admin/tenant/' + tenantId);
      segarkanKatalog();
      if (buatAkun) {
        try {
          await api('/admin/pemilik/' + tenantId, { method: 'POST', data: {
            username: username.value, email: email.value, sandi: sandi.value
          } });
        } catch (error) { throw new Error('Tenant tersimpan. Akses pemilik belum aktif. ' + error.message); }
      }
      navigasi(isian.aktif ? '/admin/tenant' : '/admin/tenant?status=arsip');
    });
  }, { signal });
}
