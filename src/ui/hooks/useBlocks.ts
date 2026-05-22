// src/ui/hooks/useBlocks.ts
import { api } from '../../lib/api';

export type BlockPeriod = 'AFTERNOON' | 'NIGHT' | 'ALL_DAY';

export type BlockPayload = {
  unitId: string;
  date: string;              // YYYY-MM-DD
  period: BlockPeriod;
  reason?: string;
  areaId?: string | null;    // null = todas as áreas
};

export async function createBlock(params: BlockPayload) {
  const { unitId, date, period, reason, areaId = null } = params;

  return api('/v1/blocks/period', {
    method: 'POST',
    auth: true,
    body: {
      unitId,
      date,
      period,
      reason,
      areaId,
    },
  });
}

export async function updateBlock(id: string, params: Partial<BlockPayload>) {
  // espera um PATCH /v1/blocks/:id no backend
  return api(`/v1/blocks/${id}`, {
    method: 'PATCH',
    auth: true,
    body: params,
  });
}

export async function deleteBlock(id: string) {
  // espera um DELETE /v1/blocks/:id no backend
  return api(`/v1/blocks/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

/* ============================
 * Bloqueios RECORRENTES (DOW)
 * ============================ */

export type RecurringBlock = {
  id: string;
  unitId: string;
  unitName?: string | null;
  areaId: string | null;
  areaName?: string | null;
  dow: number;              // 0=Dom, 1=Seg, ..., 6=Sab
  fromTime: string;         // "HH:mm" inclusive
  toTime: string;           // "HH:mm" exclusive
  reason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RecurringBlockPayload = {
  unitId: string;
  dow: number;
  fromTime: string;
  toTime: string;
  areaId?: string | null;
  reason?: string | null;
};

export async function listRecurringBlocks(filters?: { unitId?: string; areaId?: string }) {
  const qs = new URLSearchParams();
  if (filters?.unitId) qs.set('unitId', filters.unitId);
  if (filters?.areaId) qs.set('areaId', filters.areaId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api(`/v1/blocks/recurring${suffix}`, { auth: true }) as Promise<RecurringBlock[]>;
}

export async function createRecurringBlock(payload: RecurringBlockPayload) {
  return api('/v1/blocks/recurring', {
    method: 'POST',
    auth: true,
    body: { ...payload, areaId: payload.areaId ?? null, reason: payload.reason ?? null },
  }) as Promise<RecurringBlock>;
}

export async function updateRecurringBlock(id: string, payload: Partial<RecurringBlockPayload>) {
  return api(`/v1/blocks/recurring/${id}`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  }) as Promise<RecurringBlock>;
}

export async function deleteRecurringBlock(id: string) {
  return api(`/v1/blocks/recurring/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
