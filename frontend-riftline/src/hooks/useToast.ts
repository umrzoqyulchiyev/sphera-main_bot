import { useState, useCallback } from 'react';
import { hapticNotify } from '../lib/telegram';

export type ToastVariant = 'info' | 'error';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>('info');
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, variant: ToastVariant = 'info', duration = 3500) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setMessage(text);
    setVariant(variant);
    if (variant === 'error') hapticNotify('error');

    const id = setTimeout(() => {
      setMessage(null);
    }, duration);

    setTimeoutId(id);
  }, [timeoutId]);

  const hideToast = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setMessage(null);
  }, [timeoutId]);

  return { message, variant, showToast, hideToast };
}
