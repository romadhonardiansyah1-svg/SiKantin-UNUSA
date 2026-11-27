begin;

alter table public.tenant
  add column jam_buka time(0),
  add column jam_tutup time(0),
  add column data_uji boolean not null default false,
  alter column kampus_id drop not null,
  add constraint tenant_kampus_operasional check (data_uji or kampus_id is not null),
  add constraint tenant_data_uji_nonaktif check (not data_uji or not aktif),
  add constraint tenant_jam_operasional check (
    (jam_buka is null and jam_tutup is null) or
    (jam_buka is not null and jam_tutup is not null and jam_buka <> jam_tutup
      and jam_buka < time '24:00' and jam_tutup < time '24:00'
      and extract(second from jam_buka) = 0 and extract(second from jam_tutup) = 0)
  );

create function sikantin_private.nama_pengulas(p_ulasan uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((
    select case when akun.alias ~ '^[0-9]+$' then nullif(btrim(a.raw_user_meta_data->>'nama'), '')
      else nullif(akun.alias, '') end
    from sikantin_private.ulasan u join auth.users a on a.id = u.pelanggan_id
    cross join lateral (select split_part(split_part(a.email, '@', 1), '+', 1) as alias) akun
    where u.id = p_ulasan
  ), 'Pelanggan')
$$;
revoke execute on function sikantin_private.nama_pengulas(uuid) from public, anon, authenticated, service_role;

create or replace function public.sikantin_katalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kampus', (select coalesce(jsonb_agg(jsonb_build_object(
      'kode', k.kode, 'nama', k.nama, 'alamat', k.alamat, 'fasilitas', k.fasilitas
    ) order by k.kode), '[]') from public.kampus k where k.aktif),
    'tenant', (select coalesce(jsonb_agg(jsonb_build_object(
      'slug', t.slug, 'nama', t.nama, 'kampus', k.kode, 'deskripsi', t.deskripsi, 'foto', t.foto,
      'jam_buka', t.jam_buka, 'jam_tutup', t.jam_tutup,
      'menu', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'nama', m.nama, 'kategori', m.kategori, 'harga', m.harga, 'deskripsi', m.deskripsi,
        'foto', m.foto, 'tersedia', m.tersedia, 'andalan', m.andalan
      ) order by m.andalan desc, m.nama, m.id), '[]') from public.menu m where m.tenant_id = t.id and m.aktif),
      'statistik', sikantin_private.ringkasan(array[t.id], null, array['menunggu','tayang']),
      'ulasan', (select coalesce(jsonb_agg(jsonb_build_object(
        'aspek', u.aspek, 'nilai', u.nilai, 'status', u.status, 'komentar', u.komentar, 'waktu', u.waktu,
        'nama_pengulas', case when u.komentar <> '' then sikantin_private.nama_pengulas(u.id) end
      ) order by u.waktu desc), '[]') from (
        select * from sikantin_private.ulasan_tayang(array[t.id], null) order by waktu desc, id limit 30
      ) u)
    ) order by k.kode, t.nama, t.id), '[]')
    from public.tenant t join public.kampus k on k.id = t.kampus_id where t.aktif and k.aktif)
  )
$$;

