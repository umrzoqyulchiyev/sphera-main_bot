import { useState, useRef } from 'react';
import { Radio } from 'lucide-react';
import { WS_URL } from '../../lib/config';
import { getToken } from '../../lib/auth';
import { useTranslation } from '../../hooks/useTranslation';

interface GoLiveButtonProps {
  city: string;
  onToast: (message: string) => void;
}

export function GoLiveButton({ city, onToast }: GoLiveButtonProps) {
  const { t } = useTranslation();
  const [isLive, setIsLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleLive = async () => {
    if (isLive) {
      stopBroadcast();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const token = getToken();
      const ws = new WebSocket(`${WS_URL}/radio/${city}/broadcast/ws?token=${encodeURIComponent(token || '')}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'broadcast_started') {
            setIsLive(true);
            onToast('🔴 LIVE!');
            startRecorder(stream, ws);
          } else if (msg.type === 'broadcast_busy') {
            onToast('⚠️ Broadcast busy');
            stopBroadcast();
          } else if (msg.type === 'broadcast_unavailable') {
            onToast('🔇 Icecast required');
            stopBroadcast();
          }
        } catch { /* binary */ }
      };

      ws.onclose = () => { if (isLive) stopBroadcast(); };
      ws.onerror = () => onToast(t('send_error'));
    } catch {
      onToast(t('toast_mic_denied'));
    }
  };

  const startRecorder = (stream: MediaStream, ws: WebSocket) => {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then((buf) => ws.send(buf));
        }
      };
      recorder.start(500);
    } catch {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.start(500);
    }
  };

  const stopBroadcast = () => {
    setIsLive(false);
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { wsRef.current?.readyState! <= WebSocket.OPEN && wsRef.current?.close(); } catch {}
    recorderRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
  };

  return (
    <button
      onClick={toggleLive}
      className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
        isLive
          ? 'bg-[#ff4d6d] text-white animate-pulse'
          : 'glass border-[rgba(255,77,109,0.3)] text-[#ff9fb0] hover:border-[rgba(255,77,109,0.5)]'
      }`}
      style={
        isLive
          ? { boxShadow: '0 0 24px rgba(255,77,109,0.4)' }
          : {}
      }
    >
      <Radio className="w-4 h-4" strokeWidth={2} />
      {isLive ? t('end_live') : t('go_live')}
    </button>
  );
}
