create or replace function public.sikantin_sesi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'peran', coalesce(p.peran, 'pelanggan'),
    'tenant_id', p.tenant_id,
    'status', case
      when p.id is not null then null
      when u.raw_user_meta_data->>'status' in ('Mahasiswa','Dosen','Tenaga Kependidikan','Pengunjung')
        then u.raw_user_meta_data->>'status'
      else 'Pengunjung'
    end
  )
  from auth.users u
  left join sikantin_private.profil p on p.id = u.id
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and coalesce(p.aktif, true)
    and (p.id is not null or (
      coalesce(u.raw_app_meta_data->>'sikantin_staf', 'false') <> 'true'
      and sikantin_private.email_pelanggan(u.email)
    ))
$$;

alter function public.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb) set schema sikantin_private;
revoke execute on function sikantin_private.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb)
  from public, anon, authenticated, service_role;

-- Pertahankan tanda tangan RPC agar Worker sebelum migrasi masih dapat mengirim ulasan.
create function public.sikantin_kirim_ulasan(
  p_slug text, p_kiriman uuid, p_responden text, p_komentar text, p_menu uuid[], p_jawaban jsonb
) returns jsonb
language sql security definer set search_path = '' as $$
  select sikantin_private.sikantin_kirim_ulasan(
    p_slug, p_kiriman, public.sikantin_sesi()->>'status', p_komentar, p_menu, p_jawaban
  )
$$;
revoke execute on function public.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb) to authenticated;

create function sikantin_private.nilai_ulasan(p_tenants uuid[], p_dari timestamptz, p_status text[])
returns table (id uuid, tenant_id uuid, waktu timestamptz, status text, komentar text,
  aspek numeric[], jumlah_nilai bigint, total_nilai numeric, nilai numeric)
language sql stable set search_path = '' as $$
  select u.id, u.tenant_id, u.waktu, u.status, u.komentar,
    array_agg(s.nilai order by a.urut), count(s.nilai), sum(s.nilai), avg(s.nilai)
  from sikantin_private.ulasan u
  cross join unnest(sikantin_private.aspek_inti()) with ordinality a(kunci, urut)
  left join sikantin_private.skor_ulasan s on s.ulasan_id = u.id and s.kunci = a.kunci
  where u.tenant_id = any(p_tenants) and u.status = any(p_status)
    and (p_dari is null or u.waktu >= p_dari)
  group by u.id
$$;

create or replace function sikantin_private.ulasan_tayang(p_tenants uuid[], p_dari timestamptz)
returns table (id uuid, tenant_id uuid, waktu timestamptz, status text, komentar text,
  aspek numeric[], jumlah_nilai bigint, total_nilai numeric, nilai numeric)
language sql stable set search_path = '' as $$
  select * from sikantin_private.nilai_ulasan(p_tenants, p_dari, array['tayang'])
$$;

create function sikantin_private.ringkasan(p_tenants uuid[], p_dari timestamptz, p_status text[]) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('jumlah', count(*), 'nilai', sum(total_nilai) / nullif(sum(jumlah_nilai), 0),
    'aspek', array[avg(aspek[1]),avg(aspek[2]),avg(aspek[3]),avg(aspek[4]),avg(aspek[5])])
  from sikantin_private.nilai_ulasan(p_tenants, p_dari, p_status)
$$;

create or replace function sikantin_private.ringkasan(p_tenants uuid[], p_dari timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select sikantin_private.ringkasan(p_tenants, p_dari, array['tayang'])
$$;

create or replace function public.sikantin_katalog() returns jsonb
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
      'statistik', sikantin_private.ringkasan(array[t.id], null, array['menunggu','tayang']),
      'ulasan', (select coalesce(jsonb_agg(jsonb_build_object(
        'aspek', u.aspek, 'nilai', u.nilai, 'status', u.status, 'komentar', u.komentar, 'waktu', u.waktu
      ) order by u.waktu desc), '[]') from (
        select * from sikantin_private.ulasan_tayang(array[t.id], null) order by waktu desc, id limit 30
      ) u)
    ) order by k.kode, t.nama, t.id), '[]')
    from public.tenant t join public.kampus k on k.id = t.kampus_id where t.aktif and k.aktif)
  )
$$;

notify pgrst, 'reload schema';