create or replace function public.sikantin_laporan(p_tenant uuid, p_kampus uuid, p_bulan integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  sesi jsonb := public.sikantin_sesi();
  pemilik uuid := (sesi->>'tenant_id')::uuid;
  daftar uuid[];
  dari timestamptz;
begin
  if sesi->>'peran' = 'pemilik' then
    if (p_tenant is not null and p_tenant <> pemilik) or p_kampus is not null then
      raise sqlstate 'PT403' using message = 'Akses ditolak.';
    end if;
    p_tenant := pemilik;
  elsif sesi->>'peran' is distinct from 'admin' then
    raise sqlstate 'PT403' using message = 'Akses ditolak.';
  end if;
  if p_tenant is not null and not exists (select 1 from public.tenant where id = p_tenant and not data_uji) then
    raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
  end if;
  if p_bulan is not null and p_bulan not in (3,6,12) then
    raise sqlstate 'PT422' using message = 'Periode laporan tidak valid.';
  end if;
  if p_bulan is not null then
    dari := (now() at time zone 'Asia/Jakarta' - make_interval(months => p_bulan)) at time zone 'Asia/Jakarta';
  end if;
  -- Arsip dengan penilaian tetap hadir dalam laporan periode terkait.
  select array_agg(t.id) into daftar from public.tenant t
  where not t.data_uji and (p_tenant is null or t.id = p_tenant) and (p_kampus is null or t.kampus_id = p_kampus)
    and (p_tenant is not null or t.aktif or exists (
      select 1 from sikantin_private.ulasan u
      where u.tenant_id = t.id and u.status = 'tayang' and (dari is null or u.waktu >= dari)
    ));

  return (
    with u as materialized (select * from sikantin_private.ulasan_tayang(daftar, dari)),
    per_jam as (
      select extract(hour from waktu at time zone 'Asia/Jakarta')::int jam, count(*) jumlah
      from u group by 1
    ), per_menu as (
      select m.nama, t.nama as tenant, count(*) as jumlah, avg(u.nilai) as nilai
      from u join sikantin_private.ulasan_menu um on um.ulasan_id = u.id
      join public.menu m on m.id = um.menu_id join public.tenant t on t.id = m.tenant_id
      group by m.id, t.id
    ), terakhir as (
      select u.waktu, u.status, u.komentar, u.nilai, t.nama as tenant,
        case when u.komentar <> '' then sikantin_private.nama_pengulas(u.id) end as nama_pengulas
      from u join public.tenant t on t.id = u.tenant_id order by u.waktu desc, u.id limit 100
    )
    select jsonb_build_object(
      'statistik', sikantin_private.ringkasan(daftar, dari),
      'tenant', (select t.nama from public.tenant t where t.id = p_tenant),
      'slug', (select t.slug from public.tenant t where t.id = p_tenant),
      'jam_buka', (select t.jam_buka from public.tenant t where t.id = p_tenant),
      'jam_tutup', (select t.jam_tutup from public.tenant t where t.id = p_tenant),
      'katalog_aktif', (select t.aktif and k.aktif from public.tenant t join public.kampus k on k.id = t.kampus_id where t.id = p_tenant),
      'kampus_nama', (select k.nama from public.kampus k join public.tenant t on t.kampus_id = k.id where t.id = p_tenant),
      'kode_stand', (select d.kode_stand from sikantin_private.detail_tenant d where d.tenant_id = p_tenant),
      'jumlah_menu', (select count(*) from public.menu where aktif and tenant_id = any(daftar)),
      'per_tenant', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'nama', t.nama, 'kampus', k.kode, 'kode_stand', d.kode_stand, 'pemilik', d.nama_pemilik,
        'statistik', sikantin_private.ringkasan(array[t.id], dari)
      ) order by t.nama, t.id), '[]') from public.tenant t join public.kampus k on k.id = t.kampus_id
      left join sikantin_private.detail_tenant d on d.tenant_id = t.id
      where t.id = any(daftar) and sesi->>'peran' = 'admin'),
      'jam', (select jsonb_agg(coalesce(j.jumlah, 0) order by g.jam)
        from generate_series(0,23) g(jam) left join per_jam j using (jam)),
      'ulasan', (select coalesce(jsonb_agg(terakhir order by waktu desc), '[]') from terakhir),
      'menu', (select coalesce(jsonb_agg(per_menu order by jumlah desc, nama), '[]') from per_menu)
    )
  );
end
$$;

