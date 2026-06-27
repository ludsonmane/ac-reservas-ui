// src/ui/MetasPage.tsx
//
// Tela "Dados de Metas" (somente ADMIN).
// Consome GET /v1/metas (agregação server-side) e mostra, por unidade e período:
//   Reservas x Envios WhatsApp · Gasto WhatsApp · Faturamento · Ticket médio
//   · % de cancelamento · Check-ins sem mesa.
//
// Filtros de período (de/até + dia/mês) no mesmo padrão do Dashboard.

import React from 'react';
import { api } from '../lib/api';
import { useUnits } from './hooks/useUnits';
import { toast } from './toast';

/* ---------- tipos ---------- */
type MetaUnit = {
  unitId: string;
  unitName: string;
  unitSlug: string;
  reservas: number;
  envios: number | null;
  gastoWhatsappUsd: number | null;
  gastoWhatsappCents: number | null;
  faturamentoCents: number;
  faturadas: number;
  ticketMedioCents: number;
  ticketPorPessoaCents: number;
  canceladas: number;
  cancelamentoPct: number;
  checkins: number;
  checkinsSemMesa: number;
};

type MetaResponse = {
  period: { from: string; to: string; dateField: 'reservationDate' | 'createdAt' };
  fxRate: number | null;
  fxHistorical?: boolean;
  engineError: string | null;
  unidades: MetaUnit[];
  totals: Omit<MetaUnit, 'unitId' | 'unitName' | 'unitSlug' | 'ticketPorPessoaCents'> & {
    ticketMedioCents: number;
  };
};

