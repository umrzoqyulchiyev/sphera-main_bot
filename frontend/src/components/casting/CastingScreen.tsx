import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Sparkles, Clock, XCircle, Radio, FileText, Loader } from 'lucide-react';
import { getCastingStatus, applyCasting, type CastingStatus } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../ui/Toast';

const STEPS = [
  { icon: FileText, title: 'Заявка', text: 'Коротко расскажите о себе в голосовом' },
  { icon: Mic, title: 'Аудишен', text: 'Запишите пробное выступление в эфире' },
  { icon: Sparkles, title: 'Модерация', text: 'Команда прослушает и примет решение' },
];

export function CastingScreen() {
  const { message, showToast } = useToast();
  const [status, setStatus] = useState<CastingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(() => {
    setLoading(true);
    getCastingStatus()
      .then(setStatus)
      .catch(() => setStatus({ applied: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadStatus]);

  const toggleRecording = async () => {
    if (recording && recRef.current) {
      recRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      return;
    }
    try {
      const tgApp = (window as any).Telegram?.WebApp;
      if (tgApp?.requestMicrophoneAccess) {
        const granted: boolean = await Promise.race([
          new Promise<boolean>((resolve) => tgApp.requestMicrophoneAccess((ok: boolean) => resolve(ok))),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 5000)),
        ]);
        if (!granted) {
          showToast('Микрофон рұқсаты берілмеді');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 800) {
          showToast('Запись слишком короткая');
          setRecSeconds(0);
          return;
        }
        setPendingBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecSeconds(0);
      };
      mr.start(100);
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      console.error('Mic error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        showToast('Микрофон рұқсаты жоқ. Telegram → Настройки → Конфиденциальность → Микрофон');
      } else {
        showToast('Микрофонга қол жетімді емес');
      }
    }
  };

  const discardRecording = () => {
    setPendingBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecSeconds(0);
  };

  const playPreview = () => {
    if (previewUrl) new Audio(previewUrl).play().catch(() => {});
  };

  const submit = async () => {
    if (!pendingBlob || submitting) return;
    setSubmitting(true);
    try {
      await applyCasting(pendingBlob, note.trim());
      showToast('Заявка отправлена ✅');
      discardRecording();
      setNote('');
      loadStatus();
    } catch (e: any) {
      showToast(e?.message || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader className="w-9 h-9 text-[#5e6ad2] animate-spin" />
        <p className="text-xs text-[#8a8f98] tracking-widest uppercase">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="text-center pt-1 pb-1">
        <div className="text-[11px] font-semibold tracking-[3px] text-[#8a8f98] uppercase mb-1">
          Отбор ведущих
        </div>
        <div className="text-[22px] font-black text-[#ededef] uppercase tracking-wide logo-gradient">
          Кастинг
        </div>
        <p className="text-[12px] text-[#8a8f98] mt-1.5 leading-relaxed px-2">
          Пройдите отбор и получите право вести собственный прямой эфир
        </p>
      </div>

      {/* Already host */}
      {status?.already_doverenniy && (
        <div className="stitch-card-bordered rounded-[24px] p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(34,227,165,0.2), transparent 70%)' }}>
            <Radio className="w-8 h-8 text-[#22e3a5]" />
          </div>
          <div className="text-sm font-bold text-[#ededef]">Вы уже ведущий</div>
          <p className="text-[11px] text-[#8a8f98] leading-relaxed">
            У вас есть право выходить в прямой эфир — откройте «Поток Real Time» и нажмите «В эфир».
          </p>
        </div>
      )}

      {/* Pending */}
      {!status?.already_doverenniy && status?.applied && status.status === 'pending' && (
        <div className="stitch-card-bordered rounded-[24px] p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.2), transparent 70%)' }}>
            <Clock className="w-8 h-8 text-[#f59e0b]" />
          </div>
          <div className="text-sm font-bold text-[#ededef]">Заявка на рассмотрении</div>
          <p className="text-[11px] text-[#8a8f98] leading-relaxed">
            Мы прослушали вашу запись и скоро примем решение. Загляните сюда позже.
          </p>
        </div>
      )}

      {/* Rejected — allow re-apply */}
      {!status?.already_doverenniy && status?.applied && status.status === 'rejected' && (
        <div className="glass rounded-[24px] p-5 space-y-2"
          style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-[#ff4d6d]" />
            <span className="text-sm font-bold text-[#ededef]">Заявка отклонена</span>
          </div>
          {status.admin_note && (
            <p className="text-[11px] text-[#8a8f98] leading-relaxed">{status.admin_note}</p>
          )}
          <p className="text-[11px] text-[#8a8f98] leading-relaxed">Вы можете попробовать ещё раз.</p>
        </div>
      )}

      {/* Apply form — shown when not applied, or previously rejected (re-apply) */}
      {!status?.already_doverenniy && (!status?.applied || status.status === 'rejected') && (
        <>
          {/* Steps */}
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <div key={i} className="stitch-card rounded-2xl p-3 flex flex-col items-center text-center gap-1.5">
                <s.icon className="w-4 h-4 text-[#5e6ad2]" strokeWidth={1.8} />
                <div className="text-[9px] font-bold text-[#ededef] uppercase tracking-wide">{s.title}</div>
                <div className="text-[8.5px] text-[#8a8f98] leading-tight">{s.text}</div>
              </div>
            ))}
          </div>

          {/* Recording card */}
          <div className="glass rounded-[24px] p-5 space-y-4">
            <div className="text-[10px] font-bold tracking-[2px] text-[#8a8f98] uppercase">
              Голосовое аудишен
            </div>

            {pendingBlob && previewUrl ? (
              <div className="rounded-2xl px-3 py-3 flex items-center gap-3"
                style={{ background: 'rgba(16,16,20,0.9)', border: '1px solid rgba(94,106,210,0.2)' }}>
                <button onClick={playPreview}
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center active:scale-90"
                  style={{ background: 'linear-gradient(135deg,#7b85e8,#5e6ad2)' }}>
                  <svg width="12" height="14" fill="#050506" viewBox="0 0 11 13" style={{ marginLeft: 2 }}>
                    <path d="M0 0 L11 6.5 L0 13 Z" />
                  </svg>
                </button>
                <div className="flex-1 flex items-center gap-[2px]" style={{ height: '20px' }}>
                  {[3, 6, 9, 6, 11, 7, 13, 9, 14, 10, 12, 8, 10, 6, 7, 4, 5].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}px`, background: 'rgba(94,106,210,0.5)', borderRadius: '2px' }} />
                  ))}
                </div>
                <button onClick={discardRecording}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:scale-90"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <XCircle className="w-4 h-4 text-[#ef4444]" />
                </button>
              </div>
            ) : (
              <button
                onClick={toggleRecording}
                className="w-full rounded-2xl py-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                style={{
                  background: recording ? 'rgba(239,68,68,0.1)' : 'rgba(14,14,18,0.7)',
                  border: recording ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(94,106,210,0.2)',
                  boxShadow: recording ? '0 0 20px rgba(239,68,68,0.25)' : '0 0 20px rgba(94,106,210,0.1)',
                }}
              >
                <svg width="18" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  strokeWidth={1.8} style={{ color: recording ? '#ef4444' : '#5e6ad2' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
                {recording ? (
                  <span className="text-sm font-bold text-[#ef4444] tabular-nums">{fmtSec(recSeconds)} · нажмите, чтобы остановить</span>
                ) : (
                  <span className="text-sm font-semibold text-[#5e6ad2]">Записать аудишен</span>
                )}
              </button>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Пара слов о себе (необязательно)..."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-[#ededef] resize-none outline-none placeholder:text-[#5a5f68]"
              style={{ background: 'rgba(5,5,6,0.6)', border: '1px solid rgba(94,106,210,0.15)' }}
            />

            <button
              onClick={submit}
              disabled={!pendingBlob || submitting}
              className="w-full h-12 rounded-xl text-sm font-bold text-[#050506] active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#7b85e8,#5e6ad2)', boxShadow: '0 0 25px rgba(94,106,210,0.4)' }}
            >
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Отправить заявку'}
            </button>
          </div>
        </>
      )}

      <Toast message={message} />
    </div>
  );
}
