import {
  ApiAdminError,
  ambilDaftarTenant,
  ambilDetailTenant,
  ambilKampusAdmin,
  arsipAtauHapusTenant,
  perbaruiTenant,
  simpanTenantBaru
} from './api.js';
import {
  KAMPUS_BAKU,
  LABEL_STATUS_KONTRAK,
  filterDaftarTenant,
  formatTanggalIndo,
  validasiFotoTenant,
  validasiTenant
} from './validasi.js';

const RUTE_INTERNAL = [
  ['/admin', '/pratinjau/admin'],
  ['/admin/kampus', '/pratinjau/admin/kampus'],
  ['/admin/tenant', '/pratinjau/admin/tenant'],
  ['/admin/menu', '/pratinjau/admin/menu'],
  ['/admin/pertanyaan', '/pratinjau/admin/pertanyaan'],
  ['/admin/ulasan', '/pratinjau/admin/ulasan'],
  ['/admin/laporan', '/pratinjau/admin/laporan'],
  ['/admin/qr', '/pratinjau/admin/qr']
];

const formatHariIni = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const formatSkor = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

let templateCache = null;
let aktifController = null;
let pesanKilat = null;

function el(id) {
  return document.getElementById(id);
}

function buatElemen(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const child of children) node.append(child);
  return node;
}

async function muatTemplateLayar() {
  if (!templateCache) {
    templateCache = fetch('/admin-ui/layar')
      .then(async response => {
        if (!response.ok) throw new Error('Template pengelola gagal dimuat.');
        const text = await response.text();
        return new DOMParser().parseFromString(text, 'text/html');
      })
      .catch(err => {
        templateCache = null;
        throw err;
      });
  }
  return templateCache;
}

function parseRuteTenant(path) {
  const clean = String(path || '/admin/tenant').replace(/\/+$/, '') || '/';
  if (clean === '/admin/tenant') return { layar: 'admin-tenants', mode: 'list', id: null };
  if (clean === '/admin/tenant/baru') return { layar: 'admin-tenant-form', mode: 'create', id: null };
  const matchEdit = clean.match(/^\/admin\/tenant\/([^/]+)\/ubah$/);
  if (matchEdit) {
    return { layar: 'admin-tenant-form', mode: 'edit', id: decodeURIComponent(matchEdit[1]) };
  }
  return null;
}

function salinNavigasiAdmin(panel) {
  const peta = new Map(RUTE_INTERNAL.map(([live, preview]) => [preview, live]));
  for (const a of panel.querySelectorAll('.admin-nav-item')) {
    const target = peta.get(a.getAttribute('href'));
    if (target) a.setAttribute('href', target);
    a.classList.toggle('active', a.getAttribute('data-admin-nav') === 'admin-tenants');
  }
  const namaPengguna = panel.querySelector('.admin-topbar-profile-text div');
  if (namaPengguna) namaPengguna.textContent = 'Admin Pengelola';
  const kembali = panel.querySelector('.admin-sidebar .btn-danger');
  if (kembali) {
    const svg = kembali.querySelector('svg');
    kembali.replaceChildren(...(svg ? [svg] : []), 'Keluar ke katalog');
  }
}

function tampilkanStatusBanner(container, tipe, pesan, aksiUlang = null) {
  let banner = container.querySelector('[data-admin-status]');
  if (!banner) {
    banner = buatElemen('div', {
      className: 'status-note',
      role: tipe === 'error' ? 'alert' : 'status',
      'aria-live': 'polite'
    });
    banner.setAttribute('data-admin-status', '');
    container.prepend(banner);
  }
  banner.hidden = !pesan;
  banner.setAttribute('role', tipe === 'error' ? 'alert' : 'status');
  banner.style.background =
    tipe === 'error' ? '#fef2f2' : tipe === 'success' ? '#ecfdf5' : '#f8fafc';
  banner.style.color =
    tipe === 'error' ? '#991b1b' : tipe === 'success' ? '#166534' : 'var(--text-secondary)';
  banner.style.border =
    tipe === 'error'
      ? '1px solid #fecaca'
      : tipe === 'success'
        ? '1px solid #a7f3d0'
        : '1px solid var(--border-color)';

  banner.replaceChildren(buatElemen('span', { textContent: pesan }));
  if (typeof aksiUlang === 'function') {
    const btn = buatElemen('button', {
      type: 'button',
      className: 'btn btn-outline',
      textContent: 'Coba lagi',
      style: 'margin-left:0.75rem; padding:0.28rem 0.65rem; font-size:0.8rem;'
    });
    btn.addEventListener('click', aksiUlang);
    banner.append(btn);
  }
}

