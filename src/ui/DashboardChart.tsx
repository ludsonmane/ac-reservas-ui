// src/ui/DashboardChart.tsx
import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export type DashboardChartPoint = {
  date: string;    // YYYY-MM-DD (BRT)
  label: string;   // DD/MM
  reservas: number;
  checkins: number;
  pessoas: number;
};

export function DashboardChart({
  data,
  groupedBy = 'reservationDate',
  onChangeGroupedBy,
}: {
  data: DashboardChartPoint[];
  groupedBy?: 'reservationDate' | 'createdAt';
  onChangeGroupedBy?: (v: 'reservationDate' | 'createdAt') => void;
}) {
  if (data.length < 2) return null;

  const [granularity, setGranularity] = React.useState<'day' | 'month'>('day');

  const displayData = React.useMemo<DashboardChartPoint[]>(() => {
    if (granularity === 'day') return data;
    const byMonth = new Map<string, DashboardChartPoint>();
    for (const p of data) {
      const key = p.date.slice(0, 7); // YYYY-MM
      const [yyyy, mm] = key.split('-');
      const label = `${mm}/${yyyy.slice(2)}`;
      const row =
        byMonth.get(key) ??
        { date: `${key}-01`, label, reservas: 0, checkins: 0, pessoas: 0 };
      row.reservas += p.reservas;
      row.checkins += p.checkins;
      row.pessoas += p.pessoas;
      byMonth.set(key, row);
    }
    return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, granularity]);

  const totals = React.useMemo(
    () =>
      displayData.reduce(
        (acc, p) => ({
          reservas: acc.reservas + (p.reservas || 0),
          checkins: acc.checkins + (p.checkins || 0),
          pessoas: acc.pessoas + (p.pessoas || 0),
        }),
        { reservas: 0, checkins: 0, pessoas: 0 },
      ),
    [displayData],
  );
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <div className="title text-lg">Evolução no período</div>
          <div className="text-xs text-muted mt-0.5">
            Reservas/Check-ins (eixo esquerdo) · Pessoas (eixo direito)
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <label className="shrink-0">
            <span>Granularidade</span>
            <select
              className="select"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'day' | 'month')}
            >
              <option value="day">Dia a dia</option>
              <option value="month">Mês a mês</option>
            </select>
          </label>
          {onChangeGroupedBy ? (
            <label className="shrink-0">
              <span>Filtrar por</span>
              <select
                className="select"
                value={groupedBy}
                onChange={(e) => onChangeGroupedBy(e.target.value as 'reservationDate' | 'createdAt')}
              >
                <option value="reservationDate">Data da reserva</option>
                <option value="createdAt">Data de cadastro</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className="inline-flex items-baseline gap-1 rounded-md px-2 py-1"
          style={{ background: 'rgba(16,185,129,0.10)', color: '#065f46' }}
        >
          <span className="font-semibold tabular-nums">{fmt(totals.reservas)}</span>
          <span>reservas</span>
        </span>
        <span
          className="inline-flex items-baseline gap-1 rounded-md px-2 py-1"
          style={{ background: 'rgba(59,130,246,0.10)', color: '#1e3a8a' }}
        >
          <span className="font-semibold tabular-nums">{fmt(totals.checkins)}</span>
          <span>check-ins</span>
        </span>
        <span
          className="inline-flex items-baseline gap-1 rounded-md px-2 py-1"
          style={{ background: 'rgba(245,158,11,0.10)', color: '#78350f' }}
        >
          <span className="font-semibold tabular-nums">{fmt(totals.pessoas)}</span>
          <span>pessoas</span>
        </span>
      </div>
      <div className="mt-4" style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={displayData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gReservas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCheckins" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPessoas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as DashboardChartPoint | undefined;
                if (!p?.date) return String(label);
                const [y, m, d] = p.date.split('-').map(Number);
                if (granularity === 'month') {
                  const dt = new Date(Date.UTC(y, m - 1, 1, 12));
                  const mn = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                  return mn.charAt(0).toUpperCase() + mn.slice(1);
                }
                const dt = new Date(Date.UTC(y, m - 1, d, 12));
                const wd = dt.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
                return `${label} — ${wd.charAt(0).toUpperCase()}${wd.slice(1)}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="reservas"
              name="Reservas"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gReservas)"
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="checkins"
              name="Check-ins"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#gCheckins)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="pessoas"
              name="Pessoas"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gPessoas)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
