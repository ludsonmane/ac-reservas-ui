// src/ui/AreasPublicPage.tsx
import * as React from 'react';
import { useUnits } from './hooks/useUnits';
import { useAreasByUnit } from './hooks/useAreasByUnit';
import Skeleton from './Skeleton';

export default function AreasPublicPage() {
  const [unitId, setUnitId] = React.useState<string | ''>('');
  const { units, loading: loadingUnits } = useUnits(true);
  const { data: areas, loading: loadingAreas } = useAreasByUnit(unitId || undefined, !!unitId);

  React.useEffect(() => {
    if (!unitId && units.length === 1) {
      setUnitId(units[0].id);
    }
  }, [units, unitId]);

  return (
    <section className="p-4">
      <header className="mb-4 flex items-end gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold">Áreas (público, estático)</h2>
          <p className="text-muted-foreground text-sm">
            Lista áreas ativas por unidade usando <code>/v1/areas/public/by-unit/:unitId</code>.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground mb-1">Unidade</label>
            <select
              className="input"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={loadingUnits}
            >
              <option value="">Selecione…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {!unitId && (
        <div className="card">
          <p className="text-sm text-muted-foreground">Selecione uma unidade para visualizar as áreas.</p>
        </div>
      )}

      {unitId && (loadingAreas ? (
        <Skeleton rows={6} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th style={{width: 84}}>Foto</th>
                <th>Nome</th>
                <th className="text-right" title="Capacidade geral (fallback)">Cap.</th>
                <th className="text-right" title="Capacidade Tarde">Tarde</th>
                <th className="text-right" title="Capacidade Noite">Noite</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {(areas ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td>
                    {a.photoUrl ? (
                      <img
                        src={a.photoUrl}
                        alt={a.name}
                        className="h-14 w-20 object-cover rounded"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">sem foto</span>
                    )}
                  </td>
                  <td>{a.name}</td>
                  <td className="text-right">{a.capacity ?? '—'}</td>
                  <td className="text-right">{a.capacityAfternoon ?? '—'}</td>
                  <td className="text-right">{a.capacityNight ?? '—'}</td>
                  <td className="text-center">
                    <span className={`badge ${a.isActive ? 'badge-success' : ''}`}>
                      {a.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                </tr>
              ))}
              {areas && areas.length === 0 && (
                <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma área cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