function kelasBadgeKontrak(status) {
  if (status === 'aktif') return 'badge-success';
  if (status === 'akan_habis') return 'badge-warning';
  return 'badge-danger';
}

function labelKampus(campusId, daftarKampus) {
  const ketemu = daftarKampus.find(c => String(c.id) === String(campusId));
  return ketemu?.kode || ketemu?.code || 'KAMPUS_' + campusId;
}

function siapkanKontrolKampus(selectEl, daftarKampus, sertakanSemua) {
  if (!selectEl) return;
  const pilihanSekarang = selectEl.value;
  const opsi = [];
  if (sertakanSemua) opsi.push(new Option('Semua Kampus', '0'));
  for (const k of daftarKampus) {
    opsi.push(new Option(k.nama || k.name, String(k.id)));
  }
  selectEl.replaceChildren(...opsi);
  if ([...selectEl.options].some(o => o.value === pilihanSekarang)) {
    selectEl.value = pilihanSekarang;
  }
}

function buatDialogKonfirmasi(section, signal) {
  const modal = buatElemen('div', {
    id: 'adminTenantConfirmDialog',
    role: 'alertdialog',
    'aria-modal': 'true',
    'aria-labelledby': 'adminTenantConfirmTitle',
    hidden: '',
    style:
      'position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:1rem; z-index:1200;'
  });
  const card = buatElemen('div', {
    className: 'card',
    style: 'max-width:420px; width:100%; background:white; padding:1.5rem; border-radius:var(--radius-lg); box-shadow:var(--shadow-md);'
  });
  const title = buatElemen('h3', {
    id: 'adminTenantConfirmTitle',
    textContent: 'Konfirmasi tindakan',
    style: 'margin:0 0 0.5rem; font-size:1.1rem; font-weight:700;'
  });
  const body = buatElemen('p', {
    id: 'adminTenantConfirmMessage',
    style: 'margin:0 0 1.25rem; font-size:0.9rem; color:var(--text-secondary);'
  });
  const actions = buatElemen('div', {
    style: 'display:flex; justify-content:flex-end; gap:0.65rem;'
  });
  const btnBatal = buatElemen('button', {
    type: 'button',
    className: 'btn btn-outline',
    textContent: 'Batal'
  });
  const btnLanjut = buatElemen('button', {
    type: 'button',
    className: 'btn btn-danger',
    textContent: 'Ya, lanjutkan'
  });
  actions.append(btnBatal, btnLanjut);
  card.append(title, body, actions);
  modal.append(card);
  section.append(modal);

  let pemicu = null;
  let onConfirm = null;

  function tutup() {
    modal.hidden = true;
    onConfirm = null;
    pemicu?.focus();
    pemicu = null;
  }

  btnBatal.addEventListener('click', tutup, { signal });
  modal.addEventListener('click', e => {
    if (e.target === modal) tutup();
  }, { signal });
  document.addEventListener('keydown', e => {
    if (!modal.hidden && e.key === 'Escape') tutup();
  }, { signal });
  btnLanjut.addEventListener('click', async () => {
    if (!onConfirm) return;
    const cb = onConfirm;
    btnLanjut.disabled = true;
    btnLanjut.textContent = 'Memproses…';
    try {
      await cb();
      tutup();
    } finally {
      btnLanjut.disabled = false;
      btnLanjut.textContent = 'Ya, lanjutkan';
    }
  }, { signal });

  return function bukaKonfirmasi(pesan, triggerEl, callback) {
    pemicu = triggerEl || document.activeElement;
    onConfirm = callback;
    body.textContent = pesan;
    modal.hidden = false;
    btnBatal.focus();
  };
}

