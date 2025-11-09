import * as React from 'react';
import IconPicker from './components/IconPicker'; // ajuste o path conforme sua estrutura

type Area = {
  id: string;
  name: string;
  photoUrl: string | null;
  capacity: number | null;
  capacityAfternoon: number | null;
  capacityNight: number | null;
  isActive: boolean;
  iconEmoji?: string | null;
  description?: string | null;
};

type Props = {
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onSaved: (updated: Area) => void;
  apiBase: string; // ex.: process.env.NEXT_PUBLIC_API_BASE
};

export default function AreaEditModal({ open, area, onClose, onSaved, apiBase }: Props) {
  const [form, setForm] = React.useState<Area | null>(area);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(area);
    setError(null);
  }, [area, open]);

  if (!open || !form) return null;

  function onChange<K extends keyof Area>(key: K, value: Area[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/areas/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          capacity: numOrNull(form.capacity),
          capacityAfternoon: numOrNull(form.capacityAfternoon),
          capacityNight: numOrNull(form.capacityNight),
          isActive: !!form.isActive,
          iconEmoji: (form.iconEmoji ?? '').trim() || null,
          description: (form.description ?? '').trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Falha ao salvar área');
      }
      onSaved(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload() {
    if (!form) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${apiBase}/v1/areas/${form.id}/photo`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Falha no upload');
      }
      // API costuma retornar a área atualizada; se não, faça um refetch fora.
      onSaved(payload);
      // zera input pra poder reenviar se quiser
      if (fileRef.current) fileRef.current.value = '';
      setForm(payload);
    } catch (err: any) {
      setError(err?.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header className="modal-header">
          <h3 className="modal-title">Editar área</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <form onSubmit={handleSave} className="modal-body grid gap-3">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="grid gap-1">
            <label className="label">Nome</label>
            <input
              className="input"
              value={form.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1">
            <IconPicker
              label="Ícone da área"
              value={form.iconEmoji ?? null}
              onChange={(emoji) => onChange('iconEmoji', emoji)}
              placeholder="Escolha um emoji"
            />
            <p className="text-xs text-muted-foreground">Dica: use um emoji simples pra identificação rápida (ex.: 🍺 Deck Chopes, 🎸 Palco, 🪑 Salão).</p>
          </div>

          <div className="grid gap-1">
            <label className="label">Descrição da área</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Ex.: Deck externo coberto, próximo ao palco; ideal para grupos."
              value={form.description ?? ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <label className="label">Descrição</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Ex.: Deck externo coberto, vista para o palco…"
              value={form.description ?? ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <label className="label">Capacidade (fallback)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={form.capacity ?? ''}
              onChange={(e) => onChange('capacity', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="label">Cap. Tarde</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.capacityAfternoon ?? ''}
                onChange={(e) => onChange('capacityAfternoon', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <label className="label">Cap. Noite</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.capacityNight ?? ''}
                onChange={(e) => onChange('capacityNight', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={!!form.isActive}
              onChange={(e) => onChange('isActive', e.target.checked)}
            />
            <label htmlFor="isActive">Ativa</label>
          </div>

          <div className="grid gap-1">
            <label className="label">Foto da área</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" />
              <button
                type="button"
                className="btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
            {form.photoUrl && (
              <div className="mt-2">
                <img src={form.photoUrl} alt={form.name} className="h-24 rounded object-cover" />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function numOrNull(n: number | null | undefined) {
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}
