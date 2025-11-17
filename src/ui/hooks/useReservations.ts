// src/ui/hooks/useReservations.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type ReservationsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  unitId?: string;
  unitSlug?: string;
  areaId?: string;
  from?: string; // ISO (yyyy-mm-ddThh:mm)
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

/* ---------- utils ---------- */
const hasRestrictiveFilter = (f: ReservationsFilters) =>
  !!(f.unitId || f.unitSlug || f.areaId || (f.search && f.search.trim()) || f.from || f.to);

const BIG_PAGE = 1000; // quanto vamos puxar quando precisar filtrar no cliente

function normId(v: any) {
  const s = v == null ? '' : String(v).trim();
  return s;
}
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
    id: normId(obj.unitId ?? obj.unit_id ?? unit.id),
    slug: normId(obj.unitSlug ?? obj.unit_slug ?? unit.slug ?? unit.code),
    name: obj.unitName ?? obj.unit_name ?? unit.name ?? obj.unit ?? '',
  };
}

function buildQuery(filters: ReservationsFilters, effective: { page: number; pageSize: number }) {
  const p = new URLSearchParams();
  p.set('page', String(effective.page));
  p.set('pageSize', String(effective.pageSize));

  const q = (filters.search || '').trim();
  if (q) { p.set('q', q); p.set('search', q); }

  if (filters.unitId) { p.set('unitId', filters.unitId); p.set('unit_id', filters.unitId); }
  if (filters.unitSlug) { p.set('unitSlug', filters.unitSlug); p.set('unit_slug', filters.unitSlug); }

  if (filters.areaId) { p.set('areaId', filters.areaId); p.set('area_id', filters.areaId); }

  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);

  return p.toString();
}

function normalizePage(res: any, fallbackSize: number): ReservationsPage {
  return {
    items: res?.items ?? res?.data ?? [],
    page: Number(res?.page ?? res?.currentPage ?? 1),
    pageSize: Number(res?.pageSize ?? res?.perPage ?? fallbackSize ?? 10),
    total: Number(res?.total ?? res?.totalItems ?? res?.count ?? 0),
    totalPages: Number(res?.totalPages ?? res?.pages ?? res?.lastPage ?? 1),
  };
}

/* ---------- filtro local (failsafe + precisão) ---------- */
function clientFilter(items: any[], f: ReservationsFilters) {
  const wantId = normId(f.unitId);
  const wantSlug = normId(f.unitSlug);
  const wantArea = normId(f.areaId);
  const q = (f.search || '').trim().toLowerCase();

  const fromISO = toISO(f.from);
  const toISOVal = toISO(f.to);

  return items.filter((it) => {
    // unidade
    if (wantId || wantSlug) {
      const u = getUnitFields(it);
      if (wantId && normId(u.id) !== wantId) return false;
      if (wantSlug && normId(u.slug) !== wantSlug) return false;
    }

    // área
    if (wantArea) {
      const aId = normId(it.areaId ?? it.area_id ?? it.area?.id);
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

/* ---------- hook ---------- */
export function useReservations(filters: ReservationsFilters) {
  const key = React.useMemo(() => {
    const k = {
      p: filters.page ?? 1,
      s: filters.pageSize ?? 10,
      q: filters.search || '',
      uid: filters.unitId || '',
      us: filters.unitSlug || '',
      aid: filters.areaId || '',
      f: filters.from || '',
      t: filters.to || '',
    };
    return `reservations:${JSON.stringify(k)}`;
  }, [filters.page, filters.pageSize, filters.search, filters.unitId, filters.unitSlug, filters.areaId, filters.from, filters.to]);

  const needClientFilter = hasRestrictiveFilter(filters);
  // quando tem filtro restritivo, pedimos sempre page 1 e pageSize grande
  const effective = {
    page: needClientFilter ? 1 : (filters.page ?? 1),
    pageSize: needClientFilter ? BIG_PAGE : (filters.pageSize ?? 10),
  };

  const { data, loading, error, refetch } = useQuery<ReservationsPage>(
    key,
    async () => {
      const qs = buildQuery(filters, effective);
      const res = await api(`/v1/reservations?${qs}`, { auth: true });
      const page = normalizePage(res, effective.pageSize);

      // aplica filtro local quando necessário
      const sourceItems = needClientFilter ? page.items : page.items;
      const filtered = needClientFilter ? clientFilter(sourceItems, filters) : sourceItems;

      // paginação no cliente quando filtramos localmente
      if (needClientFilter) {
        const size = filters.pageSize ?? 10;
        const curr = filters.page ?? 1;
        const start = (curr - 1) * size;
        const end = start + size;
        return {
          items: filtered.slice(start, end),
          total: filtered.length,
          page: curr,
          pageSize: size,
          totalPages: Math.max(1, Math.ceil(filtered.length / size)),
        };
      }

      // sem filtro local, respeita paginação do servidor
      return page;
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
