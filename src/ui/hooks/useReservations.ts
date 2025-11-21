// src/ui/hooks/useReservations.ts
import * as React from 'react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';

export type ReservationsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  unitId?: string;
  unitSlug?: string; // legado (slug) — se vier sem unitId, enviamos como "unit" p/ API
  areaId?: string;
  from?: string; // ISO (yyyy-mm-ddThh:mm:ssZ) ou yyyy-mm-dd
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
const BIG_PAGE = 1000; // quando filtramos no cliente

const norm = (v: any) => {
  const s = String(v ?? '').trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
};
const normMaybe = (v: any): string | undefined => {
  const s = norm(v);
  return s ? s : undefined;
};

function toISO(x?: string | null) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeSlug(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // separadores
    .replace(/(^-|-$)/g, '');
}

function getUnitFields(item: any) {
  const unitObj = item?.unit || {};
  const id = norm(item?.unitId ?? item?.unit_id ?? unitObj?.id);
  const slug =
    norm(item?.unitSlug ?? item?.unit_slug ?? unitObj?.slug ?? unitObj?.code) ||
    normalizeSlug(item?.unitName ?? item?.unit_name ?? unitObj?.name ?? item?.unit); // deriva do nome se precisar
  const name = item?.unitName ?? item?.unit_name ?? unitObj?.name ?? item?.unit ?? '';
  return { id, slug, name };
}

const hasRestrictiveFilter = (f: ReservationsFilters) =>
  !!(norm(f.unitId) || norm(f.unitSlug) || norm(f.areaId) || norm(f.search) || norm(f.from) || norm(f.to));

function buildQuery(filters: ReservationsFilters, effective: { page: number; pageSize: number }) {
  const p = new URLSearchParams();
  p.set('page', String(effective.page));
  p.set('pageSize', String(effective.pageSize));

  const search = normMaybe(filters.search);
  const unitId = normMaybe(filters.unitId);
  const unitSlug = normMaybe(filters.unitSlug);
  const areaId = normMaybe(filters.areaId);

  if (search) p.set('search', search);
  if (unitId) {
    p.set('unitId', unitId);          // preferencial
  } else if (unitSlug) {
    p.set('unit', unitSlug);          // legado (API entende "unit" como slug/nome)
  }
  if (areaId) p.set('areaId', areaId);

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
  const wantId = norm(f.unitId);
  const wantSlug = norm(f.unitSlug);
  const wantArea = norm(f.areaId);
  const q = norm(f.search).toLowerCase();

  const fromISO = toISO(f.from);
  const toISOVal = toISO(f.to);

  return items.filter((it) => {
    // unidade
    if (wantId || wantSlug) {
      const u = getUnitFields(it);
      if (wantId && norm(u.id) !== wantId) return false;
      if (wantSlug && normalizeSlug(u.slug || u.name) !== normalizeSlug(wantSlug)) return false;
    }

    // área
    if (wantArea) {
      const aId = norm(it.areaId ?? it.area_id ?? it.area?.id);
      if (aId !== wantArea) return false;
    }

    // período
    if (fromISO || toISOVal) {
      const raw = it.reservationDate ?? it.date ?? it.when;
      const resvISO = toISO(raw);
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
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

/* ---------- hook ---------- */
export function useReservations(filters: ReservationsFilters) {
  // chave robusta: muda quando QUALQUER filtro relevante muda
  const key = React.useMemo(() => {
    return [
      'reservations',
      filters.page ?? 1,
      filters.pageSize ?? 10,
      norm(filters.search),
      norm(filters.unitId),
      norm(filters.unitSlug),
      norm(filters.areaId),
      norm(filters.from),
      norm(filters.to),
    ].join('|');
  }, [
    filters.page, filters.pageSize, filters.search,
    filters.unitId, filters.unitSlug, filters.areaId,
    filters.from, filters.to,
  ]);

  const needClientFilter = hasRestrictiveFilter(filters);
  // quando tem filtro restritivo, pedimos sempre page 1 e pageSize grande (server)
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
      const sourceItems = page.items;
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