function renderBarisTenant(daftar, daftarKampus, navigate, konfirmasi, onDeleted) {
  const tbody = el('adminTenantsTableBody');
  const badge = el('adminTenantsCountBadge');
  if (!tbody) return;
  if (badge) badge.textContent = `${daftar.length} Tenant`;
  tbody.replaceChildren();

  if (!daftar.length) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 7;
    td.textContent = 'Tidak ada data untuk pilihan ini.';
    return;
  }

  for (const t of daftar) {
    const tr = tbody.insertRow();

    // 1. Stan & Nama Tenant
    const cellNama = tr.insertCell();
    const rowTop = buatElemen('div', {
      style: 'display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;'
    });
    rowTop.append(
      buatElemen('span', {
        className: 'badge-stall',
        style: 'font-size:0.72rem;',
        textContent: t.stall_number || '—'
      }),
      buatElemen('strong', { textContent: t.name })
    );
    if (!t.is_active) {
      rowTop.append(
        buatElemen('span', {
          className: 'badge badge-danger',
          style: 'font-size:0.7rem;',
          textContent: 'Nonaktif'
        })
      );
    }
    const infoMenu = buatElemen('small', {
      style: 'color:var(--text-secondary); display:block; margin-top:2px;',
      textContent: `${Number(t.menu_count || 0)} menu terdaftar`
    });
    cellNama.append(rowTop, infoMenu);

    // 2. Kampus
    const cellKampus = tr.insertCell();
    cellKampus.append(
      buatElemen('span', {
        className: 'badge-campus',
        textContent: labelKampus(t.campus_id, daftarKampus)
      })
    );

    // 3. Pemilik & Kontak
    const cellPemilik = tr.insertCell();
    cellPemilik.append(
      buatElemen('div', {
        style: 'font-weight:600; font-size:0.85rem;',
        textContent: t.owner_name || '—'
      }),
      buatElemen('small', {
        style: 'color:var(--text-muted);',
        textContent: t.phone || '—'
      })
    );

    // 4. Masa Kontrak
    const cellKontrak = tr.insertCell();
    const status = t.contract_status || 'aktif';
    cellKontrak.append(
      buatElemen('span', {
        className: 'badge ' + kelasBadgeKontrak(status),
        textContent: LABEL_STATUS_KONTRAK[status] || status
      }),
      buatElemen('small', {
        style: 'display:block; color:var(--text-muted); font-size:0.75rem; margin-top:2px;',
        textContent: t.contract_end ? 's/d ' + formatTanggalIndo(t.contract_end) : '—'
      })
    );

    // 5. Rating / Ulasan
    const cellRating = tr.insertCell();
    const totalReviews = Number(t.review_count || 0);
    if (totalReviews > 0 && typeof t.avg_rating === 'number') {
      cellRating.append(
        buatElemen('span', {
          style: 'font-weight:700; color:var(--unusa-green);',
          textContent: '★ ' + formatSkor.format(t.avg_rating)
        }),
        buatElemen('small', {
          style: 'display:block; color:var(--text-muted);',
          textContent: `${totalReviews} ulasan`
        })
      );
    } else {
      cellRating.append(
        buatElemen('small', {
          style: 'color:var(--text-muted);',
          textContent: 'Belum ada penilaian'
        })
      );
    }

    // 6. Kode QR (putaran berikutnya)
    const cellQr = tr.insertCell();
    cellQr.append(
      buatElemen('span', {
        className: 'badge ' + (t.qr_active ? 'badge-success' : 'badge-info'),
        textContent: t.qr_active ? 'QR Aktif' : 'QR Tahap Berikutnya'
      })
    );

    // 7. Aksi
    const cellAksi = tr.insertCell();
    cellAksi.style.whiteSpace = 'nowrap';
    const editLink = buatElemen('a', {
      href: '/admin/tenant/' + encodeURIComponent(t.id) + '/ubah',
      className: 'btn btn-secondary',
      style: 'padding:0.35rem 0.65rem; font-size:0.78rem; margin-right:0.35rem;',
      textContent: 'Edit'
    });
    editLink.addEventListener('click', e => {
      e.preventDefault();
      navigate(editLink.pathname);
    });
    const hapusBtn = buatElemen('button', {
      type: 'button',
      className: 'btn btn-danger',
      style: 'padding:0.35rem 0.65rem; font-size:0.78rem;',
      'aria-label': `Arsipkan atau hapus ${t.name}`,
      textContent: 'Hapus'
    });
    hapusBtn.addEventListener('click', () => {
      const pesan =
        totalReviews > 0
          ? `Tenant "${t.name}" sudah memiliki ${totalReviews} ulasan dan akan diarsipkan (dinonaktifkan) agar riwayat tetap terjaga. Lanjutkan?`
          : `Hapus data tenant "${t.name}" dari daftar pengelola?`;
      konfirmasi(pesan, hapusBtn, async () => {
        await onDeleted(t);
      });
    });
    cellAksi.append(editLink, hapusBtn);
  }
}

