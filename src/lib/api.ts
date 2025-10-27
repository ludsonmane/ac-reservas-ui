// src/lib/api.ts
import { invalidate } from './query';

export type FetchOpts = {
  method?: string;
  body?: any;
  auth?: boolean;
  headers?: Record<string, string>;
  /** timeout em ms (default 20000) */
  timeoutMs?: number;
};

type AnyObj = Record<string, any>;

declare global {
  interface Window {
    __CFG?: { API_BASE_URL?: string };
  }
}

/* ---------------- Base URL resolution ---------------- */
function sanitizeBase(b?: string | null) {
  const s = (b || '').trim();
  return s ? s.replace(/\/+$/, '') : '';
}

const fromRuntime = typeof window !== 'undefined' ? window.__CFG?.API_BASE_URL : '';
const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('BASE_URL') : '';
const fromVite = (import.meta as AnyObj)?.env?.VITE_API_BASE_URL as string | undefined;

/** Ordem:
 * 1) window.__CFG.API_BASE_URL
 * 2) localStorage.BASE_URL
 * 3) import.meta.env.VITE_API_BASE_URL
 * 4) vazio → chamadas relativas
 */
let BASE_URL =
  sanitizeBase(fromRuntime) ||
  sanitizeBase(fromStorage) ||
  sanitizeBase(fromVite) ||
  '';

export function setBaseUrl(url: string) {
  const clean = sanitizeBase(url);
  try { localStorage.setItem('BASE_URL', clean); } catch {}
  BASE_URL = clean;
}

export function getBaseUrl() {
  return BASE_URL;
}

function getToken() {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
}

/* ---------------- helpers ---------------- */
function joinUrl(base: string, path: string) {
  if (!base) return path; // chamada relativa
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

function topicFromPath(path: string): string | null {
  const p = /^https?:\/\//i.test(path) ? new URL(path).pathname : path;
  const clean = p.split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'v1' && parts[1]) return parts[1];
  return null;
}

function handleWriteInvalidation(path: string, method: string) {
  const m = (method || 'GET').toUpperCase();
  if (m !== 'GET') {
    const topic = topicFromPath(path);
    if (topic) invalidate(topic);
    invalidate('*');
  }
}

/* ---------------- throttling /areas/by-unit ---------------- */
const reqThrottle = {
  map: new Map<string, number>(),
  tooManyUntil: new Map<string, number>(),
  inc(key: string) { const n = (this.map.get(key) || 0) + 1; this.map.set(key, n); return n; },
  reset(key: string) { this.map.delete(key); this.tooManyUntil.delete(key); },
};

/* ---------------- sessão expirada ---------------- */
const AUTH_EXPIRED_EVENT = 'auth:expired';
let lastAuthNotifyAt = 0;
function handleAuthExpiry(detail?: any) {
  try { localStorage.removeItem('token'); } catch {}
  const now = Date.now();
  if (now - lastAuthNotifyAt > 1500) {
    lastAuthNotifyAt = now;
    try { window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail })); } catch {}
  }
}

/* ---------------- cliente ---------------- */
export async function api(path: string, opts: FetchOpts = {}) {
  const isAbs = /^https?:\/\//i.test(path);
  const url = isAbs ? path : joinUrl(BASE_URL, path);
  const method = (opts.method || 'GET').toUpperCase();

  const headers: Record<string, string> = { ...(opts.headers || {}) };

  // Auth
  const t = getToken();
  if (opts.auth && t) {
    headers['Authorization'] = `Bearer ${t}`;
  }

  // Anti-cache best effort em GET
  if (method === 'GET') {
    headers['Cache-Control'] = 'no-store';
    headers['Pragma'] = 'no-cache';
  }

  const init: RequestInit = { method, headers };

  // Body: respeita FormData / Blob / ArrayBuffer
  if (opts.body !== undefined && opts.body !== null) {
    const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    const isBlob = typeof Blob !== 'undefined' && opts.body instanceof Blob;
    const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && opts.body instanceof ArrayBuffer;

    if (isFormData || isBlob || isArrayBuffer) {
      init.body = opts.body as any;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
  }

  // Timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  init.signal = controller.signal;

  // throttling básico para /v1/areas/public/by-unit/:id
  const isAreasByUnit = method === 'GET' && /\/v1\/areas\/public\/by-unit\/[^/]+$/.test(url);

  let res: Response;
  try {
    if (isAreasByUnit) {
      const until = reqThrottle.tooManyUntil.get(url) || 0;
      if (Date.now() < until) {
        throw { status: 429, error: 'Too many requests (local throttle)' };
      }
      reqThrottle.inc(url);
    }

    res = await fetch(url, init);
  } catch (e: any) {
    clearTimeout(timeout);
    if (isAreasByUnit) reqThrottle.reset(url);
    throw {
      status: 0,
      error: { message: 'Falha de rede ao contatar a API', detail: String(e?.message || e) },
    };
  } finally {
    clearTimeout(timeout);
  }

  // 204 OK sem corpo
  if (res.status === 204) {
    handleWriteInvalidation(path, method);
    if (isAreasByUnit) reqThrottle.reset(url);
    return null;
  }

  const ct = res.headers.get('content-type') || '';
  const looksJson = (s: string) => /^[\s]*[{\[]/.test(s);

  // Se o servidor informou JSON, usa res.json(); senão, tenta parsear manualmente se “parece” JSON
  if (ct.includes('application/json')) {
    let data: any;
    try {
      data = await res.json();
    } catch {
      if (!res.ok) {
        if (isAreasByUnit) reqThrottle.reset(url);
        throw { status: res.status, error: { message: 'Erro na resposta da API' } };
      }
      handleWriteInvalidation(path, method);
      if (isAreasByUnit) reqThrottle.reset(url);
      return undefined;
    }

    if (res.status === 429 && isAreasByUnit) {
      reqThrottle.tooManyUntil.set(url, Date.now() + 2000);
    } else if (isAreasByUnit) {
      reqThrottle.reset(url);
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) handleAuthExpiry(data);
      throw { status: res.status, ...(typeof data === 'object' ? data : { error: String(data) }) };
    }

    handleWriteInvalidation(path, method);
    return data;
  } else {
    // Texto/binário (com fallback para JSON mal tipado)
    const raw = await res.text();
    const parsed = looksJson(raw) ? (JSON.parse(raw) as any) : raw;

    if (res.status === 429 && isAreasByUnit) {
      reqThrottle.tooManyUntil.set(url, Date.now() + 2000);
    } else if (isAreasByUnit) {
      reqThrottle.reset(url);
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) handleAuthExpiry(parsed);
      // mantém forma parecida com ramo JSON
      const errMsg = typeof parsed === 'string' ? parsed : (parsed?.error || parsed?.message || 'Erro');
      throw { status: res.status, error: errMsg };
    }

    handleWriteInvalidation(path, method);
    return parsed;
  }
}

/* ---------------- log útil em runtime ---------------- */
if (typeof window !== 'undefined') {
  if (BASE_URL) {
    console.info('[api] Base URL:', BASE_URL);
  } else {
    console.warn('[api] Sem BASE_URL definida; usando chamadas relativas.');
  }
}
