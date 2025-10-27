import React, { useEffect, useState } from 'react';
import { subscribeToast, type ToastItem, removeToast } from './toast';

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToast((t) => {
      setItems((prev) => [...prev, t]);
      const ms = t.duration ?? 3000;
      const timer = setTimeout(() => removeToast(t.id), ms);
      return () => clearTimeout(timer);
    }, (next) => setItems(next));
  }, []);

  return (
    <div className="fixed z-[70] top-4 right-4 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            'card px-4 py-3 shadow-soft min-w-[260px] max-w-[340px] border',
            t.type === 'success' ? 'border-[#10b981] bg-[#ecfdf5]' :
            t.type === 'error'   ? 'border-[#ef4444] bg-[#fef2f2]' :
                                   'border-[#3b82f6] bg-[#eef2ff]'
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="mt-[2px]">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            <div className="text-sm text-text/90">{t.message}</div>
            <button
              className="ml-auto btn btn-ghost btn-sm"
              onClick={() => removeToast(t.id)}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