function pasangElemenGalatForm(form) {
  const petaError = new Map();
  const petaInput = {
    campus_id: 'tenant_form_campus_id',
    stall_number: 'tenant_form_stall_number',
    name: 'tenant_form_name',
    owner_name: 'tenant_form_owner_name',
    phone: 'tenant_form_phone',
    description: 'tenant_form_description',
    photo: 'tenant_form_photo',
    contract_start: 'tenant_form_contract_start',
    contract_end: 'tenant_form_contract_end',
    contract_status: 'tenant_form_contract_status',
    username: 'tenant_form_username',
    password: 'tenant_form_password'
  };

  for (const [field, inputId] of Object.entries(petaInput)) {
    const input = el(inputId);
    if (!input) continue;
    input.disabled = false;
    const errorId = inputId + '_error';
    let span = el(errorId);
    if (!span) {
      span = buatElemen('span', {
        id: errorId,
        className: 'field-error',
        'aria-live': 'polite'
      });
      input.insertAdjacentElement('afterend', span);
    }
    const describedBy = [input.getAttribute('aria-describedby'), errorId].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);
    petaError.set(field, { input, span });
  }

  for (const extraId of ['tenant_form_id', 'tenant_form_is_active', 'tenantFormSubmitBtn']) {
    const node = el(extraId);
    if (node) node.disabled = false;
  }

  return {
    tampilkanGalat(errors, fokusPertama = false) {
      let pertama = null;
      for (const [field, { input, span }] of petaError.entries()) {
        const pesan = errors?.[field] || '';
        span.textContent = pesan;
        input.setAttribute('aria-invalid', pesan ? 'true' : 'false');
        if (pesan && !pertama) pertama = input;
      }
      if (fokusPertama && pertama) pertama.focus();
    },
    bersihkanSatu(field) {
      const target = petaError.get(field);
      if (!target) return;
      target.span.textContent = '';
      target.input.setAttribute('aria-invalid', 'false');
    },
    petaInput
  };
}

function bacaPayloadForm(form) {
  const fileInput = el('tenant_form_photo');
  const photoFile = fileInput?.files?.[0] || null;
  return {
    payload: {
      campus_id: el('tenant_form_campus_id')?.value || '1',
      stall_number: el('tenant_form_stall_number')?.value || '',
      name: el('tenant_form_name')?.value || '',
      owner_name: el('tenant_form_owner_name')?.value || '',
      phone: el('tenant_form_phone')?.value || '',
      description: el('tenant_form_description')?.value || '',
      contract_start: el('tenant_form_contract_start')?.value || '',
      contract_end: el('tenant_form_contract_end')?.value || '',
      contract_status: el('tenant_form_contract_status')?.value || 'aktif',
      is_active: Boolean(el('tenant_form_is_active')?.checked),
      username: el('tenant_form_username')?.value || '',
      password: el('tenant_form_password')?.value || ''
    },
    photoFile
  };
}

