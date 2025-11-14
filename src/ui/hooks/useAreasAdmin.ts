// src/ui/hooks/useAreasAdmin.ts
import * as React from 'react';
import { api, getBaseUrl } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type AreaFilters = {
  page?: number;
  pageSize?: number;
  unitId?: string | '';
  search?: string | '';
  active?: '' | boolean;
  /** tick opcional para forçar revalidação (ex.: após salvar/excluir) */
  _rt?: number;
};

export type AreaItem = {
  id: string;
  name: string;
  unitId: string;
  unitName?: string;
  photoUrl?: string | null;
  capacityAfternoon: number | null;
  capacityNight: number | null;
  isActive: boolean;
  createdAt?: string;

  // ✅ NOVOS CAMPOS
  iconEmoji?: string | null;
  description?: string | null;
};

export type AreasPage = {
  items: AreaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/* ===== helpers p/ normalizar foto ===== */
function toHttps(u: string) {
  try {
    const url = new URL(u);
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch {
    // não era absoluta
  }
  return u;
}
function sanitizePhoto(raw?: any): string | undefined {
  if (raw == null) return undefined;
  const value = typeof raw === 'object' && 'url' in (raw as any) ? String((raw as any).url ?? '') : String(raw);
  const r = value.trim();
  if (!r || r === 'null' || r === 'undefined' || r === '[object Object]') return undefined;
  return r;
}
function resolvePhotoUrl(raw?: any): string | undefined {
  let s = sanitizePhoto(raw);
  if (!s) return undefined;

  s = s.replace(/\\/g, '/').trim();

  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return toHttps(s);

  s = s.replace(/^\/+/, '/');
  const ASSET_BASE = (getBaseUrl() || '').replace(/\/+$/, '');
  if (!ASSET_BASE) return s.startsWith('/') ? s : `/${s}`;
  if (s.startsWith(ASSET_BASE)) return toHttps(s);
  return toHttps(`${ASSET_BASE}${s.startsWith('/') ? s : `/${s}`}`);
}
/* ===================================== */

export function useAreasAdmin(filters: AreaFilters) {
  const key = React.useMemo(
    () =>
      `areas:admin:${JSON.stringify({
        p: filters.page ?? 1,
        s: filters.pageSize ?? 10,
        u: filters.unitId || '',
        q: filters.search || '',
        a: filters.active === '' ? '' : !!filters.active,
        rt: filters._rt ?? 0, // 👈 garante refetch quando _rt muda
      })}`,
    [filters.page, filters.pageSize, filters.unitId, filters.search, filters.active, filters._rt]
  );

  const { data, loading, error, refetch } = useQuery<AreasPage>(
    key,
    async () => {
      const params = new URLSearchParams();
      params.set('page', String(filters.page ?? 1));
      params.set('pageSize', String(filters.pageSize ?? 10));
      if (filters.search) params.set('search', String(filters.search));
      if (filters.unitId) params.set('unitId', String(filters.unitId));
      if (filters.active !== '' && typeof filters.active === 'boolean') {
        params.set('active', String(filters.active));
      }
      // cache-buster para evitar respostas em cache do navegador/proxy
      params.set('__ts', String(Date.now()));

      // 🔐 precisa de auth para admin
      const res = await api(`/v1/areas?${params.toString()}`, { auth: true });

      const rawItems = res?.items ?? res?.data ?? [];
      const items: AreaItem[] = (rawItems as any[]).map((a) => {
        const photo =
          a.photoUrl ??
          a.photo ??
          a.imageUrl ??
          a.image ??
          a.coverUrl ??
          a.photo_url;

        return {
          id: String(a.id ?? a._id),
          name: String(a.name ?? ''),
          unitId: String(a.unitId ?? a.unit?.id ?? ''),
          unitName: a.unitName ?? a.unit?.name ?? a.unit ?? undefined,
          photoUrl: resolvePhotoUrl(photo) ?? null,
          capacityAfternoon:
            a.capacityAfternoon !== undefined
              ? (a.capacityAfternoon ?? null)
              : (a.capacity_afternoon ?? null),
          capacityNight:
            a.capacityNight !== undefined
              ? (a.capacityNight ?? null)
              : (a.capacity_night ?? null),
          isActive: !!(a.isActive ?? a.active ?? true),
          createdAt: a.createdAt ?? a.created_at ?? undefined,

          // ✅ NOVOS CAMPOS (camel + snake)
          iconEmoji: a.iconEmoji ?? a.icon_emoji ?? null,
          description: a.description ?? null,
        };
      });

      const page: AreasPage = {
        items,
        total: Number(res?.total ?? res?.count ?? items.length ?? 0),
        page: Number(res?.page ?? 1),
        pageSize: Number(res?.pageSize ?? res?.limit ?? 10),
        totalPages: Number(res?.totalPages ?? res?.pages ?? 1),
      };

      return page;
    },
    { enabled: true, topics: ['areas', 'units'] }
  );

  return {
    data:
      data ?? {
        items: [],
        total: 0,
        page: 1,
        pageSize: filters.pageSize ?? 10,
        totalPages: 1,
      },
    loading,
    error,
    refetch,
  };
}
