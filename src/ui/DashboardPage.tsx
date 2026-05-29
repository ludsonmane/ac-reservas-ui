// src/ui/DashboardPage.tsx
import React from 'react';
import { api } from '../lib/api';
import type { Reservation } from '../types';
import { useUnits } from './hooks/useUnits';
import { useAreasByUnit } from './hooks/useAreasByUnit';
import { toast } from './toast';
import { DashboardChart, type DashboardChartPoint } from './DashboardChart';

type GroupRow = {
  key: string;
  label: string;
  reservas: number;
  checkins: number;
  awaiting: number;
  people: number;
  kids: number;
};

// Reservas com check-in feito mas sem faturamento ZIG registrado
type SemFaturamentoRow = {
  id:              string;
  reservationCode: string;
  fullName:        string;
  tables:          string | null;
  reservationDate: string;
  areaName?:       string | null;
  unitName?:       string | null;
};

type DashboardData = {
  items: Reservation[];
  fetchedAt: string;
};

/* ---------- helpers ---------- */
function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInput(d: Date) {
  // yyyy-mm-ddThh:mm
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localToISOStart(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setSeconds(0, 0);
  return d.toISOString();
}

function localToISOEnd(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setSeconds(59, 999);
  return d.toISOString();
}

function safeStr(v: any) {
  const s = String(v ?? '').trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

function normalizeOriginForDashboard(r: Reservation) {
  return safeStr(r.utm_source) || '(sem origem)';
}

function mergeBotmakerDisparoOnly(origin: string) {
  const v = safeStr(origin).toLowerCase();
  if (!v || v === '(sem origem)') return 'SEM_ORIGEM';
  if (v.includes('botmaker') || v.includes('disparo')) return 'BOTMAKER_DISPARO';
  return origin;
}


function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10; // 1 decimal
}

function normalizePage(res: any, fallbackSize: number) {
  return {
    items: (res?.items ?? res?.data ?? []) as Reservation[],
    page: Number(res?.page ?? res?.currentPage ?? 1),
    pageSize: Number(res?.pageSize ?? res?.perPage ?? fallbackSize ?? 10),
    total: Number(res?.total ?? res?.totalItems ?? res?.count ?? 0),
    totalPages: Number(res?.totalPages ?? res?.pages ?? res?.lastPage ?? 1),
  };
}

function groupBy(items: Reservation[], getKey: (r: Reservation) => string, labelOf?: (key: string) => string) {
  const map = new Map<string, GroupRow>();
  for (const r of items) {
    const k = safeStr(getKey(r)) || '(vazio)';
    const row = map.get(k) ?? {
      key: k,
      label: labelOf ? labelOf(k) : k,
      reservas: 0,
      checkins: 0,
      awaiting: 0,
      people: 0,
      kids: 0,
    };
    row.reservas += 1;
    const isCheckin = r.status === 'CHECKED_IN' || !!r.checkedInAt;
    if (isCheckin) row.checkins += 1;
    if (r.status === 'AWAITING_CHECKIN') row.awaiting += 1;
    row.people += Number(r.people ?? 0);
    row.kids += Number(r.kids ?? 0);
    map.set(k, row);
  }

  const out = Array.from(map.values());
  out.sort((a, b) => b.reservas - a.reservas);
  return out;
}

function topN<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, n));
}

