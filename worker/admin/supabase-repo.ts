import type {
  AdminEnv,
  AuthSession,
  CampusRecord,
  NormalizedTenantInput,
  TenantRecord,
  TenantRepository,
  ValidatedPhoto
} from './types.ts';

export class ConflictError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ConflictError';
    this.fieldErrors = fieldErrors;
  }
}

export class SupabaseTenantRepository implements TenantRepository {
  private readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly serviceRoleKey?: string;
  private readonly userToken: string;
  private readonly photoBucket: string;

  constructor(env: AdminEnv, session: AuthSession) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('Konfigurasi Supabase belum lengkap.');
    }
    this.baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    this.anonKey = env.SUPABASE_ANON_KEY;
    this.serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    this.userToken = session.accessToken || env.SUPABASE_ANON_KEY;
    this.photoBucket = env.TENANT_PHOTO_BUCKET || 'tenant-photos';
  }

  private headers(extra: Record<string, string> = {}, useServiceRole = false): Record<string, string> {
    const key = useServiceRole && this.serviceRoleKey ? this.serviceRoleKey : this.anonKey;
    const token = useServiceRole && this.serviceRoleKey ? this.serviceRoleKey : this.userToken;
    return {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...extra
    };
  }

  private async rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: this.headers(
        {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined)
        },
        false
      )
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      if (res.status === 409 || json?.code === '23505') {
        const msg = String(json?.message || json?.details || '');
        const fieldErrors: Record<string, string> = {};
        if (msg.includes('stall')) fieldErrors.stall_number = 'Nomor stan sudah digunakan di kampus ini.';
        else if (msg.includes('slug')) fieldErrors.name = 'Nama tenant menghasilkan slug yang sudah terdaftar.';
        else if (msg.includes('username')) fieldErrors.username = 'Username pemilik sudah digunakan.';
        throw new ConflictError('Data duplikat terdeteksi pada tenant.', fieldErrors);
      }
      throw new Error(json?.message || `Supabase REST error (${res.status})`);
    }
    return json as T;
  }

  private async uploadPhoto(slug: string, photo: ValidatedPhoto): Promise<string> {
    const filePath = `stands/${slug}-${Date.now()}.${photo.extension}`;
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${this.photoBucket}/${filePath}`, {
      method: 'POST',
      headers: this.headers(
        {
          'Content-Type': photo.contentType,
          'x-upsert': 'true'
        },
        true
      ),
      body: photo.bytes
    });
    if (!res.ok) {
      throw new Error('Gagal mengunggah foto tenant ke penyimpanan.');
    }
    return `${this.baseUrl}/storage/v1/object/public/${this.photoBucket}/${filePath}`;
  }

  private async syncOwnerAccount(input: NormalizedTenantInput, tenantId: string): Promise<void> {
    if (!input.username || !input.password || !this.serviceRoleKey) return;
    const email = input.owner_email || `${input.username}@pemilik.sikantin.local`;
    const res = await fetch(`${this.baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }, true),
      body: JSON.stringify({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          role: 'pemilik',
          username: input.username,
          tenant_id: tenantId
        }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      if (res.status === 422) {
        throw new ConflictError('Akun pemilik dengan username/email tersebut sudah ada.', {
          username: 'Username atau email pemilik sudah terdaftar.'
        });
      }
      throw new Error(err?.msg || 'Gagal membuat akun portal pemilik.');
    }
  }

  async listCampuses(): Promise<CampusRecord[]> {
    const rows = await this.rest<Array<Record<string, unknown>>>(
      'campuses?select=id,code,name&order=id.asc'
    );
    return rows.map(r => ({
      id: String(r.id),
      kode: String(r.code),
      nama: String(r.name)
    }));
  }

  async listTenants(filter: { campusId?: string; query?: string }): Promise<TenantRecord[]> {
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('order', 'id.asc');
    if (filter.campusId && filter.campusId !== '0') {
      params.set('campus_id', `eq.${filter.campusId}`);
    }
    const rows = await this.rest<TenantRecord[]>(`tenants?${params.toString()}`);
    const q = (filter.query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(t =>
      [t.name, t.stall_number, t.owner_name, t.phone, t.slug, t.username]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    );
  }

  async getTenant(idOrSlug: string): Promise<TenantRecord | null> {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const col = isNumeric ? 'id' : 'slug';
    const rows = await this.rest<TenantRecord[]>(
      `tenants?${col}=eq.${encodeURIComponent(idOrSlug)}&select=*&limit=1`
    );
    return rows[0] || null;
  }

  async createTenant(
    input: NormalizedTenantInput,
    photo?: ValidatedPhoto | null
  ): Promise<TenantRecord> {
    const photoUrl = photo ? await this.uploadPhoto(input.slug, photo) : null;
    const { password: _password, ...dbFields } = input;
    const rows = await this.rest<TenantRecord[]>('tenants', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...dbFields,
        photo_url: photoUrl
      })
    });
    const created = rows[0];
    if (created && input.username && input.password) {
      await this.syncOwnerAccount(input, String(created.id));
    }
    return created;
  }

  async updateTenant(
    id: string,
    input: NormalizedTenantInput,
    photo?: ValidatedPhoto | null
  ): Promise<TenantRecord | null> {
    const existing = await this.getTenant(id);
    if (!existing) return null;
    const photoUrl = photo ? await this.uploadPhoto(input.slug, photo) : existing.photo_url;
    const { password: _password, ...dbFields } = input;
    const rows = await this.rest<TenantRecord[]>(
      `tenants?id=eq.${encodeURIComponent(String(existing.id))}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          ...dbFields,
          photo_url: photoUrl,
          updated_at: new Date().toISOString()
        })
      }
    );
    const updated = rows[0] || null;
    if (updated && input.username && input.password) {
      await this.syncOwnerAccount(input, String(updated.id));
    }
    return updated;
  }

  async archiveOrDeleteTenant(
    id: string
  ): Promise<{ archived: boolean; deleted: boolean; tenant?: TenantRecord } | null> {
    const existing = await this.getTenant(id);
    if (!existing) return null;
    if (Number(existing.review_count || 0) > 0) {
      const rows = await this.rest<TenantRecord[]>(
        `tenants?id=eq.${encodeURIComponent(String(existing.id))}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            is_active: false,
            contract_status: 'nonaktif',
            archived_at: new Date().toISOString()
          })
        }
      );
      return { archived: true, deleted: false, tenant: rows[0] };
    }
    await this.rest(`tenants?id=eq.${encodeURIComponent(String(existing.id))}`, {
      method: 'DELETE'
    });
    return { archived: false, deleted: true };
  }
}
