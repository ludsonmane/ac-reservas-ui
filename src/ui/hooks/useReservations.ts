// src/ui/hooks/useReservations.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type ReservationsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  unitId?: string;
  areaId?: string;
  from?: string; // ISO
  to?: string;   // ISO
};

export type ReservationItem = any;
export type ReservationsPage = {
  items: ReservationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function buildQuery(filters: ReservationsFilters) {
  const p = new URLSearchParams();

  // paginação
  p.set('page', String(filters.page ?? 1));
  p.set('pageSize', String(filters.pageSize ?? 10));

  // texto: manda q e search
  const q = (filters.search || '').trim();
  if (q) {
    p.set('q', q);
    p.set('search', q);
  }

  // unidade: manda todos os aliases para garantir compat no backend
  if (filters.unitId) {
    p.set('unitId', String(filters.unitId));   // camelCase
    p.set('unit_id', String(filters.unitId));  // snake_case
    p.set('unit', String(filters.unitId));     // alias legado (alguns endpoints aceitam)
  }

  // área: idem
  if (filters.areaId) {
    p.set('areaId', String(filters.areaId));
    p.set('area_id', String(filters.areaId));
  }

  // intervalo
  if (filters.from) p.set('from', String(filters.from));
  if (filters.to) p.set('to', String(filters.to));

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
  const key = React.useMemo(() => {
    const k = {
      p: filters.page ?? 1,
      s: filters.pageSize ?? 10,
      q: filters.search || '',
      u: filters.unitId || '',
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
