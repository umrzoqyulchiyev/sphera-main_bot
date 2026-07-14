import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { API_URL } from '../../lib/config';
import { authHeaders } from '../../lib/auth';
import { useTranslation } from '../../hooks/useTranslation';

interface GoLiveButtonProps {
  city: string;
  onToast: (message: string) => void;
}

const fmtRemaining = (sec: number) =>
  `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

export function GoLiveButton({ city, onToast }: GoLiveButtonProps) {
  const { t } = useTranslation();
  const [isLive, setIsLive] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Chunk'larni ketma-ket (navbat bilan) yuborish uchun — HTTP orqali tartib buzilmasligi kerak
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());
  const liveRef = useRef(false);
  const expiresAtRef = useRef<number | null>(null); // Date.now() timestamp (ms)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setRemainingSec(null);
    expiresAtRef.current = null;
  };

  const startCountdown = (expiresAtIso: string) => {
    expiresAtRef.current = new Date(expiresAtIso).getTime();
    const tick = () => {
      if (!expiresAtRef.current) return;
      const left = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        onToast('⏱ ' + t('slot_time_over'));
        stopBroadcast();
      }
    };
    tick();
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(tick, 1000);
  };

  useEffect(() => stopCountdown, []);

  const toggleLive = async () => {
    if (isLive) {
      await stopBroadcast();
      return;
    }

    try {
      // Telegram WebApp da mikrofon ruxsati so'rash (WebView'da getUserMedia'dan oldin kerak).
      // Ba'zi Android Telegram versiyalarida callback umuman chaqirilmaydi — shu sabab
      // timeout bilan "race" qilamiz, aks holda funksiya abadiy osilib qoladi (hech qanday
      // toast ko'rinmaydi, tugma "ishlamayapti"ga o'xshab qoladi).
      const tgApp = (window as any).Telegram?.WebApp;
      if (tgApp?.requestMicrophoneAccess) {
        const granted: boolean = await Promise.race([
          new Promise<boolean>(resolve => {
            tgApp.requestMicrophoneAccess((ok: boolean) => resolve(ok));
          }),
          new Promise<boolean>(resolve => setTimeout(() => resolve(true), 5000)),
        ]);
        if (!granted) {
          onToast(t('toast_mic_denied'));
          return;
        }
      }

      const resp = await fetch(`${API_URL}/radio/${city}/broadcast/start`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!resp.ok) {
        onToast(t('send_error'));
        return;
      }
      const data = await resp.json();
      if (data.status === 'busy') {
        onToast('⚠️ Broadcast busy');
        return;
      }
      if (data.status === 'unavailable') {
        onToast('🔇 MediaMTX required');
        return;
      }
      if (data.status === 'no_slot') {
        onToast('🚫 ' + t('no_active_slot'));
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      liveRef.current = true;
      setIsLive(true);
      onToast('🔴 LIVE!');
      startRecorder(stream);
      if (data.expires_at) startCountdown(data.expires_at);
    } catch (err: any) {
      console.error('[GoLive] setup error:', err?.name, err?.message);
      onToast(t('toast_mic_denied'));
    }
  };

  const sendChunk = (blob: Blob) => {
    // Har bir chunk oldingisi tugagandan keyin yuboriladi — tartib saqlanadi
    sendChainRef.current = sendChainRef.current
      .then(async () => {
        if (!liveRef.current) return;
        const buf = await blob.arrayBuffer();
        const resp = await fetch(`${API_URL}/radio/${city}/broadcast/chunk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', ...authHeaders() },
          body: buf,
        });
        if (!resp.ok && liveRef.current) {
          onToast(t('send_error'));
          await stopBroadcast();
        }
      })
      .catch(() => {});
  };

  const startRecorder = (stream: MediaStream) => {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sendChunk(e.data);
      };
      recorder.start(500);
    } catch {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sendChunk(e.data);
      };
      recorder.start(500);
    }
  };

  const stopBroadcast = async () => {
    liveRef.current = false;
    setIsLive(false);
    stopCountdown();
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    recorderRef.current = null;
    streamRef.current = null;
    try {
      await fetch(`${API_URL}/radio/${city}/broadcast/stop`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch {}
  };

  // Muddat tugashiga 1 daqiqadan kam qolganda — ogohlantirish rangi
  const isEndingSoon = remainingSec !== null && remainingSec <= 60;

  return (
    <button
      onClick={toggleLive}
      className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
        isLive
          ? 'bg-[#ff4d6d] text-white'
          : 'glass border-[rgba(255,77,109,0.3)] text-[#ff9fb0] hover:border-[rgba(255,77,109,0.5)]'
      }`}
      style={
        isLive
          ? { animation: isEndingSoon ? 'liveGlow 0.8s ease-in-out infinite' : 'liveGlow 1.6s ease-in-out infinite' }
          : {}
      }
    >
      <Radio className="w-4 h-4" strokeWidth={2} />
      {isLive ? t('end_live') : t('go_live')}
      {isLive && remainingSec !== null && (
        <span className="tabular-nums font-black ml-1" style={{ opacity: 0.9 }}>
          · {fmtRemaining(remainingSec)}
        </span>
      )}
    </button>
  );
}
