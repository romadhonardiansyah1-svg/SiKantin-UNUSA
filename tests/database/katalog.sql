-- Jalankan setelah migrasi pada basis data pengujian. Semua data uji dibatalkan.
begin;

insert into public.kampus (id, kode, nama, aktif) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'TEST-A', 'Kampus Uji A', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'TEST-X', 'Kampus Uji Nonaktif', false);

insert into public.tenant (id, kampus_id, slug, nama, aktif) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'tenant-uji-aktif', 'Tenant Uji Aktif', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'tenant-uji-nonaktif', 'Tenant Uji Nonaktif', false),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'tenant-uji-kampus-nonaktif', 'Tenant Uji Kampus Nonaktif', true);

insert into public.menu (id, tenant_id, nama, kategori, harga, tersedia, aktif) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Menu Uji Tersedia', 'Makanan', 12000, true, true),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Menu Uji Habis', 'Minuman', 5000, false, true),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Menu Uji Arsip', 'Makanan', 10000, true, false),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'Menu Uji Tenant Nonaktif', 'Makanan', 10000, true, true),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000003', 'Menu Uji Kampus Nonaktif', 'Makanan', 10000, true, true);

insert into sikantin_private.detail_tenant (tenant_id, kode_stand, kontak, mou_path)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'RAHASIA-UJI', 'kontak uji', 'mou/uji.pdf');

-- Kolom yang ditambahkan belakangan tidak boleh otomatis menjadi publik.
alter table public.kampus add column kolom_privat_uji text default 'RAHASIA-UJI';
alter table public.tenant add column kolom_privat_uji text default 'RAHASIA-UJI';
alter table public.menu add column kolom_privat_uji text default 'RAHASIA-UJI';

do $$
declare
  pengguna text;
  tabel text;
begin
  foreach pengguna in array array['anon', 'authenticated'] loop
    foreach tabel in array array['public.kampus', 'public.tenant', 'public.menu'] loop
      if has_table_privilege(pengguna, tabel, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') then
        raise exception '% memiliki hak tulis pada %', pengguna, tabel;
      end if;
      if current_setting('server_version_num')::integer >= 170000 then
        if has_table_privilege(pengguna, tabel, 'MAINTAIN') then
          raise exception '% memiliki hak maintain pada %', pengguna, tabel;
        end if;
      end if;
      if has_column_privilege(pengguna, tabel, 'kolom_privat_uji', 'SELECT') then
        raise exception '% dapat membaca kolom baru pada %', pengguna, tabel;
      end if;
    end loop;
  end loop;

  begin
    insert into public.menu (tenant_id, nama, kategori, harga)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'Harga negatif', 'Makanan', -1);
    raise exception 'Harga negatif diterima';
  exception when check_violation then null;
  end;

  begin
    insert into public.menu (tenant_id, nama, kategori, harga)
    values ('ffffffff-0000-0000-0000-000000000001', 'Tenant tidak ada', 'Makanan', 1000);
    raise exception 'Menu untuk tenant tidak ada diterima';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.tenant (kampus_id, slug, nama)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'tenant-uji-aktif', 'Slug ganda');
    raise exception 'Slug tenant ganda diterima';
  exception when unique_violation then null;
  end;
end $$;

-- Pengujian dilakukan sebagai role nyata, bukan sebagai pemilik tabel yang bypass RLS.
set local role anon;
do $$
begin
  if (select count(*) from public.kampus where kode like 'TEST-%') <> 1 then
    raise exception 'Anon dapat melihat kampus nonaktif atau kehilangan kampus aktif';
  end if;
  if (select count(*) from public.tenant where slug like 'tenant-uji-%') <> 1 then
    raise exception 'Anon dapat melihat tenant tersembunyi atau kehilangan tenant aktif';
  end if;
  if (select count(*) from public.menu where nama like 'Menu Uji %') <> 2 then
    raise exception 'Menu arsip atau tenant tersembunyi terlihat, atau menu habis hilang';
  end if;
  if not exists (select 1 from public.menu where nama = 'Menu Uji Habis' and not tersedia) then
    raise exception 'Ketersediaan menu habis tidak terlihat';
  end if;
  begin
    perform * from sikantin_private.detail_tenant;
    raise exception 'Anon dapat membaca data privat';
  exception when insufficient_privilege then null;
  end;
  begin
    perform kolom_privat_uji from public.tenant;
    raise exception 'Anon otomatis dapat membaca kolom baru';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tenant (kampus_id, slug, nama)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'tenant-tidak-sah', 'Tidak Sah');
    raise exception 'Anon dapat menulis tenant';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
do $$
begin
  if (select count(*) from public.kampus where kode like 'TEST-%') <> 1
     or (select count(*) from public.tenant where slug like 'tenant-uji-%') <> 1
     or (select count(*) from public.menu where nama like 'Menu Uji %') <> 2 then
    raise exception 'Pelanggan terautentikasi dapat melihat data yang disembunyikan';
  end if;
  begin
    perform * from sikantin_private.detail_tenant;
    raise exception 'Pelanggan terautentikasi dapat membaca data privat';
  exception when insufficient_privilege then null;
  end;
  begin
    perform kolom_privat_uji from public.tenant;
    raise exception 'Pelanggan otomatis dapat membaca kolom baru';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.menu set harga = 1 where id = 'cccccccc-0000-0000-0000-000000000001';
    raise exception 'Pelanggan terautentikasi dapat mengubah harga';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
