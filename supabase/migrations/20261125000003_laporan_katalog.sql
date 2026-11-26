create function sikantin_private.ulasan_tayang(p_tenants uuid[], p_dari timestamptz)
returns table (id uuid, tenant_id uuid, waktu timestamptz, status text, komentar text,
  aspek numeric[], jumlah_nilai bigint, total_nilai numeric, nilai numeric)
language sql stable set search_path = '' as $$
  select u.id, u.tenant_id, u.waktu, u.responden, u.komentar,
    array_agg(s.nilai order by a.urut), count(s.nilai), sum(s.nilai), avg(s.nilai)
  from sikantin_private.ulasan u
  cross join unnest(sikantin_private.aspek_inti()) with ordinality a(kunci, urut)
  left join sikantin_private.skor_ulasan s on s.ulasan_id = u.id and s.kunci = a.kunci
  where u.tenant_id = any(p_tenants) and u.status = 'tayang'
    and (p_dari is null or u.waktu >= p_dari)
  group by u.id
$$;

create function sikantin_private.ringkasan(p_tenants uuid[], p_dari timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('jumlah', count(*), 'nilai', sum(total_nilai) / nullif(sum(jumlah_nilai), 0),
    'aspek', array[avg(aspek[1]),avg(aspek[2]),avg(aspek[3]),avg(aspek[4]),avg(aspek[5])])
  from sikantin_private.ulasan_tayang(p_tenants, p_dari)
$$;

create function public.sikantin_katalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kampus', (select coalesce(jsonb_agg(jsonb_build_object(
      'kode', k.kode, 'nama', k.nama, 'alamat', k.alamat, 'fasilitas', k.fasilitas
    ) order by k.kode), '[]') from public.kampus k where k.aktif),
    'tenant', (select coalesce(jsonb_agg(jsonb_build_object(
      'slug', t.slug, 'nama', t.nama, 'kampus', k.kode, 'deskripsi', t.deskripsi, 'foto', t.foto,
      'menu', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'nama', m.nama, 'kategori', m.kategori, 'harga', m.harga, 'deskripsi', m.deskripsi,
        'foto', m.foto, 'tersedia', m.tersedia, 'andalan', m.andalan
      ) order by m.andalan desc, m.nama, m.id), '[]') from public.menu m where m.tenant_id = t.id and m.aktif),
      'statistik', sikantin_private.ringkasan(array[t.id], null),
      'ulasan', (select coalesce(jsonb_agg(jsonb_build_object(
        'aspek', u.aspek, 'nilai', u.nilai, 'status', u.status, 'komentar', u.komentar, 'waktu', u.waktu
      ) order by u.waktu desc), '[]') from (
        select * from sikantin_private.ulasan_tayang(array[t.id], null) order by waktu desc, id limit 30
      ) u)
    ) order by k.kode, t.nama, t.id), '[]')
    from public.tenant t join public.kampus k on k.id = t.kampus_id where t.aktif and k.aktif)
  )
$$;
revoke execute on function public.sikantin_katalog() from public, anon, authenticated, service_role;
grant execute on function public.sikantin_katalog() to anon, authenticated;

create function public.sikantin_laporan(p_tenant uuid, p_kampus uuid, p_bulan integer) returns jsonb
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
  if p_bulan is not null and p_bulan not in (3,6,12) then
    raise sqlstate 'PT422' using message = 'Periode laporan tidak valid.';
  end if;
  if p_bulan is not null then
    dari := (now() at time zone 'Asia/Jakarta' - make_interval(months => p_bulan)) at time zone 'Asia/Jakarta';
  end if;
  select array_agg(id) into daftar from public.tenant
    where (p_tenant is null or id = p_tenant) and (p_kampus is null or kampus_id = p_kampus);

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
      select u.waktu, u.status, u.komentar, u.nilai, t.nama as tenant
      from u join public.tenant t on t.id = u.tenant_id order by u.waktu desc, u.id limit 100
    )
    select jsonb_build_object(
      'statistik', sikantin_private.ringkasan(daftar, dari),
      'tenant', (select t.nama from public.tenant t where t.id = p_tenant),
      'slug', (select t.slug from public.tenant t where t.id = p_tenant),
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
revoke execute on function public.sikantin_laporan(uuid,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_laporan(uuid,uuid,integer) to authenticated;
