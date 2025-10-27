// src/ui/hooks/useUnits.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type UnitOption = { id: string; name: string; slug: string };

/**
 * Retorna as unidades como objetos { id, name, slug } para selects/filtros.
 * - Key estável: "units:all"
 * - topics: ['units'] para reagir a invalidate('units')
 * - Sem keepPreviousData para não grudar snapshot antigo após writes
 * - Fallback: público -> autenticado paginado
 */
export function useUnits(enabled: boolean = true) {
  const key = React.useMemo(() => 'units:all', []);

  const { data, loading, refetch } = useQuery<UnitOption[]>(
    key,
    async () => {
      // 1) Tenta endpoint público leve
      try {
        const list = await api('/v1/units/public/options/list');
        const normalized: UnitOption[] = (list ?? []).map((u: any) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ''),
          slug: String(u.slug ?? ''),
        }));
        normalized.sort((a, b) => a.name.localeCompare(b.name));
        return normalized;
      } catch {
        // 2) Fallback: endpoint autenticado paginado
        const page = await api('/v1/units?page=1&pageSize=1000', { auth: true });
        const items = Array.isArray(page) ? page : page?.items ?? [];
        const normalized: UnitOption[] = items.map((u: any) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ''),
          slug: String(u.slug ?? ''),
        }));
        normalized.sort((a, b) => a.name.localeCompare(b.name));
        return normalized;
      }
    },
    {
      enabled,
      topics: ['units'],
      keepPreviousData: false,
      staleTime: 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  return {
    units: data ?? [],
    loading,
    refetch,
  };
}
