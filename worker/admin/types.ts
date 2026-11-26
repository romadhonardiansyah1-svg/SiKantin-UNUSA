export type UserRole = 'pelanggan' | 'pemilik' | 'admin';

export type ContractStatus = 'aktif' | 'akan_habis' | 'berakhir' | 'nonaktif';

export interface AuthSession {
  userId: string;
  email?: string;
  role: UserRole;
  accessToken?: string;
  tenantId?: string | null;
}

export interface AdminEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TENANT_PHOTO_BUCKET?: string;
  ALLOWED_ORIGINS?: string;
}

export interface CampusRecord {
  id: string;
  kode: string;
  nama: string;
}

export interface TenantRecord {
  id: string;
  campus_id: string;
  stall_number: string;
  name: string;
  slug: string;
  owner_name: string;
  phone: string;
  description: string;
  photo_url: string | null;
  contract_start: string | null;
  contract_end: string | null;
  contract_status: ContractStatus;
  is_active: boolean;
  username: string | null;
  owner_email?: string | null;
  mou_number?: string | null;
  qr_active: boolean;
  menu_count: number;
  review_count: number;
  avg_rating: number | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export interface NormalizedTenantInput {
  campus_id: string;
  stall_number: string;
  name: string;
  slug: string;
  owner_name: string;
  phone: string;
  description: string;
  contract_start: string | null;
  contract_end: string | null;
  contract_status: ContractStatus;
  is_active: boolean;
  username: string | null;
  password: string | null;
  owner_email: string | null;
  mou_number: string | null;
}

export interface ValidatedPhoto {
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  size: number;
}

export interface TenantRepository {
  listCampuses(): Promise<CampusRecord[]>;
  listTenants(filter: { campusId?: string; query?: string }): Promise<TenantRecord[]>;
  getTenant(idOrSlug: string): Promise<TenantRecord | null>;
  createTenant(input: NormalizedTenantInput, photo?: ValidatedPhoto | null): Promise<TenantRecord>;
  updateTenant(
    id: string,
    input: NormalizedTenantInput,
    photo?: ValidatedPhoto | null
  ): Promise<TenantRecord | null>;
  archiveOrDeleteTenant(
    id: string
  ): Promise<{ archived: boolean; deleted: boolean; tenant?: TenantRecord } | null>;
}