function isiFormTenant(tenantData) {
  if (!tenantData) {
    el('tenant_form_id').value = '';
    el('adminTenantForm').reset();
    el('tenant_form_campus_id').value = '1';
    el('tenant_form_contract_start').value = '2026-01-01';
    el('tenant_form_contract_end').value = '2026-12-31';
    el('tenant_form_contract_status').value = 'aktif';
    el('tenant_form_is_active').checked = true;
    el('tenantFormTitle').textContent = 'Tambah Tenant Baru';
    el('tenantFormSubmitBtn').textContent = 'Daftarkan Tenant & Buat QR';
    return;
  }
  el('tenant_form_id').value = String(tenantData.id || '');
  el('tenant_form_campus_id').value = String(tenantData.campus_id || '1');
  el('tenant_form_stall_number').value = tenantData.stall_number || '';
  el('tenant_form_name').value = tenantData.name || '';
  el('tenant_form_owner_name').value = tenantData.owner_name || '';
  el('tenant_form_phone').value = tenantData.phone || '';
  el('tenant_form_description').value = tenantData.description || '';
  el('tenant_form_contract_start').value = tenantData.contract_start || '';
  el('tenant_form_contract_end').value = tenantData.contract_end || '';
  el('tenant_form_contract_status').value = tenantData.contract_status || 'aktif';
  el('tenant_form_is_active').checked = Boolean(tenantData.is_active);
  el('tenant_form_username').value = tenantData.username || '';
  el('tenant_form_password').value = '';
  el('tenant_form_password').placeholder = 'Kosongkan jika tidak mengubah sandi';
  el('tenantFormTitle').textContent = 'Ubah Data Tenant';
  el('tenantFormSubmitBtn').textContent = 'Simpan Perubahan Tenant';
}

export function tutupKelolaTenant() {
  aktifController?.abort();
  aktifController = null;
  const panel = el('screen-internal');
  if (panel) panel.replaceChildren();
  document.body.classList.remove('admin-preview-open');
}

/**
 * Merender halaman pengelola tenant (`/admin/tenant`, `/admin/tenant/baru`, `/admin/tenant/:id/ubah`).
 * @param {string} path
 * @param {{ container?: HTMLElement, navigate?: (url: string, replace?: boolean) => void }} [options]
 */
