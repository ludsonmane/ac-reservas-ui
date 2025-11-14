// src/ui/hooks/useReservations.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type ReservationsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  unitId?: string;
  unitSlug?: string;   // pode vir do select
  areaId?: string;
  from?: string;       // ISO
  to?: string;         // ISO
};

export type ReservationItem = any;
export type ReservationsPage = {
  items: ReservationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function buildQuery(filters: ReservationsFilters & { unit?: string }) {
  const p = new URLSearchParams();
  p.set('page', String(filters.page ?? 1));
  p.set('pageSize', String(filters.pageSize ?? 10));

  const q = (filters.search || '').trim();
  if (q) { p.set('q', q); p.set('search', q); }

  if (filters.unitId) { p.set('unitId', String(filters.unitId)); p.set('unit_id', String(filters.unitId)); }
  if (filters.unitSlug) { p.set('unitSlug', String(filters.unitSlug)); p.set('unit_slug', String(filters.unitSlug)); }

  if (filters.areaId) { p.set('areaId', String(filters.areaId)); p.set('area_id', String(filters.areaId)); }
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

/* ----------------- FILTRO LOCAL (failsafe) ----------------- */
function toISO(x?: string | null) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function str(v: any) { return (v ?? '').toString().toLowerCase(); }

function getUnitFields(item: any) {
  const obj = item || {};
  const unit = obj.unit || {};
  return {
    id: obj.unitId ?? obj.unit_id ?? unit.id ?? null,
    slug: obj.unitSlug ?? obj.unit_slug ?? unit.slug ?? unit.code ?? null,
    name: obj.unitName ?? obj.unit_name ?? unit.name ?? obj.unit ?? null,
  };
}

function clientFilter(items: any[], f: ReservationsFilters) {
  const q = (f.search || '').trim().toLowerCase();
  const wantId = (f.unitId || '').toLowerCase();
  const wantSlug = (f.unitSlug || '').toLowerCase();
  const wantArea = (f.areaId || '').toLowerCase();

  const fromISO = toISO(f.from);
  const toISOVal = toISO(f.to);

  return items.filter((it) => {
    // unidade
    if (wantId || wantSlug) {
      const u = getUnitFields(it);
      const idOk = wantId ? String(u.id ?? '').toLowerCase() === wantId : true;
      const slugOk = wantSlug ? String(u.slug ?? '').toLowerCase() === wantSlug : true;
      if (!(idOk && slugOk)) return false;
    }

    // área
    if (wantArea) {
      const aId = (it.areaId ?? it.area_id ?? it.area?.id ?? '').toString().toLowerCase();
      if (aId !== wantArea) return false;
    }

    // período
    if (fromISO || toISOVal) {
      const resvISO = toISO(it.reservationDate ?? it.date ?? it.when);
      if (!resvISO) return false;
      if (fromISO && resvISO < fromISO) return false;
      if (toISOVal && resvISO > toISOVal) return false;
    }

    // busca livre
    if (q) {
      const hay = [
        it.fullName, it.name,
        it.email, it.phone,
        it.reservationCode, it.code,
        getUnitFields(it).name,
        it.areaName ?? it.area?.name,
      ].map(str).join(' ');
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
/* ----------------------------------------------------------- */

export function useReservations(filters: ReservationsFilters) {
  const key = React.useMemo(() => {
    const k = {
      p: filters.page ?? 1,
      s: filters.pageSize ?? 10,
      q: filters.search || '',
      u: filters.unitId || '',
      us: filters.unitSlug || '',
      a: filters.areaId || '',
      f: filters.from || '',
      t: filters.to || '',
    };
    return `reservations:${JSON.stringify(k)}`;
  }, [
    filters.page, filters.pageSize, filters.search,
    filters.unitId, filters.unitSlug,
    filters.areaId, filters.from, filters.to,
  ]);

  const { data, loading, error, refetch } = useQuery<ReservationsPage>(
    key,
    async () => {
      // busca tudo conforme a API permite…
      const qs = buildQuery(filters);
      const res = await api(`/v1/reservations?${qs}`, { auth: true });
      const page = normalizePage(res, filters.pageSize ?? 10);

      // …e garante o filtro no cliente (preciso)
      const filtered = clientFilter(page.items, filters);

      // paginação simples no cliente (mantém UX correta)
      const size = page.pageSize;
      const start = ((filters.page ?? 1) - 1) * size;
      const end = start + size;

      return {
        items: filtered.slice(start, end),
        total: filtered.length,
        page: filters.page ?? 1,
        pageSize: size,
        totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      };
    },
    { enabled: true, topics: ['reservations'] }
  );

  return {
    data:
      data ?? { items: [], total: 0, page: 1, pageSize: filters.pageSize ?? 10, totalPages: 1 },
    loading,
    error,
    refetch,
  };
}
