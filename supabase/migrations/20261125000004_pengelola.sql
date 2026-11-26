create function public.sikantin_admin(p_modul text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform sikantin_private.wajib_peran('admin');
  case p_modul
    when 'kampus' then return (
      select coalesce(jsonb_agg(k order by kode), '[]') from public.kampus k
    );
    when 'tenant' then return (
      select coalesce(jsonb_agg(to_jsonb(t) || coalesce(to_jsonb(d) - 'tenant_id' - 'mou_path', '{}') ||
        jsonb_build_object('username', p.username) order by t.nama), '[]')
      from public.tenant t left join sikantin_private.detail_tenant d on d.tenant_id = t.id
      left join sikantin_private.profil p on p.tenant_id = t.id and p.aktif
    );
    when 'menu' then return (
      select coalesce(jsonb_agg(m order by nama), '[]') from public.menu m
    );
    when 'pertanyaan' then return (
      select coalesce(jsonb_agg(p order by p.urutan, p.kunci), '[]')
      from sikantin_private.pertanyaan p
      where p.id = (select q.id from sikantin_private.pertanyaan q where q.kunci = p.kunci
        order by q.aktif desc, q.versi desc limit 1)
    );
    when 'ulasan' then return (
      select coalesce(jsonb_agg(baris order by waktu desc), '[]') from (
        select u.id, u.tenant_id, t.nama as tenant, u.waktu, u.komentar, u.status, u.responden,
          (select avg(nilai) from sikantin_private.skor_ulasan where ulasan_id = u.id) as nilai,
          (select array_agg(m.nama order by m.nama) from sikantin_private.ulasan_menu um
            join public.menu m on m.id = um.menu_id where um.ulasan_id = u.id) as menu,
          (select jsonb_agg(jsonb_build_object('label', q.label, 'nilai', j.nilai) order by q.urutan)
            from sikantin_private.jawaban j join sikantin_private.pertanyaan q on q.id = j.pertanyaan_id
            where j.ulasan_id = u.id) as jawaban
        from sikantin_private.ulasan u join public.tenant t on t.id = u.tenant_id
        where u.status <> 'dihapus' order by u.waktu desc, u.id limit 500
      ) baris
    );
    else raise sqlstate 'PT404' using message = 'Bagian tidak ditemukan.';
  end case;
end
$$;
revoke execute on function public.sikantin_admin(text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_admin(text) to authenticated;

create function public.sikantin_simpan(p_modul text, p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  hasil uuid := coalesce(p_id, gen_random_uuid());
  kunci_baru text := btrim(p_data->>'kunci');
  revisi integer := 1;
begin
  perform sikantin_private.wajib_peran('admin');
  case p_modul
    when 'kampus' then
      if p_id is not null and not exists (select 1 from public.kampus where id = p_id) then
        raise sqlstate 'PT404' using message = 'Kampus tidak ditemukan.';
      end if;
      insert into public.kampus (id, kode, nama, alamat, jumlah_stand, fasilitas, aktif)
      values (hasil, upper(btrim(p_data->>'kode')), btrim(p_data->>'nama'), coalesce(btrim(p_data->>'alamat'), ''),
        (p_data->>'jumlah_stand')::int, coalesce(btrim(p_data->>'fasilitas'), ''), coalesce((p_data->>'aktif')::boolean, true))
      on conflict (id) do update set kode = excluded.kode, nama = excluded.nama, alamat = excluded.alamat,
        jumlah_stand = excluded.jumlah_stand, fasilitas = excluded.fasilitas, aktif = excluded.aktif;
    when 'tenant' then
      if p_id is not null and not exists (select 1 from public.tenant where id = p_id) then
        raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
      end if;
      insert into public.tenant (id, kampus_id, slug, nama, deskripsi, foto, aktif)
      values (hasil, (p_data->>'kampus_id')::uuid,
        coalesce((select slug from public.tenant where id = p_id), p_data->>'slug'),
        btrim(p_data->>'nama'), coalesce(btrim(p_data->>'deskripsi'), ''), p_data->>'foto',
        coalesce((p_data->>'aktif')::boolean, false))
      on conflict (id) do update set kampus_id = excluded.kampus_id, nama = excluded.nama,
        deskripsi = excluded.deskripsi, foto = coalesce(excluded.foto, tenant.foto), aktif = excluded.aktif;
      insert into sikantin_private.detail_tenant
        (tenant_id, kode_stand, nama_pemilik, kontak, kontrak_mulai, kontrak_selesai, status_kontrak, mou_nomor)
      values (hasil, nullif(btrim(p_data->>'kode_stand'), ''), coalesce(btrim(p_data->>'nama_pemilik'), ''),
        nullif(btrim(p_data->>'kontak'), ''), nullif(p_data->>'kontrak_mulai', '')::date,
        nullif(p_data->>'kontrak_selesai', '')::date, coalesce(p_data->>'status_kontrak', 'aktif'), nullif(btrim(p_data->>'mou_nomor'), ''))
      on conflict (tenant_id) do update set kode_stand = excluded.kode_stand, nama_pemilik = excluded.nama_pemilik,
        kontak = excluded.kontak, kontrak_mulai = excluded.kontrak_mulai, kontrak_selesai = excluded.kontrak_selesai,
        status_kontrak = excluded.status_kontrak, mou_nomor = excluded.mou_nomor;
    when 'menu' then
      if p_id is not null and not exists (select 1 from public.menu
        where id = p_id and tenant_id = (p_data->>'tenant_id')::uuid) then
        raise sqlstate 'PT422' using message = 'Menu tidak ditemukan pada tenant ini.';
      end if;
      insert into public.menu (id, tenant_id, nama, kategori, harga, deskripsi, foto, tersedia, andalan, aktif)
      values (hasil, (p_data->>'tenant_id')::uuid, btrim(p_data->>'nama'), p_data->>'kategori', (p_data->>'harga')::int,
        coalesce(btrim(p_data->>'deskripsi'), ''), p_data->>'foto', coalesce((p_data->>'tersedia')::boolean, true),
        coalesce((p_data->>'andalan')::boolean, false), coalesce((p_data->>'aktif')::boolean, true))
      on conflict (id) do update set nama = excluded.nama, kategori = excluded.kategori, harga = excluded.harga,
        deskripsi = excluded.deskripsi, foto = coalesce(excluded.foto, menu.foto),
        tersedia = excluded.tersedia, andalan = excluded.andalan, aktif = excluded.aktif;
    when 'pertanyaan' then
      perform pg_advisory_xact_lock(hashtextextended('pertanyaan:' || coalesce(kunci_baru, ''), 0));
      if p_id is not null then
        select versi + 1 into revisi from sikantin_private.pertanyaan
          where id = p_id and kunci = kunci_baru
          and versi = (select max(versi) from sikantin_private.pertanyaan where kunci = kunci_baru)
          for update;
        if not found then raise sqlstate 'PT409' using message = 'Muat ulang daftar pertanyaan sebelum mengedit.'; end if;
        update sikantin_private.pertanyaan set aktif = false where id = p_id;
      end if;
      hasil := gen_random_uuid();
      insert into sikantin_private.pertanyaan (id, kunci, label, teks, tipe, urutan, wajib, aktif, versi)
      values (hasil, kunci_baru, btrim(p_data->>'label'), btrim(p_data->>'teks'), p_data->>'tipe',
        (p_data->>'urutan')::int, coalesce((p_data->>'wajib')::boolean, false), coalesce((p_data->>'aktif')::boolean, true), revisi);
    when 'ulasan' then
      if p_data->>'status' not in ('tayang','sembunyi','spam','dihapus') or p_data->>'status' is null then
        raise sqlstate 'PT422' using message = 'Status moderasi tidak valid.';
      end if;
      update sikantin_private.ulasan set status = p_data->>'status' where id = p_id and status <> 'dihapus';
      if not found then raise sqlstate 'PT404' using message = 'Ulasan tidak ditemukan.'; end if;
    else raise sqlstate 'PT404' using message = 'Bagian tidak ditemukan.';
  end case;
  return hasil;
end
$$;
revoke execute on function public.sikantin_simpan(text,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_simpan(text,uuid,jsonb) to authenticated;

create function public.sikantin_qr(p_tenant uuid, p_aksi text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform sikantin_private.wajib_peran('admin');
  if not exists (select 1 from public.tenant where id = p_tenant) then
    raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
  end if;
  case p_aksi
    when 'lihat' then null;
    when 'buat' then insert into sikantin_private.qr (tenant_id) values (p_tenant) on conflict do nothing;
    when 'ganti' then insert into sikantin_private.qr (tenant_id) values (p_tenant)
      on conflict (tenant_id) do update set token = excluded.token;
    when 'cabut' then delete from sikantin_private.qr where tenant_id = p_tenant;
    else raise sqlstate 'PT422' using message = 'Aksi QR tidak valid.';
  end case;
  return (select token from sikantin_private.qr where tenant_id = p_tenant);
end
$$;
revoke execute on function public.sikantin_qr(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_qr(uuid,text) to authenticated;
