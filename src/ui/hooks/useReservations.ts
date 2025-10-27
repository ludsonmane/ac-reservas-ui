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
  from?: string; // ISO (datetime-local)
  to?: string;   // ISO (datetime-local)
};

export type ReservationItem = any; // use seu tipo se já existir
export type ReservationsPage = {
  items: ReservationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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
  }, [filters.page, filters.pageSize, filters.search, filters.unitId, filters.areaId, filters.from, filters.to]);

  const { data, loading, error, refetch } = useQuery<ReservationsPage>(
    key,
    async () => {
      const params = new URLSearchParams();
      params.set('page', String(filters.page ?? 1));
      params.set('pageSize', String(filters.pageSize ?? 10));
      if (filters.search) params.set('search', String(filters.search));
      if (filters.unitId) params.set('unitId', String(filters.unitId));
      if (filters.areaId) params.set('areaId', String(filters.areaId));
      if (filters.from) params.set('from', String(filters.from));
      if (filters.to) params.set('to', String(filters.to));

      // 🔐 IMPORTANTE: auth: true para enviar o Bearer token
      const res = await api(`/v1/reservations?${params.toString()}`, { auth: true });

      // Normalização leve
      return {
        items: res?.items ?? [],
        total: Number(res?.total ?? 0),
        page: Number(res?.page ?? 1),
        pageSize: Number(res?.pageSize ?? 10),
        totalPages: Number(res?.totalPages ?? 1),
      } as ReservationsPage;
    },
    { enabled: true, topics: ['reservations'] }
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
