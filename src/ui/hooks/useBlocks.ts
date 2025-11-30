// src/ui/hooks/useBlocks.ts
import { api } from '../../lib/api';

export type BlockPeriod = 'AFTERNOON' | 'NIGHT' | 'ALL_DAY';

export async function createBlock(params: {
  unitId: string;
  date: string;              // YYYY-MM-DD
  period: BlockPeriod;
  reason?: string;
  areaId?: string | null;    // null = todas as áreas
}) {
  const { unitId, date, period, reason, areaId = null } = params;

  return api('/v1/blocks/period', {
    method: 'POST',
    auth: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unitId,
      date,
      period,
      reason,
      areaId,
    }),
  });
}
