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

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/chat/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      onOpen?.();

      // Clear any existing ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Ping every 30s to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        onMessage?.(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed, reconnecting in 3s...');
      onClose?.();
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };
  }, [city, onMessage, onOpen, onClose, onError]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send, isConnected: wsRef.current?.readyState === WebSocket.OPEN };
}