create or replace function public.sikantin_admin(p_modul text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform sikantin_private.wajib_peran('admin');
  case p_modul
    when 'kampus' then return (
      select coalesce(jsonb_agg(to_jsonb(k) || jsonb_build_object('alasan_hapus',
        case when exists (select 1 from public.tenant t where t.kampus_id = k.id and not t.data_uji)
          then 'Pindahkan tenant sebelum menghapus kampus.' end) order by k.kode), '[]')
      from public.kampus k
    );
    when 'tenant' then return (
      select coalesce(jsonb_agg(to_jsonb(t) || coalesce(to_jsonb(d) - 'tenant_id' - 'mou_path', '{}') ||
        jsonb_build_object('username', p.username, 'alasan_hapus',
          case when exists (select 1 from sikantin_private.ulasan u where u.tenant_id = t.id)
            then 'Tenant ini memiliki riwayat survei.' end) order by t.nama), '[]')
      from public.tenant t left join sikantin_private.detail_tenant d on d.tenant_id = t.id
      left join sikantin_private.profil p on p.tenant_id = t.id and p.aktif
      where not t.data_uji
    );
    when 'menu' then return (
      select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('alasan_hapus',
        case when exists (select 1 from sikantin_private.ulasan_menu um where um.menu_id = m.id)
          then 'Menu ini pernah dinilai.' end) order by m.nama), '[]')
      from public.menu m join public.tenant t on t.id = m.tenant_id where not t.data_uji
    );
    when 'pertanyaan' then return (
      select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('alasan_hapus',
        case when exists (select 1 from sikantin_private.pertanyaan q join sikantin_private.jawaban j
            on j.pertanyaan_id = q.id where q.kunci = p.kunci)
          then 'Pertanyaan ini pernah dijawab.' end) order by p.urutan, p.kunci), '[]')
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
        where u.status <> 'dihapus' and not t.data_uji order by u.waktu desc, u.id limit 500
      ) baris
    );
    else raise sqlstate 'PT404' using message = 'Bagian tidak ditemukan.';
  end case;
end
$$;

create or replace function public.sikantin_simpan(p_modul text, p_id uuid, p_data jsonb) returns uuid
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
      if p_id is not null and not exists (select 1 from public.tenant where id = p_id and not data_uji) then
        raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
      end if;
      insert into public.tenant (id, kampus_id, slug, nama, deskripsi, foto, aktif)
      values (hasil, (p_data->>'kampus_id')::uuid,
        coalesce((select slug from public.tenant where id = p_id), p_data->>'slug'),
        btrim(p_data->>'nama'), coalesce(btrim(p_data->>'deskripsi'), ''), p_data->>'foto',
        coalesce((p_data->>'aktif')::boolean, false))
      on conflict (id) do update set kampus_id = excluded.kampus_id, nama = excluded.nama,
        deskripsi = excluded.deskripsi, foto = coalesce(excluded.foto, tenant.foto), aktif = excluded.aktif;
      if p_data ?| array['jam_buka', 'jam_tutup'] then
        update public.tenant set jam_buka = nullif(p_data->>'jam_buka', '')::time,
          jam_tutup = nullif(p_data->>'jam_tutup', '')::time where id = hasil;
      end if;
      insert into sikantin_private.detail_tenant
        (tenant_id, kode_stand, nama_pemilik, kontak, kontrak_mulai, kontrak_selesai, status_kontrak, mou_nomor)
      values (hasil, coalesce((select d.kode_stand from sikantin_private.detail_tenant d where d.tenant_id = hasil),
        nextval('sikantin_private.nomor_stand_seq')::text), coalesce(btrim(p_data->>'nama_pemilik'), ''),
        nullif(btrim(p_data->>'kontak'), ''), nullif(p_data->>'kontrak_mulai', '')::date,
        nullif(p_data->>'kontrak_selesai', '')::date, coalesce(p_data->>'status_kontrak', 'aktif'), nullif(btrim(p_data->>'mou_nomor'), ''))
      on conflict (tenant_id) do update set nama_pemilik = excluded.nama_pemilik,
        kontak = excluded.kontak, kontrak_mulai = excluded.kontrak_mulai, kontrak_selesai = excluded.kontrak_selesai,
        status_kontrak = excluded.status_kontrak, mou_nomor = excluded.mou_nomor;
    when 'menu' then
      if not exists (select 1 from public.tenant where id = (p_data->>'tenant_id')::uuid and not data_uji) then
        raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
      end if;
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
      if kunci_baru = any(sikantin_private.aspek_inti()) and not coalesce((p_data->>'aktif')::boolean, true) then
        raise sqlstate 'PT409' using message = 'Lima aspek penilaian utama harus tetap aktif.';
      end if;
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

