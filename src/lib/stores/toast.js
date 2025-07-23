import { writable } from 'svelte/store';

// Toast notification store
const createToastStore = () => {
  const { subscribe, update } = writable([]);

  let toastId = 0;

  const addToast = (message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    const toast = {
      id,
      message,
      type,
      timestamp: Date.now(),
    };

    update(toasts => [...toasts, toast]);

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    update(toasts => toasts.filter(toast => toast.id !== id));
  };

  const clearAll = () => {
    update(() => []);
  };

  return {
    subscribe,
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    remove: removeToast,
    clear: clearAll,
  };
};

export const toastStore = createToastStore();