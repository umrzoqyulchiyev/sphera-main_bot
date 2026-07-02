import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/config';
import { getToken } from '../lib/auth';
import type { WSMessage } from '../types';

interface UseWebSocketOptions {
  city: string;
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({ city, onMessage, onOpen, onClose, onError }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const isClosingRef = useRef(false);

  // Callback'larni ref orqali saqlash — bu ularni useCallback dependency'lariga
  // qo'shmaslik imkonini beradi, ya'ni render bo'lsa ham WS qayta ulanmaydi.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    // Avvalgi ulanishni tozalaymiz
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      isClosingRef.current = true;
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/chat/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      isClosingRef.current = false;
      console.log('WebSocket connected');
      onOpenRef.current?.();

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        onMessageRef.current?.(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      onCloseRef.current?.();

      // Agar biz o'zimiz yopgan bo'lsak (intentional) — qayta ulanmaymiz
      if (isClosingRef.current) {
        isClosingRef.current = false;
        return;
      }

      console.log('WebSocket closed, reconnecting in 3s...');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onErrorRef.current?.(error);
    };
  }, [city]); // faqat city o'zgarganda qayta ulanadi

  useEffect(() => {
    connect();

    return () => {
      isClosingRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((data: any): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { send, isConnected: wsRef.current?.readyState === WebSocket.OPEN };
}
