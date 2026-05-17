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
}: {
  data: DashboardChartPoint[];
  groupedBy?: 'reservationDate' | 'createdAt';
}) {
  if (data.length < 2) return null;

  const subtitle = groupedBy === 'createdAt'
    ? 'Agrupado por data de cadastro · Reservas/Check-ins (esq) · Pessoas (dir)'
    : 'Agrupado por data da reserva · Reservas/Check-ins (esq) · Pessoas (dir)';

  return (
    <div className="card">
      <div className="title text-lg">Evolução no período</div>
      <div className="text-xs text-muted mt-0.5">{subtitle}</div>
      <div className="mt-4" style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
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