export async function bukaKelolaTenant(path, options = {}) {
  const parsed = parseRuteTenant(path);
  if (!parsed) return false;

  tutupKelolaTenant();
  const controller = new AbortController();
  aktifController = controller;
  const { signal } = controller;

  const panel = options.container || el('screen-internal');
  const navigate =
    options.navigate ||
    ((url, replace = false) => {
      history[replace ? 'replaceState' : 'pushState']({}, '', url);
      bukaKelolaTenant(new URL(url, location.origin).pathname, options);
    });

  let doc;
  try {
    doc = await muatTemplateLayar();
  } catch {
    if (signal.aborted) return false;
    panel.replaceChildren(
      buatElemen('div', { className: 'container route-message' }, [
        buatElemen('h1', { textContent: 'Halaman pengelola gagal dimuat' }),
        buatElemen('p', { textContent: 'Periksa koneksi Anda, lalu coba lagi.' }),
        buatElemen('button', {
          type: 'button',
          className: 'btn btn-primary',
          textContent: 'Coba lagi'
        })
      ])
    );
    panel.querySelector('button')?.addEventListener('click', () => bukaKelolaTenant(path, options), { signal });
    return true;
  }
  if (signal.aborted) return false;

  const clone = key => doc.getElementById(key).content.cloneNode(true);
  panel.classList.add('internal-admin');
  document.body.classList.add('admin-preview-open');
  panel.replaceChildren(clone('layout'));
  panel.querySelector('main').append(clone(parsed.layar));

  salinNavigasiAdmin(panel);
  el('adminTopbarDate').textContent = formatHariIni.format(new Date()) + ' (WIB)';
  el('adminTopbarTitle').textContent =
    parsed.mode === 'list'
      ? 'Manajemen Tenant & Kode QR'
      : parsed.mode === 'edit'
        ? 'Formulir Ubah Data Tenant'
        : 'Formulir Tambah Tenant Baru';

  function toggleSidebar(buka) {
    el('adminSidebar')?.classList.toggle('open', buka);
    el('adminSidebarBackdrop')?.classList.toggle('open', buka);
    el('sidebarToggle')?.setAttribute('aria-expanded', String(buka));
  }

  panel.addEventListener(
    'click',
    e => {
      const anchor = e.target.closest('a[href]');
      if (anchor && anchor.origin === location.origin && anchor.pathname.startsWith('/admin/tenant')) {
        e.preventDefault();
        e.stopPropagation();
        navigate(anchor.pathname + anchor.search);
        return;
      }
      const btn = e.target.closest('button, #adminSidebarBackdrop');
      if (!btn) return;
      if (btn.id === 'sidebarToggle') toggleSidebar(!el('adminSidebar')?.classList.contains('open'));
      if (btn.id === 'adminSidebarBackdrop') toggleSidebar(false);
    },
    { signal }
  );
  document.addEventListener(
    'keydown',
    e => {
      if (e.key === 'Escape') toggleSidebar(false);
    },
    { signal }
  );

  let daftarKampus = KAMPUS_BAKU;
  try {
    daftarKampus = await ambilKampusAdmin();
  } catch (err) {
    if (signal.aborted) return false;
    const section = panel.querySelector('section.internal-page');
    tampilkanStatusBanner(section, 'error', err.message || 'Gagal memverifikasi akses pengelola.');
    return true;
  }
  if (signal.aborted) return false;

  if (parsed.layar === 'admin-tenants') {
    const section = el('screen-admin-tenants');
    const tambahLink = section.querySelector('a[href="/pratinjau/admin/tenant/baru"]');
    if (tambahLink) tambahLink.setAttribute('href', '/admin/tenant/baru');

    siapkanKontrolKampus(el('adminTenantsFilterCampus'), daftarKampus, true);
    const params = new URLSearchParams(location.search);
    if (params.get('kampus') && [...el('adminTenantsFilterCampus').options].some(o => o.value === params.get('kampus'))) {
      el('adminTenantsFilterCampus').value = params.get('kampus');
    }
    if (params.get('q')) {
      el('adminTenantsSearch').value = params.get('q');
    }

    if (pesanKilat) {
      tampilkanStatusBanner(section, pesanKilat.tipe, pesanKilat.pesan);
      pesanKilat = null;
    } else {
      tampilkanStatusBanner(section, 'info', 'Memuat daftar tenant…');
    }

    const bukaKonfirmasi = buatDialogKonfirmasi(section, signal);
    let semuaTenant = [];

    function perbaruiUrlFilter() {
      const url = new URL(location.href);
      const campusId = el('adminTenantsFilterCampus').value;
      const q = el('adminTenantsSearch').value.trim();
      if (campusId && campusId !== '0') url.searchParams.set('kampus', campusId);
      else url.searchParams.delete('kampus');
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      history.replaceState({}, '', url.pathname + url.search);
    }

    function segarkanTabel() {
      const hasil = filterDaftarTenant(semuaTenant, {
        campusId: el('adminTenantsFilterCampus').value,
        query: el('adminTenantsSearch').value
      });
      renderBarisTenant(hasil, daftarKampus, navigate, bukaKonfirmasi, async tenant => {
        try {
          const res = await arsipAtauHapusTenant(tenant.id);
          tampilkanStatusBanner(
            section,
            'success',
            res?.archived
              ? `Tenant "${tenant.name}" diarsipkan (dinonaktifkan) untuk menjaga riwayat ulasan.`
              : `Tenant "${tenant.name}" berhasil dihapus.`
          );
          await muatDaftar();
        } catch (err) {
          tampilkanStatusBanner(section, 'error', err.message || 'Gagal menghapus tenant.');
        }
      });
    }

    async function muatDaftar() {
      try {
        semuaTenant = await ambilDaftarTenant();
        if (signal.aborted) return;
        const banner = section.querySelector('[data-admin-status]');
        if (banner && banner.getAttribute('role') !== 'alert' && !banner.textContent.includes('berhasil') && !banner.textContent.includes('diarsipkan')) {
          banner.hidden = true;
        }
        segarkanTabel();
      } catch (err) {
        if (signal.aborted) return;
        tampilkanStatusBanner(
          section,
          'error',
          err.message || 'Gagal memuat daftar tenant.',
          err instanceof ApiAdminError && err.status === 0 ? muatDaftar : null
        );
      }
    }

    el('adminTenantsFilterCampus').addEventListener('change', () => {
      perbaruiUrlFilter();
      segarkanTabel();
    }, { signal });
    el('adminTenantsSearch').addEventListener('input', () => {
      perbaruiUrlFilter();
      segarkanTabel();
    }, { signal });

    await muatDaftar();
    return true;
  }

  // Form tambah / ubah tenant
  const section = el('screen-admin-tenant-form');
  for (const backLink of section.querySelectorAll('a[href="/pratinjau/admin/tenant"]')) {
    backLink.setAttribute('href', '/admin/tenant');
  }
  siapkanKontrolKampus(el('tenant_form_campus_id'), daftarKampus, false);

  const form = el('adminTenantForm');
  const helperGalat = pasangElemenGalatForm(form);
  let dataLama = null;

  if (parsed.mode === 'edit') {
    tampilkanStatusBanner(section, 'info', 'Memuat data tenant…');
    try {
      dataLama = await ambilDetailTenant(parsed.id);
      if (signal.aborted) return false;
      if (!dataLama) {
        tampilkanStatusBanner(section, 'error', 'Data tenant tidak ditemukan.');
        return true;
      }
      isiFormTenant(dataLama);
      section.querySelector('[data-admin-status]').hidden = true;
    } catch (err) {
      if (signal.aborted) return false;
      tampilkanStatusBanner(section, 'error', err.message || 'Gagal memuat data tenant.', () =>
        bukaKelolaTenant(path, options)
      );
      return true;
    }
  } else {
    isiFormTenant(null);
  }

  for (const [field, inputId] of Object.entries(helperGalat.petaInput)) {
    const input = el(inputId);
    if (!input) continue;
    const eventName = input.tagName === 'SELECT' || input.type === 'file' ? 'change' : 'input';
    input.addEventListener(eventName, () => helperGalat.bersihkanSatu(field), { signal });
  }

  async function kirimFormulir() {
    const { payload, photoFile } = bacaPayloadForm(form);
    const hasil = validasiTenant(payload, {
      isEdit: parsed.mode === 'edit',
      campusIds: daftarKampus.map(c => String(c.id)),
      previousUsername: dataLama?.username || ''
    });
    const galatFoto = validasiFotoTenant(photoFile);
    if (galatFoto) hasil.errors.photo = galatFoto;

    if (!hasil.valid || galatFoto) {
      helperGalat.tampilkanGalat(hasil.errors, true);
      tampilkanStatusBanner(section, 'error', 'Periksa kembali isian formulir yang ditandai merah.');
      return;
    }

    const submitBtn = el('tenantFormSubmitBtn');
    const labelAsli = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = parsed.mode === 'edit' ? 'Menyimpan perubahan…' : 'Menyimpan tenant…';
    tampilkanStatusBanner(section, 'info', submitBtn.textContent);

    try {
      const saved =
        parsed.mode === 'edit'
          ? await perbaruiTenant(dataLama.id, hasil.data, photoFile)
          : await simpanTenantBaru(hasil.data, photoFile);
      if (signal.aborted) return;
      pesanKilat = {
        tipe: 'success',
        pesan:
          parsed.mode === 'edit'
            ? `Perubahan tenant "${saved?.name || hasil.data.name}" berhasil disimpan.`
            : `Tenant "${saved?.name || hasil.data.name}" berhasil didaftarkan.`
      };
      navigate('/admin/tenant');
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof ApiAdminError && Object.keys(err.fieldErrors).length) {
        helperGalat.tampilkanGalat(err.fieldErrors, true);
      }
      tampilkanStatusBanner(
        section,
        'error',
        err.message || 'Gagal menyimpan data tenant.',
        err instanceof ApiAdminError && (err.status === 0 || err.status >= 500) ? kirimFormulir : null
      );
    } finally {
      if (!signal.aborted) {
        submitBtn.disabled = false;
        submitBtn.textContent = labelAsli;
      }
    }
  }

  form.addEventListener(
    'submit',
    e => {
      e.preventDefault();
      kirimFormulir();
    },
    { signal }
  );

  return true;
}
