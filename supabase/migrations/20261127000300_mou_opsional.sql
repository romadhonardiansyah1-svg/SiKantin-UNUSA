create or replace function public.sikantin_tautkan_pemilik(p_tenant uuid, p_akun uuid, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform sikantin_private.wajib_peran('admin');
  if p_akun is null then
    update sikantin_private.profil set aktif = false, tenant_id = null
    where tenant_id = p_tenant and peran = 'pemilik';
    return;
  end if;
  if not exists (select 1 from public.tenant where id = p_tenant) then
    raise sqlstate 'PT404' using message = 'Tenant tidak ditemukan.';
  end if;
  if not exists (select 1 from auth.users where id = p_akun and raw_app_meta_data->>'sikantin_staf' = 'true') then
    raise sqlstate 'PT422' using message = 'Akun pemilik belum disiapkan.';
  end if;
  insert into sikantin_private.profil (id, peran, username, tenant_id)
  values (p_akun, 'pemilik', p_username, p_tenant);
end
$$;
