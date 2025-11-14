// src/ui/hooks/useReservations.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type ReservationsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  unitId?: string;
  unitSlug?: string;   // slug da unidade (ex.: 'aguas-claras', 'brasilia')
  areaId?: string;
  from?: string;       // ISO (datetime-local)
  to?: string;         // ISO (datetime-local)
};

export type ReservationItem = any;
export type ReservationsPage = {
  items: ReservationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Monta a query aceitando as variações que o backend entende. */
function buildQuery(filters: ReservationsFilters & { unit?: string }) {
  const p = new URLSearchParams();

  p.set('page', String(filters.page ?? 1));
  p.set('pageSize', String(filters.pageSize ?? 10));

  const q = (filters.search || '').trim();
  if (q) {
    p.set('q', q);          // alias comum
    p.set('search', q);     // compat
  }

  // ✅ Filtra por unidade (ID)
  if (filters.unitId) {
    p.set('unitId', String(filters.unitId));
    p.set('unit_id', String(filters.unitId)); // compat
  }

  // ✅ Filtra por unidade (slug)
  if (filters.unitSlug) {
    p.set('unitSlug', String(filters.unitSlug));
    p.set('unit_slug', String(filters.unitSlug)); // compat
  }

  // (opcional) se alguém ainda mandar 'unit' (nome), passamos também
  if ((filters as any).unit) {
    p.set('unit', String((filters as any).unit));
  }

  // ✅ Área
  if (filters.areaId) {
    p.set('areaId', String(filters.areaId));
    p.set('area_id', String(filters.areaId)); // compat
  }

  // ✅ Intervalo de datas
  if (filters.from) p.set('from', String(filters.from));
  if (filters.to)   p.set('to',   String(filters.to));

  return p.toString();
}

function normalizePage(res: any, pageSizeFallback: number): ReservationsPage {
  return {
    items: res?.items ?? res?.data ?? [],
    page: Number(res?.page ?? res?.currentPage ?? 1),
    pageSize: Number(res?.pageSize ?? res?.perPage ?? pageSizeFallback ?? 10),
    total: Number(res?.total ?? res?.totalItems ?? res?.count ?? 0),
    totalPages: Number(res?.totalPages ?? res?.pages ?? res?.lastPage ?? 1),
  };
}

export function useReservations(filters: ReservationsFilters) {
  // 🔑 inclui unitSlug no cache key para não "reaproveitar" página errada
  const key = React.useMemo(() => {
    const k = {
      p: filters.page ?? 1,
      s: filters.pageSize ?? 10,
      q: filters.search || '',
      uid: filters.unitId || '',
      us: filters.unitSlug || '',
      a: filters.areaId || '',
      f: filters.from || '',
      t: filters.to || '',
    };
    return `reservations:${JSON.stringify(k)}`;
  }, [
    filters.page,
    filters.pageSize,
    filters.search,
    filters.unitId,
    filters.unitSlug,
    filters.areaId,
    filters.from,
    filters.to,
  ]);

  const { data, loading, error, refetch } = useQuery<ReservationsPage>(
    key,
    async () => {
      const qs = buildQuery(filters);
      const res = await api(`/v1/reservations?${qs}`, { auth: true });
      return normalizePage(res, filters.pageSize ?? 10);
    },
    { enabled: true, topics: ['reservations'] }
  );

  return {
    data:
      data ??
      normalizePage(
        { items: [], page: 1, pageSize: filters.pageSize ?? 10, total: 0, totalPages: 1 },
        filters.pageSize ?? 10
      ),
    loading,
    error,
    refetch,
  };
}
