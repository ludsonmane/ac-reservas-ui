// src/ui/hooks/useAreasAdmin.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type AreaFilters = {
  page?: number;
  pageSize?: number;
  unitId?: string | '';
  search?: string | '';
  active?: '' | boolean;
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
};

export type AreasPage = {
  items: AreaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function useAreasAdmin(filters: AreaFilters) {
  const key = React.useMemo(
    () =>
      `areas:admin:${JSON.stringify({
        p: filters.page ?? 1,
        s: filters.pageSize ?? 10,
        u: filters.unitId || '',
        q: filters.search || '',
        a: filters.active === '' ? '' : !!filters.active,
      })}`,
    [filters.page, filters.pageSize, filters.unitId, filters.search, filters.active]
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

      // 🔐 precisa de auth para admin
      const res = await api(`/v1/areas?${params.toString()}`, { auth: true });

      // normaliza estrutura — aceita { items } ou { data }
      const rawItems = res?.items ?? res?.data ?? [];
      const page: AreasPage = {
        items: rawItems.map((a: any) => ({
          id: String(a.id ?? a._id),
          name: String(a.name ?? ''),
          unitId: String(a.unitId ?? a.unit?.id ?? ''),
          unitName: a.unitName ?? a.unit?.name ?? a.unit ?? undefined,
          photoUrl: a.photoUrl ?? null,
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
        })),
        total: Number(res?.total ?? res?.count ?? rawItems.length ?? 0),
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
