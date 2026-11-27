create function sikantin_private.aspek_inti() returns text[]
language sql immutable set search_path = '' as $$
  select array['rasa','kebersihan','porsi','kualitas','cara_pembayaran']
$$;

create table sikantin_private.pertanyaan (
  id uuid primary key default gen_random_uuid(),
  kunci text not null check (kunci ~ '^[a-z][a-z0-9_]{1,49}$'),
  label text not null check (length(btrim(label)) between 1 and 100),
  teks text not null check (length(btrim(teks)) between 1 and 300),
  tipe text not null check (tipe in ('rating','text','boolean')),
  urutan integer not null check (urutan between 1 and 50),
  versi integer not null default 1,
  wajib boolean not null default true,
  aktif boolean not null default true,
  check (tipe = 'rating' or not (kunci = any(sikantin_private.aspek_inti()))),
  unique (kunci, versi)
);
create unique index pertanyaan_aktif_unik on sikantin_private.pertanyaan(kunci) where aktif;

create table sikantin_private.ulasan (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  pelanggan_id uuid not null references auth.users(id),
  kiriman uuid not null,
  status text not null default 'menunggu' check (status in ('menunggu','tayang','sembunyi','spam','dihapus')),
  responden text not null check (responden in ('Mahasiswa','Dosen','Tenaga Kependidikan','Pengunjung')),
  komentar text not null default '' check (length(komentar) <= 1000),
  waktu timestamptz not null default now(),
  unique (pelanggan_id, kiriman)
);
create index ulasan_tenant_waktu on sikantin_private.ulasan (tenant_id, waktu desc);
create index ulasan_batas_kirim on sikantin_private.ulasan (pelanggan_id, tenant_id, waktu desc);

create table sikantin_private.jawaban (
  ulasan_id uuid not null references sikantin_private.ulasan(id) on delete cascade,
  pertanyaan_id uuid not null references sikantin_private.pertanyaan(id),
  nilai jsonb not null,
  primary key (ulasan_id, pertanyaan_id)
);
create table sikantin_private.ulasan_menu (
  ulasan_id uuid not null references sikantin_private.ulasan(id) on delete cascade,
  menu_id uuid not null references public.menu(id),
  primary key (ulasan_id, menu_id)
);

alter table sikantin_private.pertanyaan enable row level security;
alter table sikantin_private.ulasan enable row level security;
alter table sikantin_private.jawaban enable row level security;
alter table sikantin_private.ulasan_menu enable row level security;

insert into sikantin_private.pertanyaan (kunci, label, teks, tipe, urutan) values
  ('rasa', 'Cita rasa', 'Bagaimana cita rasa makanan atau minuman?', 'rating', 1),
  ('kebersihan', 'Kebersihan', 'Bagaimana kebersihan stan dan penyajian?', 'rating', 2),
  ('porsi', 'Porsi', 'Bagaimana porsi makanan atau minuman?', 'rating', 3),
  ('kualitas', 'Kualitas bahan', 'Bagaimana kualitas bahan makanan atau minuman?', 'rating', 4),
  ('cara_pembayaran', 'Pembayaran', 'Bagaimana kemudahan pembayaran?', 'rating', 5);

create view sikantin_private.skor_ulasan with (security_invoker = true) as
  select j.ulasan_id, p.kunci, (j.nilai #>> '{}')::numeric as nilai
  from sikantin_private.jawaban j join sikantin_private.pertanyaan p on p.id = j.pertanyaan_id
  where p.kunci = any(sikantin_private.aspek_inti()) and p.tipe = 'rating';

create function public.sikantin_pertanyaan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(p order by urutan, kunci), '[]')
  from sikantin_private.pertanyaan p where aktif
$$;
revoke execute on function public.sikantin_pertanyaan() from public, anon, authenticated, service_role;
grant execute on function public.sikantin_pertanyaan() to authenticated;