/* ---------- helpers ---------- */
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function toLocalInput(d: Date) {
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

function brl(cents: number | null | undefined) {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function usd(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
function num(n: number | null | undefined) {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR');
}

/* ---------- presets de período ---------- */
function presetRange(kind: 'today' | '7d' | '30d' | 'month'): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 0, 0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (kind === '7d') start.setDate(start.getDate() - 6);
  else if (kind === '30d') start.setDate(start.getDate() - 29);
  else if (kind === 'month') start.setDate(1);
  return { start, end };
}

/* ---------- card de indicador ---------- */
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default function MetasPage() {
  const { units } = useUnits(true);

  const [unitId, setUnitId] = React.useState<string>('');
  const [fromLocal, setFromLocal] = React.useState<string>('');
  const [toLocal, setToLocal] = React.useState<string>('');
  const [dateField, setDateField] = React.useState<'reservationDate' | 'createdAt'>('reservationDate');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<MetaResponse | null>(null);

  // default: últimos 7 dias
  React.useEffect(() => {
    if (fromLocal || toLocal) return;
    const { start, end } = presetRange('7d');
    setFromLocal(toLocalInput(start));
    setToLocal(toLocalInput(end));
  }, [fromLocal, toLocal]);

  function applyPreset(kind: 'today' | '7d' | '30d' | 'month') {
    const { start, end } = presetRange(kind);
    setFromLocal(toLocalInput(start));
    setToLocal(toLocalInput(end));
  }

  async function load() {
    setLoading(true);
    setError(null);
    const from = localToISOStart(fromLocal);
    const to = localToISOEnd(toLocal);
    try {
      const params: Record<string, string> = { dateField };
      if (from) params.from = from;
      if (to) params.to = to;
      if (unitId) params.unitId = unitId;
      const qs = new URLSearchParams(params).toString();
      const res = (await api(`/v1/metas?${qs}`, { auth: true })) as MetaResponse;
      setData(res);
      if (res.engineError) {
        toast.error('Envios/gasto do WhatsApp indisponíveis (engine).');
      } else {
        toast.success('Metas atualizadas.');
      }
    } catch (e: any) {
      const msg = e?.message || 'Erro ao carregar metas.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // carrega ao montar (depois que os defaults de data foram setados)
  const didLoad = React.useRef(false);
  React.useEffect(() => {
    if (didLoad.current) return;
    if (!fromLocal || !toLocal) return;
    didLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLocal, toLocal]);

  const totals = data?.totals;
  const unidades = data?.unidades ?? [];

  return (
    <div className="container mt-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dados de Metas</h1>
        <p className="text-sm text-muted">
          Reservas × envios de WhatsApp, faturamento, ticket médio, cancelamento e check-ins sem mesa por unidade.
        </p>
      </div>

      {/* filtros */}
      <div className="rounded-xl border border-border bg-card/70 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Unidade</span>
            <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Todas</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">De</span>
            <input
              className="input"
              type="datetime-local"
              value={fromLocal}
              onChange={(e) => setFromLocal(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Até</span>
            <input
              className="input"
              type="datetime-local"
              value={toLocal}
              onChange={(e) => setToLocal(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Por</span>
            <select
              className="select"
              value={dateField}
              onChange={(e) => setDateField(e.target.value as 'reservationDate' | 'createdAt')}
            >
              <option value="reservationDate">Data da reserva</option>
              <option value="createdAt">Data de criação</option>
            </select>
          </label>

          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>

        {/* presets */}
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            ['today', 'Hoje'],
            ['7d', '7 dias'],
            ['30d', '30 dias'],
            ['month', 'Este mês'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground hover:bg-panel"
              onClick={() => applyPreset(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {data?.engineError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Envios e gasto de WhatsApp indisponíveis no momento (engine): {data.engineError}
        </div>
      ) : null}

      {/* totais */}
      {totals ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Reservas" value={num(totals.reservas)} />
          <Stat label="Envios WhatsApp" value={num(totals.envios)} />
          <Stat
            label="Gasto WhatsApp"
            value={brl(totals.gastoWhatsappCents)}
            hint={totals.gastoWhatsappUsd != null ? usd(totals.gastoWhatsappUsd) : undefined}
          />
          <Stat label="Faturamento" value={brl(totals.faturamentoCents)} />
          <Stat
            label="Ticket médio"
            value={brl(totals.ticketMedioCents)}
            hint={`${num(totals.faturadas)} faturadas`}
          />
          <Stat label="Check-ins sem mesa" value={num(totals.checkinsSemMesa)} />
        </div>
      ) : null}

      {/* tabela por unidade */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card/70">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2 text-right">Reservas</th>
              <th className="px-3 py-2 text-right">Envios WA</th>
              <th className="px-3 py-2 text-right">Gasto WA</th>
              <th className="px-3 py-2 text-right">Faturamento</th>
              <th className="px-3 py-2 text-right">Ticket médio</th>
              <th className="px-3 py-2 text-right">% Cancel.</th>
              <th className="px-3 py-2 text-right">Check-ins</th>
              <th className="px-3 py-2 text-right">Sem mesa</th>
            </tr>
          </thead>
          <tbody>
            {unidades.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted" colSpan={9}>
                  {loading ? 'Carregando…' : 'Sem dados no período.'}
                </td>
              </tr>
            ) : (
              unidades.map((u) => (
                <tr key={u.unitId} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{u.unitName}</td>
                  <td className="px-3 py-2 text-right">{num(u.reservas)}</td>
                  <td className="px-3 py-2 text-right">{num(u.envios)}</td>
                  <td className="px-3 py-2 text-right">
                    {brl(u.gastoWhatsappCents)}
                    {u.gastoWhatsappUsd != null ? (
                      <span className="ml-1 text-xs text-muted">({usd(u.gastoWhatsappUsd)})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{brl(u.faturamentoCents)}</td>
                  <td className="px-3 py-2 text-right">
                    {brl(u.ticketMedioCents)}
                    <span className="ml-1 text-xs text-muted">({num(u.faturadas)})</span>
                  </td>
                  <td className="px-3 py-2 text-right">{u.cancelamentoPct.toLocaleString('pt-BR')}%</td>
                  <td className="px-3 py-2 text-right">{num(u.checkins)}</td>
                  <td className="px-3 py-2 text-right">
                    {u.checkinsSemMesa > 0 ? (
                      <span className="font-medium text-amber-600">{num(u.checkinsSemMesa)}</span>
                    ) : (
                      num(u.checkinsSemMesa)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {totals && unidades.length > 0 ? (
            <tfoot>
              <tr className="border-t border-border font-medium text-foreground">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{num(totals.reservas)}</td>
                <td className="px-3 py-2 text-right">{num(totals.envios)}</td>
                <td className="px-3 py-2 text-right">{brl(totals.gastoWhatsappCents)}</td>
                <td className="px-3 py-2 text-right">{brl(totals.faturamentoCents)}</td>
                <td className="px-3 py-2 text-right">{brl(totals.ticketMedioCents)}</td>
                <td className="px-3 py-2 text-right">
                  {totals.cancelamentoPct.toLocaleString('pt-BR')}%
                </td>
                <td className="px-3 py-2 text-right">{num(totals.checkins)}</td>
                <td className="px-3 py-2 text-right">{num(totals.checkinsSemMesa)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {totals && totals.gastoWhatsappUsd ? (
        <p className="text-xs text-muted">
          {data?.fxHistorical
            ? 'Gasto convertido pela cotação USD→BRL do dia de cada disparo'
            : 'Gasto convertido pela cotação USD→BRL atual'}
          {' '}(média efetiva US$ 1 ={' '}
          {brl(Math.round(((totals.gastoWhatsappCents || 0) / (totals.gastoWhatsappUsd || 1)) * 100))}
          {data?.fxHistorical ? '' : `, spot ${data?.fxRate ? brl(Math.round(data.fxRate * 100)) : '—'}`}).
        </p>
      ) : null}
    </div>
  );
}
