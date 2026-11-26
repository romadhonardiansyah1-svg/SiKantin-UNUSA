-- Data fiktif hanya untuk pengembangan lokal. Jangan dipakai sebagai data operasional.
insert into public.kampus (id, kode, nama, aktif) values
  ('10000000-0000-0000-0000-000000000001', 'A', 'Kampus A UNUSA', true),
  ('10000000-0000-0000-0000-000000000002', 'B', 'Kampus B UNUSA', true),
  ('10000000-0000-0000-0000-000000000003', 'C', 'Kampus C UNUSA', true);

insert into public.tenant (id, kampus_id, slug, nama, deskripsi, foto, aktif) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'warung-nasi-bu-siti', 'Warung Nasi Bu Siti', 'Aneka nasi campur dengan harga mahasiswa.', '/assets/stand-1.jpg', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'dapur-bakso-contoh', 'Dapur Bakso Contoh', 'Bakso dan minuman untuk contoh katalog.', '/assets/stand-3.jpg', true),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   'tenant-contoh-nonaktif', 'Tenant Contoh Nonaktif', '', null, false);

insert into public.menu (id, tenant_id, nama, kategori, harga, deskripsi, foto, tersedia, andalan, aktif) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Nasi Campur Spesial Bu Siti', 'Makanan', 15000, 'Nasi dengan lauk dan sayuran.', '/assets/geprek-bakso.jpg', true, true, true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Es Teh Manis Melati', 'Minuman', 4000, 'Teh melati dingin.', '/assets/minuman-camilan.jpg', false, false, true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002',
   'Bakso Urat Contoh', 'Makanan', 16000, 'Bakso urat dengan kuah kaldu.', '/assets/geprek-bakso.jpg', true, true, true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003',
   'Menu Tenant Nonaktif', 'Makanan', 10000, '', null, true, false, true);
