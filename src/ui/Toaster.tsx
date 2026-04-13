import React, { useEffect, useRef, useState } from 'react';
import { subscribeToast, type ToastItem, removeToast } from './toast';

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unsub = subscribeToast(
      (t) => {
        setItems((prev) => [...prev, t]);

        const ms = typeof t.duration === 'number' ? t.duration : 3000;
        if (ms && ms > 0) {
          const timer = setTimeout(() => {
            timersRef.current.delete(t.id);
            removeToast(t.id);
          }, ms);
          timersRef.current.set(t.id, timer);
        }
      },
      (nextList) => {
        setItems(nextList);

        const keepIds = new Set(nextList.map((it) => it.id));
        for (const [id, timer] of timersRef.current.entries()) {
          if (!keepIds.has(id)) {
            clearTimeout(timer);
            timersRef.current.delete(id);
          }
        }
      }
    );

    return () => {
      unsub?.();
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  function handleClose(id: number) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    removeToast(id);
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              minWidth: 340,
              maxWidth: 480,
              padding: '1rem 1.5rem',
              borderRadius: '1rem',
              border: '2px solid',
              borderColor: t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : '#3b82f6',
              background: t.type === 'success' ? '#ecfdf5' : t.type === 'error' ? '#fef2f2' : '#eef2ff',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
              animation: 'toast-in .3s ease-out',
            }}
            role="status"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>
                {t.message}
              </div>
              <button
                onClick={() => handleClose(t.id)}
                aria-label="Fechar"
                title="Fechar"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.1rem', color: '#6b7280', padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
