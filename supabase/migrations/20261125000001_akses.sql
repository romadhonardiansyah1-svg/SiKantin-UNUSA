alter table public.kampus
  add column alamat text not null default '',
  add column fasilitas text not null default '',
  add column jumlah_stand integer not null default 1 check (jumlah_stand between 1 and 50);

alter table sikantin_private.detail_tenant
  add column nama_pemilik text not null default '',
  add column kontrak_mulai date,
  add column kontrak_selesai date,
  add column mou_nomor text,
  add column status_kontrak text not null default 'aktif'
    check (status_kontrak in ('aktif', 'nonaktif', 'akan_habis', 'berakhir')),
  add constraint kontrak_urut check (kontrak_mulai <= kontrak_selesai);

create table sikantin_private.profil (
  id uuid primary key references auth.users(id) on delete cascade,
  peran text not null check (peran in ('admin', 'pemilik')),
  username text not null unique check (username ~ '^[a-z0-9_.-]{3,40}$'),
  tenant_id uuid unique references public.tenant(id),
  aktif boolean not null default true,
  check (peran <> 'admin' or tenant_id is null),
  check (not aktif or peran <> 'pemilik' or tenant_id is not null)
);
alter table sikantin_private.profil enable row level security;
revoke all on sikantin_private.profil from public, anon, authenticated, service_role;
grant select, insert, update on sikantin_private.profil to service_role;

create function sikantin_private.email_pelanggan(email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(lower(btrim(email)) ~ '^[^@[:space:]]+@(gmail[.]com|unusa[.]ac[.]id|student[.]unusa[.]ac[.]id)$', false)
$$;

create function public.sikantin_email_pendaftaran(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when sikantin_private.email_pelanggan(event #>> '{user,email}') then '{}'::jsonb
    else '{"error":{"http_code":403,"message":"Gunakan @gmail.com, @unusa.ac.id, atau @student.unusa.ac.id."}}'::jsonb end
$$;
revoke execute on function public.sikantin_email_pendaftaran(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_email_pendaftaran(jsonb) to supabase_auth_admin;

create function public.sikantin_sesi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('peran', coalesce(p.peran, 'pelanggan'), 'tenant_id', p.tenant_id)
  from auth.users u
  left join sikantin_private.profil p on p.id = u.id
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and coalesce(p.aktif, true)
    and (p.id is not null or (
      coalesce(u.raw_app_meta_data->>'sikantin_staf', 'false') <> 'true'
      and sikantin_private.email_pelanggan(u.email)
    ))
$$;
revoke execute on function public.sikantin_sesi() from public, anon, authenticated, service_role;
grant execute on function public.sikantin_sesi() to authenticated;

create function sikantin_private.wajib_peran(diharapkan text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if (public.sikantin_sesi()->>'peran') is distinct from diharapkan then
    raise sqlstate 'PT403' using message = 'Akses ditolak.';
  end if;
end
$$;

create function public.sikantin_email_staf(p_username text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u join sikantin_private.profil p on p.id = u.id
  where p.username = p_username and p.aktif
$$;
revoke execute on function public.sikantin_email_staf(text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_email_staf(text) to service_role;

create function public.sikantin_tautkan_pemilik(p_tenant uuid, p_akun uuid, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform sikantin_private.wajib_peran('admin');
  if p_akun is null then
    update sikantin_private.profil set aktif = false, tenant_id = null
    where tenant_id = p_tenant and peran = 'pemilik';
    return;
  end if;
  if not exists (select 1 from sikantin_private.detail_tenant where tenant_id = p_tenant and length(btrim(coalesce(mou_nomor, ''))) > 0) then
    raise sqlstate 'PT422' using message = 'Isi nomor MoU sebelum mengaktifkan akses pemilik.';
  end if;
  if not exists (select 1 from auth.users where id = p_akun and raw_app_meta_data->>'sikantin_staf' = 'true') then
    raise sqlstate 'PT422' using message = 'Akun pemilik belum disiapkan.';
  end if;
  insert into sikantin_private.profil (id, peran, username, tenant_id)
  values (p_akun, 'pemilik', p_username, p_tenant);
end
$$;
revoke execute on function public.sikantin_tautkan_pemilik(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_tautkan_pemilik(uuid,uuid,text) to authenticated;

create function public.sikantin_pengelola() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.sikantin_sesi()->>'peran' = 'admin', false)
$$;
revoke execute on function public.sikantin_pengelola() from public, anon, authenticated, service_role;
grant execute on function public.sikantin_pengelola() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-kantin', 'foto-kantin', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Pengelola mengunggah foto kantin" on storage.objects
  for insert to authenticated with check (bucket_id = 'foto-kantin' and public.sikantin_pengelola());
create policy "Pengelola membaca metadata foto kantin" on storage.objects
  for select to authenticated using (bucket_id = 'foto-kantin' and public.sikantin_pengelola());
create policy "Pengelola menghapus foto kantin" on storage.objects
  for delete to authenticated using (bucket_id = 'foto-kantin' and public.sikantin_pengelola());
