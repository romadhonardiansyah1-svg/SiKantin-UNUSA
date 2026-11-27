create table sikantin_private.slide_beranda (
  posisi integer primary key check (posisi between 1 and 3),
  foto text not null,
  alt text not null check (char_length(btrim(alt)) between 1 and 120)
);
alter table sikantin_private.slide_beranda enable row level security;
revoke all on sikantin_private.slide_beranda from public, anon, authenticated, service_role;

create function public.sikantin_slide() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('posisi', posisi, 'foto', foto, 'alt', alt) order by posisi), '[]')
  from sikantin_private.slide_beranda
$$;
revoke execute on function public.sikantin_slide() from public, anon, authenticated, service_role;
grant execute on function public.sikantin_slide() to anon, authenticated;

create function public.sikantin_simpan_slide(p_posisi integer, p_foto text, p_alt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  deskripsi text := btrim(p_alt);
begin
  perform sikantin_private.wajib_peran('admin');
  if p_posisi is null or p_posisi not between 1 and 3
    or coalesce(char_length(deskripsi), 0) not between 1 and 120 then
    raise sqlstate 'PT422' using message = 'Pilih slide dan isi deskripsi gambar.';
  end if;
  if p_foto is null or p_foto !~ '^/foto/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or not exists (select 1 from storage.objects
      where bucket_id = 'foto-kantin' and name = substring(p_foto from 7)) then
    raise sqlstate 'PT422' using message = 'Foto slide belum tersedia.';
  end if;
  insert into sikantin_private.slide_beranda (posisi, foto, alt)
  values (p_posisi, p_foto, deskripsi)
  on conflict (posisi) do update set foto = excluded.foto, alt = excluded.alt;
  return jsonb_build_object('posisi', p_posisi, 'foto', p_foto, 'alt', deskripsi);
end
$$;
revoke execute on function public.sikantin_simpan_slide(integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_simpan_slide(integer, text, text) to authenticated;
