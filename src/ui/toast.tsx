export type ToastKind = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastKind;
  message: string;
  duration?: number;
};

let counter = 1;
let items: ToastItem = [] as any; // will be array later
(items as any) = [];

const listeners = new Set<(list: ToastItem[]) => void>();
const showListeners = new Set<(t: ToastItem) => void>();

function emitList() {
  const snapshot = [...(items as ToastItem[])];
  listeners.forEach((fn) => fn(snapshot));
}

export function subscribeToast(
  onShow: (t: ToastItem) => void,
  onList?: (list: ToastItem[]) => void
) {
  showListeners.add(onShow);
  if (onList) listeners.add(onList);
  // initial list
  if (onList) onList([...(items as ToastItem[])]);
  return () => {
    showListeners.delete(onShow);
    if (onList) listeners.delete(onList);
  };
}

export function removeToast(id: number) {
  (items as ToastItem[]) = (items as ToastItem[]).filter((t) => t.id !== id);
  emitList();
}

function push(type: ToastKind, message: string, duration = 3000) {
  const t: ToastItem = { id: counter++, type, message, duration };
  (items as ToastItem[]).push(t);
  showListeners.forEach((fn) => fn(t));
  emitList();
  return t.id;
}

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error:   (message: string, duration?: number) => push('error',   message, duration),
  info:    (message: string, duration?: number) => push('info',    message, duration),
};