function StatCard({ title, value, hint, tooltip }: { title: string; value: React.ReactNode; hint?: React.ReactNode; tooltip?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted flex items-center gap-1">
        <span>{title}</span>
        {tooltip ? (
          <span
            title={tooltip}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[10px] leading-none cursor-help opacity-60 hover:opacity-100"
            aria-label="Info"
          >
            ?
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function BarList({ title, rows, help, limit = 10 }: { title: string; rows: GroupRow[]; help?: string; limit?: number }) {
  const [showAll, setShowAll] = React.useState(false);
  const total = rows.reduce((s, r) => s + r.reservas, 0);
  const view = showAll ? rows : topN(rows, limit);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="title text-lg">{title}</div>
          {help ? <div className="text-xs text-muted mt-0.5">{help}</div> : null}
        </div>
        {rows.length > limit ? (
          <button className="btn btn-sm" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Mostrar menos' : 'Ver tudo'}
          </button>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto scroll-area">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th>Valor</th>
              <th className="w-[160px]">Participação</th>
              <th>Reservas</th>
              <th>Check-ins</th>
              <th>Share</th>
              <th>Pessoas</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const share = pct(r.reservas, total);
              return (
                <tr key={r.key}>
                  <td className="font-medium">{r.label}</td>
                  <td>
                    <div className="progress" title={`${share}%`}>
                      <span style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                  </td>
                  <td>{r.reservas}</td>
                  <td>{r.checkins}</td>
                  <td>{share}%</td>
                  <td>{r.people + r.kids}</td>
                </tr>
              );
            })}
            {!view.length ? (
              <tr>
                <td colSpan={6} className="text-muted">Sem dados no período.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { units } = useUnits(true);

  const [unitId, setUnitId] = React.useState<string>('');
  const { data: areasData } = useAreasByUnit(unitId || undefined, true);
  const areas = areasData ?? [];
  const [areaId, setAreaId] = React.useState<string>('');

  const [fromLocal, setFromLocal] = React.useState<string>('');
  const [toLocal, setToLocal] = React.useState<string>('');
  const [dateField, setDateField] = React.useState<'reservationDate' | 'createdAt'>('reservationDate');

  const [billingFilter, setBillingFilter] = React.useState<'all' | 'sem_faturamento'>('all');
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ fetched: number; total?: number }>({ fetched: 0, total: undefined });
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DashboardData | null>(null);

  // defaults: últimos 7 dias (00:00 -> 23:59)
  React.useEffect(() => {
    if (fromLocal || toLocal) return;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    setFromLocal(toLocalInput(start));
    setToLocal(toLocalInput(end));
  }, [fromLocal, toLocal]);

  // se trocar unit, limpa area selecionada se não existir
  React.useEffect(() => {
    if (!areaId) return;
    if (!areas.find(a => String(a.id) === String(areaId))) setAreaId('');
  }, [unitId, areas, areaId]);

  // ao trocar o dateField, re-busca do backend (senao a agregacao local
  // usaria items filtrados pelo campo anterior e os totais ficariam errados)
  const didFirstLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (!didFirstLoadRef.current) {
      if (data) didFirstLoadRef.current = true;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateField]);

  async function load() {
    setLoading(true);
    setError(null);
    setProgress({ fetched: 0, total: undefined });

    const from = localToISOStart(fromLocal);
    const to = localToISOEnd(toLocal);

    try {
      const pageSize = 500;
      let page = 1;
      let totalPages = 1;
      let total = 0;
      const all: Reservation[] = [];

      // loop paginado (client-side aggregation)
      while (page <= totalPages) {
        const params: Record<string, any> = { page, pageSize };
        if (unitId) params.unitId = unitId;
        if (areaId) params.areaId = areaId;
        if (from) params.from = from;
        if (to) params.to = to;
        params.dateField = dateField;

        const qs = new URLSearchParams(params as any).toString();
        const res = await api(`/v1/reservations?${qs}`, { auth: true });
        const normalized = normalizePage(res, pageSize);
        totalPages = normalized.totalPages || 1;
        total = normalized.total || total;
        all.push(...(normalized.items || []));
        setProgress({ fetched: all.length, total });

        if (!normalized.items?.length) break;
        if (page >= totalPages) break;
        page += 1;
      }

      setData({ items: all, fetchedAt: new Date().toISOString() });
      toast.success('Dashboard atualizado.');
    } catch (e: any) {
      const msg = e?.message || 'Erro ao carregar dashboard.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const items = data?.items ?? [];
  const totalRes = items.length;

  // Pessoas, mesas e faturamento só fazem sentido pra quem efetivamente apareceu.
  // Reservas marcadas mas sem check-in não consumiram nada — não entram nas médias.
  const checkedInItems = items.filter(r => r.status === 'CHECKED_IN' || !!r.checkedInAt);
  const checkins = checkedInItems.length;
  const totalPeople = checkedInItems.reduce((s, r) => s + Number(r.people ?? 0), 0);
  const totalKids   = checkedInItems.reduce((s, r) => s + Number(r.kids ?? 0), 0);
  const totalPax    = totalPeople + totalKids;
  const awaiting    = items.filter(r => r.status === 'AWAITING_CHECKIN').length;
  const avgAdults   = checkins ? Math.round((totalPeople / checkins) * 10) / 10 : 0;
  const avgPax      = checkins ? Math.round((totalPax / checkins) * 10) / 10 : 0;
  const checkinRate = pct(checkins, totalRes);

  // Checkins sem faturamento ZIG: status CHECKED_IN + tem mesas + sem zigBillingCents
  const checkinsSemFaturamento: SemFaturamentoRow[] = React.useMemo(
    () => items.filter(r =>
      (r.status === 'CHECKED_IN' || !!r.checkedInAt) &&
      r.tables?.trim() &&
      (r as any).zigBillingCents == null
    ).map(r => ({
      id:              r.id,
      reservationCode: r.reservationCode || '',
      fullName:        r.fullName,
      tables:          r.tables ?? null,
      reservationDate: r.reservationDate,
      areaName:        r.areaName ?? r.area ?? null,
      unitName:        (r as any).unitName ?? null,
    })),
    [items]
  );

  // Faturamento total ZIG já registrado no período
  const zigTotalCents = React.useMemo(
    () => items
      .filter(r => r.status === 'CHECKED_IN')
      .reduce((s, r) => s + ((r as any).zigBillingCents ?? 0), 0),
    [items]
  );
  const zigTotalBRL = (zigTotalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Ticket médio por reserva: zigTotalCents / nº de reservas faturadas
  // "Faturada" = CHECKED_IN com billing > 0 (literal). R$ 0,00 não conta.
  const zigReservasFaturadas = React.useMemo(() => items.filter(r =>
    r.status === 'CHECKED_IN' &&
    (r as any).zigBillingCents != null &&
    (r as any).zigBillingCents > 0
  ).length, [items]);

  const zigTicketMedioReservaCents = zigReservasFaturadas > 0
    ? Math.round(zigTotalCents / zigReservasFaturadas)
    : 0;

  const zigTicketMedioReservaBRL = zigTicketMedioReservaCents > 0
    ? (zigTicketMedioReservaCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

  // Aplica filtro de billing
  const filteredItems = React.useMemo(() => {
    if (billingFilter === 'sem_faturamento') {
      return items.filter(r =>
        (r.status === 'CHECKED_IN' || !!r.checkedInAt) &&
        r.tables?.trim() &&
        (r as any).zigBillingCents == null
      );
    }
    return items;
  }, [items, billingFilter]);

  const byOrigin = React.useMemo(
    () => groupBy(filteredItems, r => mergeBotmakerDisparoOnly(normalizeOriginForDashboard(r))),
    [items]
  );
  const byCampaign = React.useMemo(() => groupBy(filteredItems, r => r.utm_campaign || ''), [items]);
  const byMedium = React.useMemo(() => groupBy(filteredItems, r => r.utm_medium || ''), [items]);
  const byArea = React.useMemo(
    () => groupBy(filteredItems, r => (r.areaName || r.area || '').trim() || '(sem área)'),
    [items]
  );
  const byType = React.useMemo(() => groupBy(filteredItems, r => r.reservationType || ''), [items]);

  const botmakerDisparoRow = byOrigin.find(r => r.key === 'BOTMAKER_DISPARO');
  const semOrigemRow = byOrigin.find(r => r.key === 'SEM_ORIGEM');

  // distribuição de people (adultos) por reserva
  const peopleDist = React.useMemo(() => {
    const m = new Map<string, GroupRow>();
    for (const r of items) {
      const k = String(Math.max(0, Number(r.people ?? 0)));
      const row = m.get(k) ?? { key: k, label: `${k} pessoa(s)`, reservas: 0, checkins: 0, awaiting: 0, people: 0, kids: 0 };
      row.reservas += 1;
      if (r.status === 'CHECKED_IN' || !!r.checkedInAt) row.checkins += 1;
      if (r.status === 'AWAITING_CHECKIN') row.awaiting += 1;
      row.people += Number(r.people ?? 0);
      row.kids += Number(r.kids ?? 0);
      m.set(k, row);
    }
    const out = Array.from(m.values());
    out.sort((a, b) => Number(a.key) - Number(b.key));
    return out;
  }, [items]);

  const lastUpdated = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString('pt-BR') : '—';

  // Série temporal por dia (BRT) — reservas, check-ins e pessoas
  // Eixo X usa o mesmo campo do filtro (data da reserva OU data de cadastro)
  const chartData: DashboardChartPoint[] = React.useMemo(() => {
    if (!items.length) return [];
    const byDay = new Map<string, DashboardChartPoint>();
    for (const r of items) {
      const raw = dateField === 'createdAt' ? r.createdAt : r.reservationDate;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      // converte UTC -> BRT (UTC-3) e pega YYYY-MM-DD
      const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      const y = brt.getUTCFullYear();
      const m = pad2(brt.getUTCMonth() + 1);
      const dd = pad2(brt.getUTCDate());
      const key = `${y}-${m}-${dd}`;
      const row = byDay.get(key) ?? { date: key, label: `${dd}/${m}`, reservas: 0, checkins: 0, pessoas: 0 };
      row.reservas += 1;
      if (r.status === 'CHECKED_IN' || !!r.checkedInAt) row.checkins += 1;
      row.pessoas += Number(r.people ?? 0) + Number(r.kids ?? 0);
      byDay.set(key, row);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [items, dateField]);

  return (
    <div className="container mt-4 space-y-4">
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="title text-2xl">Dashboard</div>
            <div className="text-sm text-muted">Visão estratégica de Reservas, Check-in e Origem (UTM_SOURCE). Atualizado: {lastUpdated}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <label>
            <span>Unidade</span>
            <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Todas</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Área</span>
            <select className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!unitId}>
              <option value="">Todas</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!unitId ? <div className="mt-1 text-[11px] text-muted">Selecione uma unidade para filtrar áreas.</div> : null}
          </label>

          <label>
            <span>De</span>
            <input className="input" type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
          </label>

          <label>
            <span>Até</span>
            <input className="input" type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
          </label>

          <label>
            <span>Faturamento ZIG</span>
            <select className="select" value={billingFilter} onChange={(e) => setBillingFilter(e.target.value as any)}>
              <option value="all">Todas</option>
              <option value="sem_faturamento">Checkins sem faturamento</option>
            </select>
          </label>

          <div className="flex items-end">
            <div className="w-full rounded-xl border border-border bg-panel/60 px-3 py-2.5">
              <div className="text-xs text-muted">Coleta</div>
              <div className="text-sm font-medium">{progress.fetched}{typeof progress.total === 'number' ? ` / ${progress.total}` : ''}</div>
              <div className="text-[11px] text-muted">Reservas carregadas</div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard title="Reservas" value={totalRes} hint={<span>Período selecionado</span>} />
        <StatCard title="Check-ins" value={checkins} hint={<span>Taxa: {checkinRate}%</span>} />
        <StatCard title="Pessoas (check-in)" value={totalPax} hint={<span>Adultos {totalPeople} • Kids {totalKids}</span>} />
        <StatCard title="Média por check-in" value={`${avgPax}`} hint={<span>Adultos: {avgAdults}</span>} />
        <StatCard
          title="Botmaker + Disparo"
          value={botmakerDisparoRow?.reservas ?? 0}
          hint={<span>{pct(botmakerDisparoRow?.reservas ?? 0, totalRes)}% das reservas</span>}
        />
        <StatCard
          title="Sem origem"
          value={semOrigemRow?.reservas ?? 0}
          hint={<span>{pct(semOrigemRow?.reservas ?? 0, totalRes)}% (tracking)</span>}
        />
        <StatCard title="Aguardando" value={awaiting} hint={<span>Fila de execução</span>} />
        <StatCard title="Saúde do funil" value={checkinRate >= 70 ? '🟢' : checkinRate >= 45 ? '🟡' : '🔴'} hint={<span>Baseado na taxa de check-in</span>} />
        <StatCard
          title="Faturamento ZIG"
          value={zigTotalCents > 0 ? zigTotalBRL : '—'}
          hint={<span>Total registrado no período</span>}
          tooltip={
            'Soma do consumo das mesas das reservas com check-in confirmado.\n\n' +
            'Fonte: API Manezin (canônica, sem intermediários — substitui o MySQL ZIG Full que tinha sync quebrado).\n\n' +
            'Regra de match por reserva:\n' +
            '• Pivot = 1ª venda na mesa após o horário da reserva (até 8h de atraso).\n' +
            '• Janela 4h a partir do pivot.\n' +
            '• Estende além das 4h enquanto o mesmo cliente (chip NFC) continua consumindo sem silêncio.\n' +
            '• Encerra quando aparece um chip novo após silêncio > 60min (= próxima reserva sentou).\n' +
            '• Exclui transações estornadas (refund).\n\n' +
            'É o cálculo mais preciso que temos hoje porque usa a identidade do cliente (chip NFC), não chuta só por tempo.'
          }
        />
        <StatCard
          title="Ticket médio por reserva"
          value={zigTicketMedioReservaBRL}
          hint={<span>{zigReservasFaturadas} {zigReservasFaturadas === 1 ? 'reserva faturada' : 'reservas faturadas'}</span>}
          tooltip={
            'Faturamento ZIG total ÷ número de reservas com consumo confirmado (> R$ 0).\n\n' +
            'Reservas com R$ 0,00 (cliente foi mas não consumiu, ou mesa cadastrada errada) não entram na média.\n\n' +
            'Usa a mesma metodologia do Faturamento ZIG: fonte Manezin canônica, match por pivot + chip NFC, refunds excluídos. Veja o tooltip de Faturamento ZIG pra detalhes.'
          }
        />
        <StatCard
          title="Checkins sem faturamento"
          value={checkinsSemFaturamento.length}
          hint={<span className={checkinsSemFaturamento.length > 0 ? 'text-amber-500 font-semibold' : ''}>{checkinsSemFaturamento.length > 0 ? '⚠️ Consultar ZIG' : '✅ Todos faturados'}</span>}
        />
      </div>

      <details className="card">
        <summary className="cursor-pointer select-none font-semibold text-base flex items-center gap-2">
          <span>📊 Como calculamos o faturamento por reserva</span>
          <span className="text-xs text-muted font-normal">(clique pra expandir)</span>
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm leading-relaxed">
          <div>
            <div className="font-medium mb-1.5">🎯 Fonte: API Manezin (canônica)</div>
            <p className="text-muted">
              Lemos direto da API Manezin (Rocha Solution), que é a fonte original do ZIG.
              Antes usávamos um MySQL espelho com cron de sincronização quebrado — perdia ~75%
              dos jantares (zerados no dashboard). Trocamos pela fonte direta em 2026-05.
            </p>
          </div>

          <div>
            <div className="font-medium mb-1.5">⏱️ Como casamos vendas com a reserva</div>
            <ul className="text-muted space-y-1 list-disc pl-5">
              <li><b>Pivot</b> = 1ª venda na mesa depois do horário da reserva (aceita até 8h de atraso).</li>
              <li><b>Janela base</b> = 4h a partir do pivot.</li>
              <li><b>Estende</b> além das 4h enquanto o mesmo cliente (chip NFC) continua consumindo sem silêncio.</li>
              <li><b>Encerra</b> quando aparece um chip <i>novo</i> após silêncio &gt; 60min — sinal de que a próxima reserva sentou.</li>
              <li><b>Exclui</b> transações estornadas (<code>isRefunded</code>).</li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="font-medium mb-1.5">✅ Por que é o mais preciso que temos hoje</div>
            <p className="text-muted">
              Usamos a <b>identidade do cliente</b> (chip NFC da pulseirinha) — não chutamos só por janela cega de tempo.
              Isso evita os dois erros mais comuns: <b>(1)</b> cortar cedo demais uma cauda legítima do mesmo cliente que
              continuou bebendo depois das 4h; e <b>(2)</b> contar demais incluindo walk-ins ou a próxima reserva que
              sentou na mesma mesa. <b>Ticket médio por reserva</b> = Faturamento ZIG ÷ reservas com consumo confirmado
              (R$ 0,00 não conta — pode ser mesa cadastrada errada ou reserva onde o cliente não consumiu).
            </p>
          </div>
        </div>
      </details>

      {chartData.length >= 2 && (
        <DashboardChart
          data={chartData}
          groupedBy={dateField}
          onChangeGroupedBy={setDateField}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BarList title="Origem (UTM Source)" rows={byOrigin} help="Usa UTM_SOURCE. Soma apenas botmaker + disparo em um único canal." />
        <BarList title="Tipo de reserva" rows={byType} help="Mix: Particular / Empresa / Aniversário / Confraternização." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BarList title="UTM Campaign" rows={byCampaign} help="Campanhas que estão trazendo reservas (share = participação no total)." />
        <BarList title="UTM Medium" rows={byMedium} help="Mídias: cpc, social, influencer, etc." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card">
          <div className="title text-lg">Leitura executiva de origem</div>
          <div className="text-xs text-muted mt-0.5">Todas as origens do período. Só botmaker + disparo são consolidados.</div>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {byOrigin.map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-lg border border-border bg-panel/40 px-3 py-2">
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-medium">{r.label}</div>
                  <div className="text-[11px] text-muted">{pct(r.reservas, totalRes)}% do total</div>
                </div>
                <div className="text-sm font-semibold">{r.reservas}</div>
              </div>
            ))}
            {!byOrigin.length ? <div className="text-sm text-muted">Sem dados no período.</div> : null}
          </div>
        </div>
        <BarList title="Áreas" rows={byArea} help="Distribuição das reservas por área (ajuda a olhar capacidade e operação)." />
      </div>

      <div className="card">
        <div className="title text-lg">Pessoas por reserva (adultos)</div>
        <div className="text-xs text-muted mt-0.5">Distribuição do tamanho dos grupos. Útil pra prever ocupação e ritmo de atendimento.</div>

        <div className="mt-4 overflow-x-auto scroll-area">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="w-[180px]">Participação</th>
                <th>Reservas</th>
                <th>Check-ins</th>
                <th>Taxa</th>
                <th>PAX (inclui kids)</th>
              </tr>
            </thead>
            <tbody>
              {peopleDist.map((r) => {
                const share = pct(r.reservas, totalRes);
                const rate = pct(r.checkins, r.reservas);
                return (
                  <tr key={r.key}>
                    <td className="font-medium">{r.label}</td>
                    <td>
                      <div className="progress" title={`${share}%`}>
                        <span style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                    </td>
                    <td>{r.reservas}</td>
                    <td>{r.checkins}</td>
                    <td>{rate}%</td>
                    <td>{r.people + r.kids}</td>
                  </tr>
                );
              })}
              {!peopleDist.length ? (
                <tr>
                  <td colSpan={6} className="text-muted">Sem dados no período.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {checkinsSemFaturamento.length > 0 && (
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="title text-lg flex items-center gap-2">
                <span>⚠️ Checkins sem faturamento ZIG</span>
                <span className="text-sm font-normal text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                  {checkinsSemFaturamento.length}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                Reservas com check-in feito, mesas vinculadas, mas sem faturamento ZIG registrado. Abra cada uma e clique em ↺ para buscar.
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto scroll-area">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Mesas</th>
                  <th>Data</th>
                  <th>Área</th>
                </tr>
              </thead>
              <tbody>
                {checkinsSemFaturamento.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.reservationCode || '—'}</td>
                    <td className="font-medium">{r.fullName}</td>
                    <td>{r.tables || '—'}</td>
                    <td>{new Date(r.reservationDate).toLocaleDateString('pt-BR')}</td>
                    <td>{r.areaName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="title text-lg">Insights rápidos</div>
            <div className="text-xs text-muted mt-0.5">Pra você bater o olho e decidir o próximo disparo / ajuste de campanha.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-panel/50 p-4">
            <div className="text-sm font-semibold">Top campanhas (volume)</div>
            <ol className="mt-2 space-y-1 text-sm">
              {topN(byCampaign, 5).map(r => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="text-muted">{r.reservas}</span>
                </li>
              ))}
              {!byCampaign.length ? <li className="text-muted">—</li> : null}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-panel/50 p-4">
            <div className="text-sm font-semibold">Top campanhas (taxa check-in)</div>
            <div className="text-[11px] text-muted">(mín. 5 reservas)</div>
            <ol className="mt-2 space-y-1 text-sm">
              {topN(
                byCampaign
                  .filter(r => r.reservas >= 5)
                  .slice()
                  .sort((a, b) => (b.checkins / b.reservas) - (a.checkins / a.reservas)),
                5
              ).map(r => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="text-muted">{pct(r.checkins, r.reservas)}%</span>
                </li>
              ))}
              {!byCampaign.filter(r => r.reservas >= 5).length ? <li className="text-muted">—</li> : null}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-panel/50 p-4">
            <div className="text-sm font-semibold">Oportunidades</div>
            <div className="text-[11px] text-muted">Campanhas com volume, mas baixa execução (taxa &lt; 40%).</div>
            <ol className="mt-2 space-y-1 text-sm">
              {topN(
                byCampaign
                  .filter(r => r.reservas >= 8 && pct(r.checkins, r.reservas) < 40)
                  .slice()
                  .sort((a, b) => b.reservas - a.reservas),
                5
              ).map(r => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="text-muted">{pct(r.checkins, r.reservas)}%</span>
                </li>
              ))}
              {!byCampaign.filter(r => r.reservas >= 8 && pct(r.checkins, r.reservas) < 40).length ? <li className="text-muted">—</li> : null}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
