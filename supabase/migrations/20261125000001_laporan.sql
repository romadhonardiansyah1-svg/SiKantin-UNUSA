-- Draf migrasi Tahap 4 (Agen 4): perhitungan rating dan laporan evaluasi.
-- Menunggu skema tabel final dari Agen 1 (kampus, tenant, ulasan, pertanyaan, jawaban_ulasan).
-- Prinsip: satu perhitungan SQL untuk jumlah ulasan, skor per aspek, dan rerata
-- dari aspek inti yang terisi pada ulasan berstatus 'tayang'.

-- Contoh kontrak fungsi SQL laporan (sesuaikan nama tabel/kolom jika skema Agen 1 berbeda):
CREATE OR REPLACE FUNCTION public.laporan_rating_tenant(
  p_kampus text DEFAULT NULL,
  p_tenant_slug text DEFAULT NULL,
  p_mulai timestamptz DEFAULT NULL,
  p_selesai timestamptz DEFAULT NULL
)
RETURNS TABLE (
  tenant_id uuid,
  slug text,
  nama_tenant text,
  jumlah_ulasan bigint,
  nilai_rating numeric(3, 2),
  label_rating text,
  skor_rasa numeric(3, 2),
  skor_kebersihan numeric(3, 2),
  skor_porsi numeric(3, 2),
  skor_kualitas numeric(3, 2),
  skor_pembayaran numeric(3, 2)
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH ulasan_tayang AS (
    SELECT
      u.id AS ulasan_id,
      u.tenant_id
    FROM public.ulasan u
    WHERE u.status_moderasi = 'tayang'
      AND (p_mulai IS NULL OR u.created_at >= p_mulai)
      AND (p_selesai IS NULL OR u.created_at <= p_selesai)
  ),
  jawaban_inti AS (
    SELECT
      ut.tenant_id,
      ut.ulasan_id,
      p.kode_aspek,
      ju.nilai_angka
    FROM ulasan_tayang ut
    JOIN public.jawaban_ulasan ju ON ju.ulasan_id = ut.ulasan_id
    JOIN public.pertanyaan p ON p.id = ju.pertanyaan_id
    WHERE p.aspek_inti = true
      AND ju.nilai_angka BETWEEN 1 AND 5
  )
  SELECT
    t.id AS tenant_id,
    t.slug,
    t.nama AS nama_tenant,
    COUNT(DISTINCT ut.ulasan_id) AS jumlah_ulasan,
    ROUND(AVG(ji.nilai_angka)::numeric, 2) AS nilai_rating,
    COALESCE(
      REPLACE(TO_CHAR(ROUND(AVG(ji.nilai_angka)::numeric, 1), 'FM990.0'), '.', ','),
      'Belum ada penilaian'
    ) AS label_rating,
    ROUND(AVG(ji.nilai_angka) FILTER (WHERE ji.kode_aspek = 'rasa')::numeric, 2) AS skor_rasa,
    ROUND(AVG(ji.nilai_angka) FILTER (WHERE ji.kode_aspek = 'kebersihan')::numeric, 2) AS skor_kebersihan,
    ROUND(AVG(ji.nilai_angka) FILTER (WHERE ji.kode_aspek = 'porsi')::numeric, 2) AS skor_porsi,
    ROUND(AVG(ji.nilai_angka) FILTER (WHERE ji.kode_aspek = 'kualitas')::numeric, 2) AS skor_kualitas,
    ROUND(AVG(ji.nilai_angka) FILTER (WHERE ji.kode_aspek = 'cara_pembayaran')::numeric, 2) AS skor_pembayaran
  FROM public.tenant t
  LEFT JOIN public.kampus k ON k.id = t.kampus_id
  LEFT JOIN ulasan_tayang ut ON ut.tenant_id = t.id
  LEFT JOIN jawaban_inti ji ON ji.ulasan_id = ut.ulasan_id
  WHERE (p_kampus IS NULL OR k.kode = p_kampus)
    AND (p_tenant_slug IS NULL OR t.slug = p_tenant_slug)
  GROUP BY t.id, t.slug, t.nama;
$$;
