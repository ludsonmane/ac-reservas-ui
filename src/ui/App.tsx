// src/ui/App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { api, getBaseUrl, apiUrl } from '../lib/api';
import { invalidate } from '../lib/query';
import { useStore, setToken, clearAuth, setUser } from '../store';
import type { Reservation, User } from '../types';
import Skeleton from './Skeleton';
import Toaster from './Toaster';
import { toast } from './toast';
import { useUnits } from './hooks/useUnits';
import { useReservations } from './hooks/useReservations';
import UnitsPage from './UnitsPage';
import { useAreasByUnit } from './hooks/useAreasByUnit';
import AreasPage from './AreasPage';
import UsersPage from './UsersPage';
import CheckinPage from './CheckinPage';
import { ensureAnalyticsReady, setActiveUnitPixelFromUnit } from '../lib/analytics';

/* ---------- helpers de data ---------- */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${y}-${m}-${da}T${h}:${mi}`;
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
function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    const v = (obj as any)[k];
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  });
  return out as Partial<T>;
}

/* ---------- Loading Modal (inline) ---------- */
function LoadingDialog({
  open = false,
  title = 'Entrando...',
  message = 'Validando suas credenciais. Aguarde um instante.',
}: { open?: boolean; title?: string; message?: string }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card w-full max-w-sm text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
        <h3 className="title text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}

/* ---------- Topbar ---------- */
function Topbar() {
  const { user } = useStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function initials(full?: string | null) {
    if (!full) return '??';
    const parts = full.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || '').join('') || '??';
  }

  async function doLogout() {
    try { await api('/auth/logout', { method: 'POST', auth: true }); } catch { }
    clearAuth();
    invalidate('*');
    toast.success('Você saiu da aplicação.');
    window.location.replace(window.location.origin + window.location.pathname);
  }

  return (
    <header
      className={[
        'sticky top-0 z-20',
        'border-b border-border',
        'bg-gradient-to-b from-white/70 to-panel/80 backdrop-blur',
        'supports-[backdrop-filter]:backdrop-blur',
        'shadow-[0_6px_20px_-12px_rgba(0,0,0,0.25)]',
      ].join(' ')}
      role="banner"
    >
      <div className="container flex items-center gap-3 py-3">
        <a href="/" className="group inline-flex items-center gap-3" title="Mané • Admin Reservas">
          <div className="relative">
            <img
              src="https://reservas.mane.com.vc/_next/image?url=%2Fimages%2F1.png&w=256&q=75"
              alt="Mané Mercado"
              className="h-10 w-auto md:h-11 block transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 [box-shadow:0_0_0_6px_rgba(34,197,94,0.08)_inset]" />
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-base font-medium">Admin Reservas</div>
            <div className="text-xs text-muted -mt-0.5">Mané Mercado</div>
          </div>
        </a>

        <div className="flex-1" />

        {user ? (
          <div className="relative" ref={ref}>
            <button
              type="button"
              className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/70 px-2.5 py-1.5 hover:bg-card transition-colors"
              onClick={() => setOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-sm">{user.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  <span className={`px-1.5 py-0.5 rounded ${user.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {user.role}
                  </span>
                </span>
              </span>
              <span className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white grid place-items-center font-semibold shadow-inner" aria-hidden="true">
                {initials(user.name)}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Abrir menu do usuário</span>
            </button>

            {open && (
              <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card/95 backdrop-blur p-2 shadow-xl">
                <div className="px-2 py-2.5 rounded-md bg-panel/70 border border-border/70">
                  <div className="text-sm font-medium leading-tight">{user.name}</div>
                  <div className="text-xs text-muted">{user.email || '—'}</div>
                </div>

                <div className="mt-1.5">
                  <button
                    className="w-full text-left rounded-md px-3 py-2 hover:bg-panel transition-colors text-sm"
                    onClick={() => {
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent('app:open-profile', { detail: { id: user!.id } }));
                    }}
                  >
                    Meu perfil
                  </button>
                  <a className="block rounded-md px-3 py-2 hover:bg-panel transition-colors text-sm" href="/docs" target="_blank" rel="noopener noreferrer">
                    Documentação da API
                  </a>
                </div>

                <div className="my-1 h-px bg-border/70" />

                <button className="w-full inline-flex items-center justify-between rounded-md px-3 py-2 hover:bg-red-50 text-red-600 transition-colors text-sm" onClick={doLogout}>
                  Sair
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted">Faça login para acessar o painel</div>
        )}
      </div>
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
    </header>
  );
}