create function public.sikantin_kirim_ulasan(
  p_slug text, p_kiriman uuid, p_responden text, p_komentar text, p_menu uuid[], p_jawaban jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pelanggan uuid := auth.uid();
  gerai uuid;
  hasil sikantin_private.ulasan%rowtype;
begin
  perform sikantin_private.wajib_peran('pelanggan');
  select t.id into gerai from public.tenant t join public.kampus k on k.id = t.kampus_id
    where t.slug = p_slug and t.aktif and k.aktif;
  if gerai is null then
    raise sqlstate 'PT404' using message = 'Tenant tidak tersedia.';
  end if;
  if p_kiriman is null then
    raise sqlstate 'PT422' using message = 'ID kiriman diperlukan.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(pelanggan::text || gerai::text, 0));
  select * into hasil from sikantin_private.ulasan
    where pelanggan_id = pelanggan and kiriman = p_kiriman;
  if found and hasil.tenant_id <> gerai then
    raise sqlstate 'PT409' using message = 'ID kiriman sudah dipakai untuk tenant lain.';
  end if;
  if not found then
    if exists (select 1 from sikantin_private.ulasan
      where pelanggan_id = pelanggan and tenant_id = gerai and waktu > clock_timestamp() - interval '1 minute') then
      raise sqlstate 'PT429' using message = 'Tunggu satu menit sebelum mengirim ulasan lagi.';
    end if;
    if jsonb_typeof(p_jawaban) is distinct from 'object' then
      raise sqlstate 'PT422' using message = 'Isi jawaban survei.';
    end if;
    -- Set jawaban dan versi pertanyaan harus tetap sama sampai transaksi selesai.
    perform 1 from sikantin_private.pertanyaan where aktif for share;
    if exists (
      select 1 from jsonb_each(p_jawaban) j(kunci, nilai)
      left join sikantin_private.pertanyaan q on q.id::text = j.kunci and q.aktif
      where q.id is null or not (case q.tipe
        when 'rating' then jsonb_typeof(j.nilai) = 'number' and (j.nilai #>> '{}') ~ '^[1-5]$'
        when 'boolean' then jsonb_typeof(j.nilai) = 'boolean'
        else jsonb_typeof(j.nilai) = 'string' and length(btrim(j.nilai #>> '{}')) between 1 and 1000 end)
    ) or exists (select 1 from sikantin_private.pertanyaan q
      where q.aktif and q.wajib and not (p_jawaban ? q.id::text)) then
      raise sqlstate 'PT422' using message = 'Periksa jawaban dan kelengkapan pertanyaan wajib.';
    end if;
    if exists (
      select 1 from unnest(p_menu) pilihan(id)
      where not exists (select 1 from public.menu m where m.id = pilihan.id and m.tenant_id = gerai and m.aktif)
    ) then
      raise sqlstate 'PT422' using message = 'Pilih menu yang tersedia di tenant ini.';
    end if;
    insert into sikantin_private.ulasan (tenant_id, pelanggan_id, kiriman, responden, komentar, waktu)
    values (gerai, pelanggan, p_kiriman, p_responden, btrim(coalesce(p_komentar, '')), clock_timestamp())
    returning * into hasil;
    insert into sikantin_private.jawaban (ulasan_id, pertanyaan_id, nilai)
      select hasil.id, j.kunci::uuid, j.nilai from jsonb_each(p_jawaban) j(kunci, nilai);
    insert into sikantin_private.ulasan_menu (ulasan_id, menu_id)
      select distinct hasil.id, id from unnest(p_menu) pilihan(id);
  end if;
  return jsonb_build_object('id', hasil.id, 'nilai', (select avg(nilai) from sikantin_private.skor_ulasan where ulasan_id = hasil.id));
end
$$;
revoke execute on function public.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_kirim_ulasan(text,uuid,text,text,uuid[],jsonb) to authenticated;

create table sikantin_private.qr (
  tenant_id uuid primary key references public.tenant(id),
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
);
alter table sikantin_private.qr enable row level security;

create function public.sikantin_tujuan_qr(p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select t.slug from sikantin_private.qr q
  join public.tenant t on t.id = q.tenant_id
  join public.kampus k on k.id = t.kampus_id
  where q.token = p_token and t.aktif and k.aktif
$$;
revoke execute on function public.sikantin_tujuan_qr(text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_tujuan_qr(text) to anon, authenticated;
