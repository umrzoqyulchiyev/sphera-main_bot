import { useState, useCallback } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, duration = 3500) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setMessage(text);

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

  return { message, showToast, hideToast };
}
