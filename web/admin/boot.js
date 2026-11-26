import { bukaKelolaTenant } from './tenant.js';

const container = document.getElementById('screen-internal');

function arahkan(url, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  muat();
}

async function muat() {
  const path = location.pathname.replace(/\/+$/, '') || '/admin/tenant';
  const target = path === '/admin' ? '/admin/tenant' : path;
  if (target !== path) {
    history.replaceState({}, '', target + location.search);
  }
  const cocok = await bukaKelolaTenant(target, {
    container,
    navigate: arahkan
  });
  if (!cocok) {
    const h1 = document.createElement('h1');
    h1.textContent = 'Halaman pengelola tidak ditemukan';
    const p = document.createElement('p');
    p.textContent = 'Buka daftar tenant untuk mengelola stand kantin.';
    const a = document.createElement('a');
    a.href = '/admin/tenant';
    a.className = 'btn btn-primary';
    a.textContent = 'Buka daftar tenant';
    a.addEventListener('click', e => {
      e.preventDefault();
      arahkan('/admin/tenant');
    });
    const wrap = document.createElement('div');
    wrap.className = 'container route-message';
    wrap.append(h1, p, a);
    container.replaceChildren(wrap);
  }
}

window.addEventListener('popstate', muat);
muat();
