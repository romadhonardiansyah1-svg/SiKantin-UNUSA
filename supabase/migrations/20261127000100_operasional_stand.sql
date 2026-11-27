begin;

alter table sikantin_private.ulasan alter column status set default 'tayang';
update sikantin_private.ulasan set status = 'tayang' where status = 'menunggu';

lock table public.tenant in share row exclusive mode;
create sequence sikantin_private.nomor_stand_seq;
alter sequence sikantin_private.nomor_stand_seq owned by sikantin_private.detail_tenant.kode_stand;
alter table sikantin_private.detail_tenant
  alter column kode_stand set default nextval('sikantin_private.nomor_stand_seq')::text;

-- Pertahankan nomor lama yang unik dan lanjutkan setelah nomor numerik terakhir.
select setval('sikantin_private.nomor_stand_seq', coalesce(max(
  case when btrim(kode_stand) ~ '^[0-9]{1,18}$' then btrim(kode_stand)::bigint end
), 0) + 1, false) from sikantin_private.detail_tenant;

with urutan as (
  select tenant_id, row_number() over (partition by lower(btrim(kode_stand)) order by tenant_id) as nomor
  from sikantin_private.detail_tenant
)
update sikantin_private.detail_tenant d set kode_stand = default
from urutan u where u.tenant_id = d.tenant_id and (u.nomor > 1 or nullif(btrim(d.kode_stand), '') is null);

insert into sikantin_private.detail_tenant (tenant_id)
select t.id from public.tenant t
where not exists (select 1 from sikantin_private.detail_tenant d where d.tenant_id = t.id);

alter table sikantin_private.detail_tenant
  alter column kode_stand set not null,
  add constraint kode_stand_tidak_kosong check (btrim(kode_stand) <> '');
create unique index detail_tenant_kode_stand_unik on sikantin_private.detail_tenant (lower(btrim(kode_stand)));

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
      values (hasil, coalesce((select d.kode_stand from sikantin_private.detail_tenant d where d.tenant_id = hasil),
        nextval('sikantin_private.nomor_stand_seq')::text), coalesce(btrim(p_data->>'nama_pemilik'), ''),
        nullif(btrim(p_data->>'kontak'), ''), nullif(p_data->>'kontrak_mulai', '')::date,
        nullif(p_data->>'kontrak_selesai', '')::date, coalesce(p_data->>'status_kontrak', 'aktif'), nullif(btrim(p_data->>'mou_nomor'), ''))
      on conflict (tenant_id) do update set nama_pemilik = excluded.nama_pemilik,
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

create function public.sikantin_kelola_master(p_modul text, p_id uuid, p_aksi text) returns void
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
        delete from public.kampus where id = p_id;
      else
        update public.kampus set aktif = aktif_baru where id = p_id;
      end if;
    when 'tenant' then
      if p_aksi = 'hapus' then
        perform 1 from public.tenant where id = p_id for update;
        delete from sikantin_private.detail_tenant where tenant_id = p_id;
        delete from public.tenant where id = p_id;
      else
        update public.tenant set aktif = aktif_baru where id = p_id;
      end if;
    when 'menu' then
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
revoke execute on function public.sikantin_kelola_master(text,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.sikantin_kelola_master(text,uuid,text) to authenticated;

commit;