/* ---------- Ícones ---------- */
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true" className="block">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true" className="block">
    <path d="M3 12a9 9 0 0 1 15-6l2 2" /><path d="M21 12a9 9 0 0 1-15 6l-2-2" /><path d="M20 8V4h-4" /><path d="M4 16v4h4" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true" className="block">
    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
  </svg>
);

/* ---------- Modal de Consulta ---------- */
function ConsultModal({
  open, code, onClose,
}: { open: boolean; code: string | null; onClose: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resv, setResv] = React.useState<any | null>(null);

  const { units } = useUnits(open);
  const unitsById = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(units.map(u => [u.id, u.name])),
    [units]
  );

  const apiBase = getBaseUrl();
  const publicBase =
    (typeof window !== 'undefined' && (window as any).__CFG?.PUBLIC_APP_BASE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  React.useEffect(() => {
    if (!open || !code) return;
    (async () => {
      setLoading(true);
      setError(null);
      setResv(null);
      try {
        let r = await fetch(apiUrl(`/v1/reservations/public/lookup?code=${encodeURIComponent(code)}`), { cache: 'no-store' });
        if (r.status === 404) r = await fetch(apiUrl(`/v1/reservations/lookup?code=${encodeURIComponent(code)}`), { cache: 'no-store' });
        if (r.status === 404) r = await fetch(apiUrl(`/v1/reservations/code/${encodeURIComponent(code)}`), { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status === 404 ? 'Reserva não encontrada.' : 'Não foi possível carregar a reserva.');
        const data = await r.json();
        setResv(data);
      } catch (e: any) {
        const msg = e?.message || 'Não foi possível carregar a reserva.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, code, apiBase]);

  if (!open) return null;

  const unitLabel =
    resv?.unitId ? (unitsById[resv.unitId] ?? undefined) :
      resv?.unitName ?? resv?.unit ?? '-';

  const areaLabel = resv?.areaName ?? resv?.area ?? '-';

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-2xl p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
          <h3 className="text-lg font-normal m-0">Consulta de Reserva</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
              <span>Carregando…</span>
            </div>
          )}

          {!loading && error && <div className="text-danger">{error}</div>}

          {!loading && !error && resv && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted">Código</div>
                <div className="text-base font-mono">{resv.reservationCode}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Status</div>
                <div><span className={`badge ${resv.status === 'CHECKED_IN' ? 'badge-ok' : 'badge-wait'}`}>{resv.status}</span></div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-muted">Cliente</div>
                <div className="text-base">{resv.fullName || '-'}</div>
                <div className="text-xs text-muted">{resv.email || ''}{resv.phone ? ` • ${resv.phone}` : ''}</div>
              </div>

              <div>
                <div className="text-xs text-muted">Data/Hora</div>
                <div className="text-base">{new Date(resv.reservationDate).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Pessoas</div>
                <div className="text-base">{resv.people}{resv.kids ? ` (+${resv.kids})` : ''}</div>
              </div>

              <div>
                <div className="text-xs text-muted">Unidade</div>
                <div className="text-base">{unitLabel || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Área</div>
                <div className="text-base">{areaLabel || '-'}</div>
              </div>

              {(resv.source || resv.utm_source) && (
                <div className="md:col-span-2">
                  <div className="text-xs text-muted">Origem</div>
                  <div className="text-base">{resv.utm_source || resv.source}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-card flex justify-between gap-2">
          <div className="text-xs text-muted self-center">
            {resv?.id ? `ID: ${resv.id}` : ''}
          </div>
          <div className="flex gap-2">
            {resv?.reservationCode && (
              <>
                <a
                  className="btn"
                  href={`https://reservas.mane.com.vc/consultar?code=${encodeURIComponent(resv.reservationCode)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no site público
                </a>
                <button
                  className="btn"
                  onClick={() => {
                    const url = `https://reservas.mane.com.vc/consultar?code=${encodeURIComponent(resv.reservationCode)}`;
                    navigator.clipboard?.writeText(url).then(
                      () => toast.success('Link copiado.'),
                      () => toast.success('Link: ' + url)
                    );
                  }}
                >
                  Copiar link público
                </button>
              </>
            )}
            {resv?.id && (
              <a
                className="btn btn-primary"
                href={`/checkin?id=${encodeURIComponent(resv.id)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir Check-in
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- ConfirmDialog ---------- */
function ConfirmDialog({
  open,
  title = 'Confirmar ação',
  description,
  confirmText = 'Confirmar',
  loadingText = 'Processando…',
  cancelText = 'Cancelar',
  variant = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  loadingText?: string;
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
      variant === 'primary' ? 'btn btn-primary' :
        'btn';

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
          <button className={confirmBtnClass} onClick={handleConfirm} disabled={loading} aria-busy={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
                {loadingText}
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tabela de Reservas (ajustada) ---------- */
function ReservationsTable({
  filters, setFilters, onConsult, onAskDelete,
}: {
  filters: any;
  setFilters: (v: any) => void;
  onConsult: (code: string) => void;
  onAskDelete: (r: Reservation) => void;
}) {
  const { data, loading } = useReservations(filters);

  const { units } = useUnits(true);
  const unitsById = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(units.map(u => [u.id, u.name])),
    [units]
  );

  const [renewTarget, setRenewTarget] = React.useState<Reservation | null>(null);
  const [qrBust, setQrBust] = React.useState<number>(0);

  function isToday(iso?: string | null) {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }
  function fmtDateTime(iso?: string | null) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return '-'; }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">Criada em</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Reserva</th>
              <th className="px-3 py-2">Pessoas</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Área</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>

          {loading && (
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-11 w-11" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-10" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-5 w-20" /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}

          {!loading && (
            <tbody>
              {data.items.map((r: Reservation) => {
                const statusClass = r.status === 'CHECKED_IN' ? 'badge-ok' : 'badge-wait';
                const when = new Date(r.reservationDate).toLocaleString();

                const unitLabel =
                  (r as any).unitId ? (unitsById[(r as any).unitId] ?? undefined)
                    : (r as any).unitName ?? (r as any).unit ?? '-';

                const origem = (r as any).utm_source || (r as any).source || '-';

                const createdAt =
                  (r as any).createdAt ?? (r as any).created_at ?? (r as any).created ?? null;

                const qrUrl = apiUrl(`/v1/reservations/${r.id}/qrcode?v=${qrBust}`);

                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap align-top min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span>{fmtDateTime(createdAt)}</span>
                        {isToday(createdAt) && (
                          <span className="inline-flex items-center rounded-full border px-2 py-[2px] text-xs tracking-wide text-emerald-700 border-emerald-200 bg-emerald-50">
                            hoje
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 align-top whitespace-nowrap min-w-[92px]">
                      {r.reservationCode ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                          title="Consultar reserva"
                          onClick={() => onConsult(r.reservationCode!)}
                        >
                          <span>{r.reservationCode}</span>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-80">
                            <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6" />
                            <path d="M10 14L21 3" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top min-w=[260px]">
                      <div className="flex items-center gap-2">
                        <img
                          src={qrUrl}
                          className="h-11 w-11 rounded border border-border"
                          crossOrigin="anonymous"
                          alt=""
                        />
                        <div className="leading-tight">
                          <div className="font-medium">{r.fullName}</div>
                          <div className="text-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px]">
                            {r.email || ''}{r.phone ? ' • ' + r.phone : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2 align-top whitespace-nowrap">{when}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{r.people}{r.kids ? ` (+${r.kids})` : ''}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{unitLabel || '-'}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{(r as any).areaName || (r as any).area || '-'}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{origem}</td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <span className={`badge ${statusClass}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <div className="flex gap-2 justify-end">
                        <IconBtn title="Editar" onClick={() => setFilters({ ...filters, showModal: true, editing: r })}><PencilIcon /></IconBtn>
                        <IconBtn title="Renovar QR" onClick={() => setRenewTarget(r)}><RefreshIcon /></IconBtn>
                        <IconBtn title="Excluir" danger onClick={() => onAskDelete(r)}><TrashIcon /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-muted">Sem resultados</td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 text-muted mt-3">
        <button className="btn btn-sm" onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}>◀</button>
        <span>Página {data.page} de {data.totalPages} — {data.total} itens</span>
        <button className="btn btn-sm" onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}>▶</button>
      </div>

      {/* Renovar QR */}
      <ConfirmDialog
        open={!!renewTarget}
        title="Gerar novo QR Code?"
        description={
          <div className="space-y-1">
            <p>Isso irá gerar um novo QR e alterar o status para <b>AWAITING_CHECKIN</b>.</p>
            {renewTarget && <p className="text-sm text-muted"><b>Código:</b> <code>{renewTarget.reservationCode || '—'}</code></p>}
          </div>
        }
        confirmText="Gerar novo QR"
        loadingText="Gerando…"
        cancelText="Cancelar"
        variant="primary"
        onCancel={() => setRenewTarget(null)}
        onConfirm={async () => {
          if (!renewTarget) return;
          try {
            await api(`/v1/reservations/${renewTarget.id}/qr/renew`, { method: 'POST', auth: true });
            setRenewTarget(null);
            setFilters({ ...filters });
            setQrBust(Date.now());
            toast.success('QR renovado e status atualizado.');
          } catch (e: any) {
            const msg = e?.error?.message || e?.message || 'Erro ao renovar QR.';
            toast.error(msg);
          }
        }}
      />
    </>
  );
}

/* ---------- Filtros (UI) ---------- */
function FiltersBar({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const { units, loading: loadingUnits } = useUnits(true);
  const areasByUnit = useAreasByUnit(value.unitId || undefined, !!value.unitId);

  const unitIdOf = (u: any) => (u && typeof u === 'object' ? u.id : '');
  const unitNameOf = (u: any) => (u && typeof u === 'object' ? u.name : String(u ?? ''));

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 flex-1">
        <label>
          <span>Buscar</span>
          <input
            className="input"
            value={value.search || ''}
            onChange={(e) => onChange({ ...value, search: e.target.value, page: 1 })}
            placeholder="nome, email, telefone, código..."
          />
        </label>

        <label>
          <span>Unidade</span>
          <select
            className="input"
            value={value.unitId || ''}
            onChange={(e) => {
              const opt = e.target.options[e.target.selectedIndex];
              const newUnitId = e.target.value || '';
              const unitName = newUnitId ? opt.text : '';
              const unitSlug = newUnitId ? (opt.getAttribute('data-slug') || '') : '';

              // pixel (mantém)
              const selected = (units as any[]).find(u => (u?.id ?? '') === newUnitId);
              if (selected) setActiveUnitPixelFromUnit(selected);

              // 🔑 guarda ID + SLUG (evita depender do nome)
              onChange({ ...value, unitId: newUnitId, unitSlug, areaId: '', page: 1 });
            }}
            disabled={loadingUnits}
          >
            <option value="">{loadingUnits ? 'Carregando…' : 'Todas'}</option>
            {(units as any[]).map((u) => (
              <option key={u.id} value={u.id} data-slug={u.slug || ''}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Área</span>
          <select
            className="input"
            value={value.areaId || ''}
            onChange={(e) => onChange({ ...value, areaId: e.target.value || '', page: 1 })}
            disabled={!value.unitId || areasByUnit.loading}
          >
            <option value="">
              {!value.unitId ? 'Selecione uma unidade' : (areasByUnit.loading ? 'Carregando…' : 'Todas')}
            </option>
            {areasByUnit.data?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>De</span>
          <input
            className="input"
            type="datetime-local"
            value={value.from || ''}
            onChange={(e) => onChange({ ...value, from: e.target.value, page: 1 })}
          />
        </label>

        <label>
          <span>Até</span>
          <input
            className="input"
            type="datetime-local"
            value={value.to || ''}
            onChange={(e) => onChange({ ...value, to: e.target.value, page: 1 })}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button className="btn" onClick={() => onChange({ ...value })}>Atualizar</button>
        <button className="btn btn-primary" onClick={() => onChange({ ...value, showModal: true, editing: null })}>
          Nova Reserva
        </button>
      </div>
    </div>
  );
}

/* ---------- Modal de Reserva ---------- */
function ReservationModal({
  open, onClose, editing, onSaved, defaultUnitId,
}: {
  open: boolean;
  onClose: () => void;
  editing: Reservation | null;
  onSaved: () => void;
  defaultUnitId?: string;
}) {
  const { user } = useStore();
  const isAdmin = user?.role === 'ADMIN';
  const lockMarketing = !!editing && !isAdmin;

  const [form, setForm] = React.useState<any>(() => ({
    unitId: defaultUnitId ?? null,
  }));
  const [saving, setSaving] = React.useState(false);

  const { units, loading: loadingUnits } = useUnits(open);
  const areasByUnit = useAreasByUnit(form.unitId || undefined, open && !!form.unitId);

  const unitIdOf = (u: any) => (u && typeof u === 'object' ? u.id : '');
  const unitNameOf = (u: any) => (u && typeof u === 'object' ? u.name : String(u ?? ''));

  React.useEffect(() => {
    const f: any = editing
      ? { ...editing }
      : { people: 1, kids: 0, reservationDate: new Date().toISOString(), unitId: defaultUnitId ?? null, areaId: null };

    if (f.reservationDate) f.reservationDate = toLocalInput(f.reservationDate);
    if (f.birthdayDate) f.birthdayDate = f.birthdayDate.substring(0, 10);

    f.unitId = editing?.unitId ?? (defaultUnitId ?? null);
    f.areaId = editing?.areaId ?? null;

    setForm(f);
  }, [editing, open, defaultUnitId]);

  React.useEffect(() => {
    if (open && !editing && defaultUnitId) {
      setForm((s: any) => ({ ...s, unitId: defaultUnitId, areaId: null }));
    }
  }, [defaultUnitId, open, editing]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const payload: any = {
      fullName: form.fullName,
      people: Number(form.people || 1),
      kids: Number(form.kids || 0),

      reservationDate: new Date(form.reservationDate).toISOString(),
      birthdayDate: form.birthdayDate ? new Date(form.birthdayDate).toISOString() : null,

      cpf: form.cpf || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,

      unitId: form.unitId || null,
      areaId: form.areaId || null,

      utm_source: form.utm_source || null,
      utm_campaign: form.utm_campaign || null,
      source: form.source || null,
    };

    if (editing && !isAdmin) {
      delete payload.utm_source;
      delete payload.utm_campaign;
      delete payload.source;
    }

    try {
      if (editing) {
        await api(`/v1/reservations/${editing.id}`, { method: 'PUT', body: payload, auth: true });
        toast.success('Reserva atualizada.');
      } else {
        await api('/v1/reservations', { method: 'POST', body: payload, auth: true });
        toast.success('Reserva criada.');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      console.error(e);
      const msg = e?.userMessage || e?.message || 'Erro ao salvar a reserva.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Editar reserva' : 'Nova reserva'}>
      <div className="card shadow-none w-full max-w-3xl md:max-w-4xl max-h=[90vh] md:max-h-[85vh] p-0 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between flex-none">
          <h3 className="title text-xl m-0"> {editing ? 'Editar' : 'Nova'} Reserva</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Fechar</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">

            <label>
              <span>Unidade</span>
              <select
                className="input py-2"
                value={form.unitId || ''}
                onChange={(e) => { set('unitId', e.target.value || null); set('areaId', null); }}
                disabled={loadingUnits || saving}
              >
                <option value="">{loadingUnits ? 'Carregando unidades...' : 'Selecione a unidade'}</option>
                {(units as any[]).map((u) => (
                  <option key={unitIdOf(u)} value={unitIdOf(u)}>{unitNameOf(u)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Nome completo*</span>
              <input className="input py-2" value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} placeholder="Ex.: Maria Silva" disabled={saving} />
            </label>

            <label>
              <span>Pessoas*</span>
              <input className="input py-2" type="number" min={1} value={form.people ?? 1} onChange={(e) => set('people', parseInt(e.target.value || '1'))} disabled={saving} />
            </label>
            <label>
              <span>Crianças</span>
              <input className="input py-2" type="number" min={0} value={form.kids ?? 0} onChange={(e) => set('kids', parseInt(e.target.value || '0'))} disabled={saving} />
            </label>

            <label className="md:col-span-2">
              <span>Área</span>
              <select
                className="input py-2"
                value={form.areaId || ''}
                onChange={(e) => set('areaId', e.target.value || null)}
                disabled={!form.unitId || areasByUnit.loading || saving}
              >
                <option value="">{!form.unitId ? 'Selecione uma unidade' : (areasByUnit.loading ? 'Carregando áreas...' : 'Selecione uma área')}</option>
                {areasByUnit.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.capacity ? ` (${a.capacity})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Data da reserva*</span>
              <input className="input py-2" type="datetime-local" value={form.reservationDate || ''} onChange={(e) => set('reservationDate', e.target.value)} disabled={saving} />
            </label>
            <label>
              <span>Data de aniversário</span>
              <input className="input py-2" type="date" value={form.birthdayDate || ''} onChange={(e) => set('birthdayDate', e.target.value)} disabled={saving} />
            </label>

            <label>
              <span>CPF</span>
              <input className="input py-2" value={form.cpf || ''} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" disabled={saving} />
            </label>
            <label>
              <span>Telefone</span>
              <input className="input py-2" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="(00) 00000-0000" disabled={saving} />
            </label>

            <label className="md:col-span-2">
              <span>Email</span>
              <input className="input py-2" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="cliente@exemplo.com" disabled={saving} />
            </label>

            <label className="md:col-span-2">
              <span>Notas</span>
              <textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Observações adicionais (opcional)" disabled={saving} />
            </label>

            <label>
              <span>UTM Source</span>
              <input className={`input py-2 ${lockMarketing ? 'opacity-60 cursor-not-allowed' : ''}`} value={form.utm_source || ''} onChange={(e) => set('utm_source', e.target.value)} disabled={saving || lockMarketing} />
            </label>
            <label>
              <span>UTM Campaign</span>
              <input className={`input py-2 ${lockMarketing ? 'opacity-60 cursor-not-allowed' : ''}`} value={form.utm_campaign || ''} onChange={(e) => set('utm_campaign', e.target.value)} disabled={saving || lockMarketing} />
            </label>
            <label className="md:col-span-2">
              <span>Source</span>
              <input className={`input py-2 ${lockMarketing ? 'opacity-60 cursor-not-allowed' : ''}`} value={form.source || ''} onChange={(e) => set('source', e.target.value)} placeholder="Origem (ex.: WhatsApp, Site, Balcão)" disabled={saving || lockMarketing} />
            </label>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-card flex justify-end gap-2 flex-none">
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
                Salvando…
              </span>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Página: Reservas ---------- */
function ReservationsPanel() {
  const [filters, setFilters] = useState<any>({
    page: 1, pageSize: 10, showModal: false, editing: null,
    unitId: '', unitSlug: '',   // 👈 aqui
    areaId: '',
    search: '',
    from: '', to: '',
  });

  const [consultOpen, setConsultOpen] = useState(false);
  const [consultCode, setConsultCode] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);

  // debounce do texto de busca
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(filters.search || ''), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  // 🔒 Whitelist dos filtros enviados ao hook/API (evita 'unit' solta)
  const derivedFilters = useMemo(() => {
    const only = {
      page: filters.page,
      pageSize: filters.pageSize,
      unitId: filters.unitId || undefined,
      unitSlug: filters.unitSlug || undefined,   // 👈 novo
      areaId: filters.areaId || undefined,
      q: (searchDebounced || undefined) as string | undefined,
      from: localToISOStart(filters.from),
      to: localToISOEnd(filters.to),
    };
    return compact(only);
  }, [filters, searchDebounced]);

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await api(`/v1/reservations/${deleteTarget.id}`, { method: 'DELETE', auth: true });
      toast.success('Reserva excluída.');
      setFilters({ ...filters });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      toast.error('Erro ao excluir a reserva.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="container mt-4">
      <div className="card">
        <h2 className="title text-2xl mb-3">Reservas</h2>
        <FiltersBar value={filters} onChange={setFilters} />
        <ReservationsTable
          filters={{ ...derivedFilters, _rt: `${filters.page}-${searchDebounced}-${filters.unitId}-${filters.areaId}-${filters.from}-${filters.to}` }}
          setFilters={setFilters}
          onConsult={(code) => { setConsultCode(code); setConsultOpen(true); }}
          onAskDelete={(r) => { setDeleteTarget(r); setDeleteOpen(true); }}
        />
      </div>

      <ReservationModal
        open={!!filters.showModal}
        editing={filters.editing}
        onClose={() => setFilters({ ...filters, showModal: false, editing: null })}
        onSaved={() => setFilters({ ...filters })}
        defaultUnitId={filters.unitId || undefined}
      />

      <ConsultModal
        open={consultOpen}
        code={consultCode}
        onClose={() => { setConsultOpen(false); setConsultCode(null); }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir reserva"
        description={
          <div>
            Tem certeza que deseja excluir a reserva
            {deleteTarget?.reservationCode ? <> <b className="font-semibold"> {deleteTarget.reservationCode}</b></> : null}
            ?<br />
            <span className="text-muted">Esta ação não pode ser desfeita.</span>
          </div>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        onCancel={() => { if (!deleting) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}

/* ---------- App ---------- */
function IconBtn({
  title,
  onClick,
  variant = '',
  danger = false,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  variant?: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center btn btn-sm ${danger ? 'btn-danger' : variant} h-9 w-9 p-0 rounded-full`}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      <span className="text-[20px] leading-none pointer-events-none">{children}</span>
      <span className="sr-only">{title}</span>
    </button>
  );
}

export default function App() {
  const { token, user } = useStore();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<'reservas' | 'unidades' | 'areas' | 'usuarios'>('reservas');

  const isCheckinRoute = typeof window !== 'undefined' && window.location.pathname.includes('/checkin');

  useEffect(() => {
    ensureAnalyticsReady();
  }, []);

  useEffect(() => {
    const onFocus = () => invalidate('*');
    const onOnline = () => invalidate('*');
    const onVisChange = () => { if (document.visibilityState === 'visible') onFocus(); };

    window.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    function onAuthExpired(e: any) {
      clearAuth();
      invalidate('*');
      const reason =
        e?.detail?.userMessage ||
        e?.detail?.error?.message ||
        e?.detail?.error ||
        'Sua sessão expirou. Faça login novamente.';
      toast.error(reason);
    }
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

  useEffect(() => {
    if (token && !user) {
      (async () => {
        try {
          const me = await api('/auth/me', { auth: true });
          setUser(me.user as User);
        } catch {
          clearAuth();
        }
      })();
    }
  }, [token, !!user]);

  useEffect(() => {
    function onOpenProfile(e: any) {
      const id = e?.detail?.id;
      if (!id) return;
      setTab('usuarios');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('users:edit', { detail: { id } }));
      }, 0);
    }
    window.addEventListener('app:open-profile', onOpenProfile);
    return () => window.removeEventListener('app:open-profile', onOpenProfile);
  }, []);

  return (
    <div>
      <Toaster />
      <Topbar />
      {!token ? (
        <LoginCard />
      ) : (
        <>
          {isCheckinRoute ? (
            <CheckinPage />
          ) : (
            <>
              <NavTabs active={tab} onChange={setTab} isAdmin={isAdmin} />
              {tab === 'reservas' ? (
                <ReservationsPanel />
              ) : tab === 'unidades' ? (
                <UnitsPage />
              ) : tab === 'areas' ? (
                <AreasPage />
              ) : (
                <UsersPage />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- NavTabs ---------- */
function NavTabs({
  active,
  onChange,
  isAdmin,
}: {
  active: 'reservas' | 'unidades' | 'areas' | 'usuarios';
  onChange: (t: 'reservas' | 'unidades' | 'areas' | 'usuarios') => void;
  isAdmin: boolean;
}) {
  const items: Array<{
    key: 'reservas' | 'unidades' | 'areas' | 'usuarios';
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }> = [
      {
        key: 'reservas',
        label: 'Reservas',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7h18" /><path d="M8 3v4M16 3v4" /><rect x="3" y="5" width="18" height="16" rx="2" />
          </svg>
        ),
      },
      {
        key: 'unidades',
        label: 'Unidades',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-6 9 6" /><path d="M9 22V12h6v10" /><path d="M3 10v12h18V10" />
          </svg>
        ),
      },
      {
        key: 'areas',
        label: 'Áreas',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        key: 'usuarios',
        label: 'Usuários',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
    ];

  const visible = items.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="container mt-4">
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card/70 backdrop-blur px-1" role="tablist" aria-label="Navegação principal">
        <div className="flex min-w-max gap-1 p-1">
          {visible.map((it) => {
            const isActive = active === it.key;
            return (
              <button
                key={it.key}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(it.key)}
                className={[
                  'relative group inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60',
                  isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-muted hover:text-foreground hover:bg-panel',
                ].join(' ')}
              >
                <span className={isActive ? '' : 'opacity-75 group-hover:opacity-100'}>{it.icon}</span>
                <span className="text-sm font-medium">{it.label}</span>
                {isActive && <span aria-hidden="true" className="pointer-events-none absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ---------- Login ---------- */
function LoginCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  function pickToken(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const direct = obj.token ?? obj.accessToken ?? obj.access_token ?? obj.jwt ?? obj.JWT ?? null;
    if (typeof direct === 'string' && direct) return direct;

    if (obj.token && typeof obj.token === 'object') {
      const nested = obj.token.accessToken ?? obj.token.access_token ?? obj.token.value ?? null;
      if (typeof nested === 'string' && nested) return nested;
    }
    if (obj.data) {
      const fromData = pickToken(obj.data);
      if (fromData) return fromData;
    }
    const JWT_RE = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && JWT_RE.test(v)) return v;
      if (v && typeof v === 'object') {
        const deep = pickToken(v);
        if (deep) return deep;
      }
    }
    return null;
  }

  const emailTrim = email.trim();
  const passTrim = password.trim();
  const emailOk = isEmail(emailTrim);
  const passOk = passTrim.length >= 6;
  const canSubmit = emailOk && passOk && !loading;

  async function doLogin() {
    if (!emailOk) { toast.error('Informe um e-mail válido.'); return; }
    if (!passOk) { toast.error('Informe a senha (mín. 6 caracteres).'); return; }

    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email: emailTrim, password: passTrim } });
      const token = pickToken(data);
      if (!token) throw new Error('Token ausente');

      try { localStorage.setItem('token', token); } catch { }
      setToken(token);
      setUser((data?.user as User) ?? data?.data?.user ?? null);

      invalidate('*');
      toast.success('Login realizado com sucesso!');
    } catch (e: any) {
      const msg = e?.error?.error || e?.error?.message || e?.message || 'Falha no login.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) doLogin();
    else {
      if (!emailOk) toast.error('Informe um e-mail válido.');
      else if (!passOk) toast.error('Informe a senha (mín. 6 caracteres).');
    }
  }

  return (
    <section className="container mt-6">
      <LoadingDialog open={loading} title="Entrando..." message="Validando suas credenciais. Aguarde um instante." />
      <form className="card max-w-lg mx-auto" onSubmit={onSubmit} noValidate autoComplete="off">
        <h2 className="title text-2xl mb-3">Login</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span>E-mail</span>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
              disabled={loading}
              aria-invalid={email.length > 0 && !emailOk}
              autoFocus
              placeholder="seuemail@exemplo.com"
            />
          </label>

          <label className="col-span-2">
            <span>Senha</span>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              disabled={loading}
              autoComplete="current-password"
              aria-invalid={password.length > 0 && !passOk}
              placeholder="Sua senha"
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(e as any); }}
            />
          </label>

          <div className="col-span-2 flex justify-end gap-2">
            <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </div>

          <p className="text-muted text-sm col-span-2">Use as credenciais do /auth/login.</p>
        </div>
      </form>
    </section>
  );
}
