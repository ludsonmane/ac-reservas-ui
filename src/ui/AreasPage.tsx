// src/ui/AreasPage.tsx
import * as React from 'react';
import { useUnits } from './hooks/useUnits';
import Skeleton from './Skeleton';
import { toast } from './toast';
import { api, getBaseUrl } from '../lib/api';
import { useStore } from '../store';
import { PencilIcon, PowerIcon, TrashIcon } from './icons';
import Toggle from './Toggle';
import { useAreasAdmin, type AreaFilters } from './hooks/useAreasAdmin';

type AreaForm = {
  id?: string;
  unitId: string | null;
  name: string;
  capacityAfternoon: number | null;
  capacityNight: number | null;
  isActive: boolean;
  photoFile?: File | null; // só para upload
};

/* ---------- ConfirmDialog (bonitão) ---------- */
function ConfirmDialog({
  open,
  title = 'Confirmar ação',
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'default';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  if (!open) return null;

  async function handleConfirm() {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const confirmBtnClass =
    variant === 'danger' ? 'btn btn-danger' :
    variant === 'primary' ? 'btn btn-primary' : 'btn';

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card w-full max-w-md p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-card">
          <h3 className="text-lg font-normal m-0">{title}</h3>
        </div>
        <div className="px-5 py-4">
          {typeof description === 'string' ? <p className="text-sm">{description}</p> : description}
        </div>
        <div className="px-5 py-3 border-t border-border bg-card flex justify-end gap-2">
          <button className="btn" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button className={confirmBtnClass} onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
                {confirmText}
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Filtros ---------- */
function FiltersBar({
  value,
  onChange,
  onCreate,
  units,
  loadingUnits,
}: {
  value: AreaFilters;
  onChange: (v: AreaFilters) => void;
  onCreate: () => void;
  units: { id: string; name: string }[];
  loadingUnits: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
        <label>
          <span>Buscar</span>
          <input
            className="input"
            value={value.search || ''}
            onChange={(e) => onChange({ ...value, search: e.target.value, page: 1 })}
            placeholder="nome da área…"
          />
        </label>

        <label>
          <span>Unidade</span>
          <select
            className="input"
            value={value.unitId || ''}
            onChange={(e) => onChange({ ...value, unitId: e.target.value || '', page: 1 })}
            disabled={loadingUnits}
          >
            <option value="">{loadingUnits ? 'Carregando…' : 'Todas'}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            className="input"
            value={String(value.active ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...value,
                active: v === '' ? '' : v === 'true',
                page: 1,
              });
            }}
          >
            <option value="">Todos</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button className="btn" onClick={() => onChange({ ...value })}>Atualizar</button>
          <button className="btn btn-primary" onClick={onCreate}>Nova Área</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tabela ---------- */
function AreasTable({
  filters,
  onEdit,
  onToggle,
  onDelete,
  units,
}: {
  filters: AreaFilters & { set?: (v: AreaFilters) => void };
  onEdit: (area: any) => void;
  onToggle: (areaId: string, next: boolean) => Promise<void>;
  onDelete: (area: any) => void; // ← agora manda o objeto inteiro para o modal
  units: { id: string; name: string }[];
}) {
  const { data, loading } = useAreasAdmin(filters);

  const unitNameById = React.useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.name] as const)),
    [units]
  );

  const page = data;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Área</th>
              <th className="text-right">Tarde</th>
              <th className="text-right">Noite</th>
              <th>Unidade</th>
              <th>Ativa</th>
              <th>Criada em</th>
              <th></th>
            </tr>
          </thead>

          {loading && (
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td><Skeleton className="h-4 w-40" /></td>
                  <td><Skeleton className="h-4 w-12" /></td>
                  <td><Skeleton className="h-4 w-12" /></td>
                  <td><Skeleton className="h-4 w-36" /></td>
                  <td><Skeleton className="h-5 w-16" /></td>
                  <td><Skeleton className="h-4 w-28" /></td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Skeleton className="h-7 w-7" />
                      <Skeleton className="h-7 w-7" />
                      <Skeleton className="h-7 w-7" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}

          {!loading && (
            <tbody>
              {page.items.map((a) => {
                const unidade = a.unitName ?? unitNameById[a.unitId] ?? '-';
                return (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td className="text-right">{a.capacityAfternoon ?? '—'}</td>
                    <td className="text-right">{a.capacityNight ?? '—'}</td>
                    <td>{unidade}</td>
                    <td>
                      <span className={`badge ${a.isActive ? 'badge-ok' : 'badge-muted'}`}>
                        {a.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '-'}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="icon-btn" title="Editar área" onClick={() => onEdit(a)}>
                          <PencilIcon size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          title={a.isActive ? 'Desativar área' : 'Ativar área'}
                          onClick={() => onToggle(a.id, !a.isActive)}
                        >
                          <PowerIcon size={16} />
                        </button>
                        <button
                          className="icon-btn icon-danger"
                          title="Excluir área"
                          onClick={() => onDelete(a)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {page.items.length === 0 && (
                <tr><td colSpan={7}>Sem resultados</td></tr>
              )}
            </tbody>
          )}
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 text-muted mt-3">
        <span>Página {page.page} de {page.totalPages} — {page.total} itens</span>
      </div>

      <div className="flex items-center justify-center gap-3 text-muted mt-2">
        <button
          className="btn btn-sm"
          onClick={() => {
            const p = Math.max(1, (filters.page || 1) - 1);
            filters.set && filters.set({ ...filters, page: p });
          }}
        >◀</button>
        <button
          className="btn btn-sm"
          onClick={() => {
            const p = (filters.page || 1) + 1;
            filters.set && filters.set({ ...filters, page: p });
          }}
        >▶</button>
      </div>
    </>
  );
}

/* ---------- Modal de Área ---------- */
function AreaModal({
  open,
  onClose,
  editing,
  onSaved,
  units,
  loadingUnits,
}: {
  open: boolean;
  onClose: () => void;
  editing: any | null;
  onSaved: () => void;
  units: { id: string; name: string; slug: string }[];
  loadingUnits: boolean;
}) {
  const { token } = useStore();
  const API_BASE = getBaseUrl();

  const [form, setForm] = React.useState<AreaForm>({
    unitId: null,
    name: '',
    capacityAfternoon: null,
    capacityNight: null,
    isActive: true,
    photoFile: null,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id: editing.id,
        unitId: editing.unitId,
        name: editing.name,
        capacityAfternoon: editing.capacityAfternoon ?? null,
        capacityNight: editing.capacityNight ?? null,
        isActive: !!editing.isActive,
        photoFile: null,
      });
    } else {
      setForm({
        unitId: null,
        name: '',
        capacityAfternoon: null,
        capacityNight: null,
        isActive: true,
        photoFile: null,
      });
    }
  }, [open, editing]);

  const set = (k: keyof AreaForm, v: any) => setForm((s) => ({ ...s, [k]: v }));

  function asNumOrNull(v: any) {
    if (v === '' || v === null || typeof v === 'undefined') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }

  async function uploadPhoto(areaId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file); // field esperado pelo multer do mane-api

    const res = await fetch(`${API_BASE}/v1/areas/${areaId}/photo`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: fd,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.message || 'Falha no upload da foto');
    return payload; // área atualizada
  }

  async function handleSave() {
    if (saving) return;
    if (!form.unitId) return toast.error('Selecione a unidade.');
    if (!form.name.trim()) return toast.error('Informe o nome da área.');

    setSaving(true);
    try {
      const payload: any = {
        unitId: form.unitId,
        name: form.name.trim(),
        capacity: null, // não usamos mais 'capacity'
        capacityAfternoon: asNumOrNull(form.capacityAfternoon),
        capacityNight: asNumOrNull(form.capacityNight),
        isActive: !!form.isActive,
      };

      let areaId = form.id as string | undefined;

      if (form.id) {
        await api(`/v1/areas/${form.id}`, { method: 'PUT', body: payload, auth: true });
      } else {
        const created = await api('/v1/areas', { method: 'POST', body: payload, auth: true });
        areaId = created?.id;
      }

      if (areaId && form.photoFile) {
        await uploadPhoto(areaId, form.photoFile);
      }

      toast.success(form.id ? 'Área atualizada.' : 'Área criada.');
      onSaved();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.userMessage || e?.message || 'Erro ao salvar a área.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="card shadow-none w-full max-w-xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
          <h3 className="title text-xl m-0">{form.id ? 'Editar' : 'Nova'} Área</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Fechar</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2">
              <span>Unidade*</span>
              <select
                className="input py-2"
                value={form.unitId || ''}
                onChange={(e) => set('unitId', e.target.value || null)}
                disabled={loadingUnits || saving}
              >
                <option value="">{loadingUnits ? 'Carregando unidades…' : 'Selecione a unidade'}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>

            <label className="md:col-span-2">
              <span>Nome*</span>
              <input
                className="input py-2"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex.: Varanda, Salão Principal…"
                disabled={saving}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <label>
                <span>Cap. Tarde</span>
                <input
                  className="input py-2"
                  type="number"
                  min={0}
                  value={form.capacityAfternoon ?? ''}
                  onChange={(e) =>
                    set('capacityAfternoon', e.target.value === '' ? null : Math.max(0, parseInt(e.target.value || '0')))
                  }
                  disabled={saving}
                />
              </label>
              <label>
                <span>Cap. Noite</span>
                <input
                  className="input py-2"
                  type="number"
                  min={0}
                  value={form.capacityNight ?? ''}
                  onChange={(e) =>
                    set('capacityNight', e.target.value === '' ? null : Math.max(0, parseInt(e.target.value || '0')))
                  }
                  disabled={saving}
                />
              </label>
            </div>

            <label className="flex items-end md:items-center gap-3 md:col-auto col-span-1">
              <span>Status</span>
              <Toggle
                checked={form.isActive}
                onChange={(v) => set('isActive', v)}
                disabled={saving}
                label={form.isActive ? 'Ativa' : 'Inativa'}
              />
            </label>

            <label className="md:col-span-2">
              <span>Foto da área</span>
              <input
                className="input py-2"
                type="file"
                accept="image/*"
                onChange={(e) => set('photoFile', e.currentTarget.files?.[0] ?? null)}
                disabled={saving}
              />
              <p className="text-xs text-muted mt-1">
                Formatos comuns (JPG/PNG). O upload acontece ao salvar.
              </p>
            </label>

            {editing?.photoUrl && !form.photoFile && (
              <div className="md:col-span-2">
                <span className="text-xs text-muted">Foto atual:</span>
                <img
                  src={editing.photoUrl}
                  alt={editing.name}
                  className="mt-2 h-24 w-auto rounded border border-border object-cover"
                />
              </div>
            )}

            {form.photoFile && (
              <div className="md:col-span-2">
                <span className="text-xs text-muted">Pré-visualização:</span>
                <img
                  src={URL.createObjectURL(form.photoFile)}
                  alt="preview"
                  className="mt-2 h-24 w-auto rounded border border-border object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-card flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
                Salvando…
              </span>
            ) : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Página ---------- */
export default function AreasPage() {
  const [filters, setFilters] = React.useState<AreaFilters>({
    page: 1,
    pageSize: 10,
    unitId: '',
    search: '',
    active: '',
  });

  const [showModal, setShowModal] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);

  // estado do diálogo de exclusão
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const { units, loading: loadingUnits } = useUnits(true);
  const tableFilters = React.useMemo(() => ({ ...filters, set: setFilters }), [filters]);

  const handleToggle = async (areaId: string, next: boolean) => {
    try {
      await api(`/v1/areas/${areaId}`, {
        method: 'PUT',
        body: { isActive: next },
        auth: true,
      });
    toast.success(next ? 'Área ativada.' : 'Área desativada.');
      setFilters((f) => ({ ...f })); // revalidar
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao alterar status da área.');
    }
  };

  // abre modal bonito para excluir
  const askDelete = (area: any) => {
    setDeleteTarget(area);
    setDeleteOpen(true);
  };

  // confirma exclusão
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await api(`/v1/areas/${deleteTarget.id}`, { method: 'DELETE', auth: true });
      toast.success('Área excluída.');
      setFilters((f) => ({ ...f })); // revalidar
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.userMessage || e?.message || 'Erro ao excluir a área.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="container mt-4">
      <div className="card">
        <h2 className="title text-2xl mb-3">Áreas</h2>
        <FiltersBar
          value={filters}
          onChange={setFilters}
          onCreate={() => { setEditing(null); setShowModal(true); }}
          units={units}
          loadingUnits={loadingUnits}
        />
        <AreasTable
          filters={tableFilters as any}
          onEdit={(area) => { setEditing(area); setShowModal(true); }}
          onToggle={handleToggle}
          onDelete={askDelete}
          units={units}
        />
      </div>

      <AreaModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editing={editing}
        onSaved={() => setFilters((f) => ({ ...f }))}
        units={units}
        loadingUnits={loadingUnits}
      />

      {/* Dialogo de exclusão bonito */}
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir área"
        description={
          <div>
            Tem certeza que deseja excluir a área
            {deleteTarget?.name ? <> <b>{deleteTarget.name}</b></> : null}
            ?<br />
            <span className="text-muted">Esta ação não pode ser desfeita.</span>
          </div>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        onCancel={() => { if (!deleting) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
