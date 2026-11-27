-- Data katalog yang dapat ditampilkan kepada pengunjung.
create table public.kampus (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (length(btrim(kode)) > 0),
  nama text not null check (length(btrim(nama)) > 0),
  aktif boolean not null default true
);

create table public.tenant (
  id uuid primary key default gen_random_uuid(),
  kampus_id uuid not null references public.kampus(id) on delete restrict,
  slug text not null unique check (length(slug) <= 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nama text not null check (length(btrim(nama)) > 0),
  deskripsi text not null default '',
  foto text,
  aktif boolean not null default false
);

create table public.menu (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete restrict,
  nama text not null check (length(btrim(nama)) > 0),
  kategori text not null check (length(btrim(kategori)) > 0),
  harga integer not null check (harga >= 0),
  deskripsi text not null default '',
  foto text,
  tersedia boolean not null default true,
  andalan boolean not null default false,
  aktif boolean not null default true
);

create index tenant_kampus_id_idx on public.tenant (kampus_id);
create index menu_tenant_id_idx on public.menu (tenant_id);

-- Skema ini tidak boleh ditambahkan ke daftar exposed schemas Data API.
create schema sikantin_private;
create table sikantin_private.detail_tenant (
  tenant_id uuid primary key references public.tenant(id) on delete restrict,
  kode_stand text,
  kontak text,
  mou_path text
);

alter table public.kampus enable row level security;
alter table public.tenant enable row level security;
alter table public.menu enable row level security;
alter table sikantin_private.detail_tenant enable row level security;

-- Cabut juga hak bawaan Supabase sebelum memberi akses paling sedikit.
revoke all on public.kampus, public.tenant, public.menu from public, anon, authenticated, service_role;
revoke all on schema sikantin_private from public, anon, authenticated, service_role;
revoke all on sikantin_private.detail_tenant from public, anon, authenticated, service_role;

grant select (id, kode, nama, aktif) on public.kampus to anon, authenticated;
grant select (id, kampus_id, slug, nama, deskripsi, foto, aktif) on public.tenant to anon, authenticated;
grant select (id, tenant_id, nama, kategori, harga, deskripsi, foto, tersedia, andalan, aktif)
  on public.menu to anon, authenticated;

-- Service role hanya dipakai oleh server tepercaya; tidak ada hak tulis klien.
grant usage on schema sikantin_private to service_role;
grant select, insert, update, delete on public.kampus, public.tenant, public.menu,
  sikantin_private.detail_tenant to service_role;

create policy "Kampus aktif dapat dibaca publik" on public.kampus
  for select to anon, authenticated using (aktif);

create policy "Tenant aktif di kampus aktif dapat dibaca publik" on public.tenant
  for select to anon, authenticated using (
    aktif and exists (
      select 1 from public.kampus where kampus.id = tenant.kampus_id and kampus.aktif
    )
  );

create policy "Menu aktif pada tenant aktif dapat dibaca publik" on public.menu
  for select to anon, authenticated using (
    aktif and exists (
      select 1 from public.tenant where tenant.id = menu.tenant_id and tenant.aktif
    )
  );