create or replace function public.sikantin_kelola_master(p_modul text, p_id uuid, p_aksi text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  aktif_baru boolean := p_aksi = 'aktifkan';
  kunci_soal text;
begin
  perform sikantin_private.wajib_peran('admin');
  if p_aksi is null or p_aksi not in ('hapus', 'arsipkan', 'aktifkan') then
    raise sqlstate 'PT422' using message = 'Aksi data tidak valid.';
  end if;

  case p_modul
    when 'kampus' then
      if p_aksi = 'hapus' then
        perform 1 from public.kampus where id = p_id for update;
        if exists (select 1 from public.tenant where kampus_id = p_id and not data_uji) then
          raise sqlstate 'PT409' using message = 'Pindahkan tenant sebelum menghapus kampus.';
        end if;
        update public.tenant set kampus_id = null where kampus_id = p_id and data_uji;
        delete from public.kampus where id = p_id;
      else
        update public.kampus set aktif = aktif_baru where id = p_id;
      end if;
    when 'tenant' then
      perform 1 from public.tenant where id = p_id and not data_uji for update;
      if not found then raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.'; end if;
      if p_aksi = 'hapus' then
        if exists (select 1 from sikantin_private.ulasan where tenant_id = p_id) then
          raise sqlstate 'PT409' using message = 'Tenant ini memiliki riwayat survei. Gunakan Arsipkan.';
        end if;
        delete from sikantin_private.qr where tenant_id = p_id;
        update sikantin_private.profil set aktif = false, tenant_id = null where tenant_id = p_id;
        delete from public.menu where tenant_id = p_id;
        delete from sikantin_private.detail_tenant where tenant_id = p_id;
        delete from public.tenant where id = p_id;
      else
        update public.tenant set aktif = aktif_baru where id = p_id;
      end if;
    when 'menu' then
      if not exists (select 1 from public.menu m join public.tenant t on t.id = m.tenant_id
        where m.id = p_id and not t.data_uji) then
        raise sqlstate 'PT404' using message = 'Menu tidak ditemukan.';
      end if;
      if p_aksi = 'hapus' then
        delete from public.menu where id = p_id;
      else
        update public.menu set aktif = aktif_baru where id = p_id;
      end if;
    when 'pertanyaan' then
      select kunci into kunci_soal from sikantin_private.pertanyaan where id = p_id;
      if not found then raise sqlstate 'PT404' using message = 'Pertanyaan tidak ditemukan.'; end if;
      perform pg_advisory_xact_lock(hashtextextended('pertanyaan:' || kunci_soal, 0));
      if p_id is distinct from (select id from sikantin_private.pertanyaan
        where kunci = kunci_soal order by versi desc limit 1) then
        raise sqlstate 'PT409' using message = 'Muat ulang daftar pertanyaan sebelum mengubah data.';
      end if;
      if kunci_soal = any(sikantin_private.aspek_inti()) and not aktif_baru then
        raise sqlstate 'PT409' using message = 'Lima aspek penilaian utama harus tetap aktif.';
      end if;
      if p_aksi = 'hapus' then
        delete from sikantin_private.pertanyaan where kunci = kunci_soal;
      else
        update sikantin_private.pertanyaan set aktif = aktif_baru where id = p_id;
      end if;
    else raise sqlstate 'PT404' using message = 'Bagian tidak ditemukan.';
  end case;

  if not found then raise sqlstate 'PT404' using message = 'Data tidak ditemukan.'; end if;
exception when foreign_key_violation then
  raise sqlstate 'PT409' using message = 'Data masih terhubung dengan data lain. Arsipkan untuk menyembunyikannya.';
end
$$;

notify pgrst, 'reload schema';

commit;
