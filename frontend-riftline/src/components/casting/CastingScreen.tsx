import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Sparkles, Clock, XCircle, Radio, FileText, Loader, Play } from 'lucide-react';
import { getCastingStatus, applyCasting, type CastingStatus } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../ui/Toast';

const STEPS = [
  { icon: FileText, title: 'Заявка', text: 'Коротко расскажите о себе в голосовом' },
  { icon: Mic, title: 'Аудишен', text: 'Запишите пробное выступление в эфире' },
  { icon: Sparkles, title: 'Модерация', text: 'Команда прослушает и примет решение' },
];

export function CastingScreen() {
  const { message, variant: toastVariant, showToast } = useToast();
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
          showToast('Микрофон рұқсаты берілмеді', 'error');
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
          showToast('Запись слишком короткая', 'error');
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
        showToast('Микрофон рұқсаты жоқ. Telegram → Настройки → Конфиденциальность → Микрофон', 'error');
      } else {
        showToast('Микрофонга қол жетімді емес', 'error');
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
      showToast(e?.message || 'Ошибка отправки', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="rift-zone-u1 flex flex-col items-center justify-center py-16 gap-4">
        <Loader className="w-9 h-9 text-[#E0263A] animate-spin" />
        <p className="text-xs text-[#6b5f4f] tracking-widest uppercase">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="rift-zone-u1 flex flex-col gap-4">
      {/* Header */}
      <div className="text-center pt-1 pb-1">
        <div className="text-[11px] font-semibold tracking-[3px] text-[#6b5f4f] uppercase mb-1">
          Отбор ведущих
        </div>
        <div className="text-[22px] font-black text-[#1A1310] uppercase tracking-wide logo-gradient">
          Кастинг
        </div>
        <p className="text-[12px] text-[#6b5f4f] mt-1.5 leading-relaxed px-2">
          Пройдите отбор и получите право вести собственный прямой эфир
        </p>
      </div>

      {/* Already host */}
      {status?.already_doverenniy && (
        <div className="stitch-card-bordered rounded-[24px] p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(28,63,214,0.2), transparent 70%)' }}>
            <Radio className="w-8 h-8 text-[#1C3FD6]" />
          </div>
          <div className="text-sm font-bold text-[#1A1310]">Вы уже ведущий</div>
          <p className="text-[11px] text-[#6b5f4f] leading-relaxed">
            У вас есть право выходить в прямой эфир — откройте «Поток Real Time» и нажмите «В эфир».
          </p>
        </div>
      )}

      {/* Pending */}
      {!status?.already_doverenniy && status?.applied && status.status === 'pending' && (
        <div className="stitch-card-bordered rounded-[24px] p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.2), transparent 70%)' }}>
            <Clock className="w-8 h-8 text-[#1C3FD6]" />
          </div>
          <div className="text-sm font-bold text-[#1A1310]">Заявка на рассмотрении</div>
          <p className="text-[11px] text-[#6b5f4f] leading-relaxed">
            Мы прослушали вашу запись и скоро примем решение. Загляните сюда позже.
          </p>
        </div>
      )}

      {/* Rejected — allow re-apply */}
      {!status?.already_doverenniy && status?.applied && status.status === 'rejected' && (
        <div className="glass rounded-[24px] p-5 space-y-2"
          style={{ border: '1px solid rgba(224,38,58,0.25)' }}>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-[#E0263A]" />
            <span className="text-sm font-bold text-[#1A1310]">Заявка отклонена</span>
          </div>
          {status.admin_note && (
            <p className="text-[11px] text-[#6b5f4f] leading-relaxed">{status.admin_note}</p>
          )}
          <p className="text-[11px] text-[#6b5f4f] leading-relaxed">Вы можете попробовать ещё раз.</p>
        </div>
      )}

      {/* Odatda ariza tasdiqlansa role='doverenniy' bo'lib qoladi va
          already_doverenniy=true'ga tushadi — lekin admin keyinchalik
          darajani pasaytirib qo'ysa (level 1/2'ga), role o'zgaradi-yu,
          eski ariza yozuvi hali ham status='approved' bo'lib qoladi. Bu
          holat quyidagi 3 blokning hech biriga tushmay, ekran butunlay
          bo'sh ko'rinardi ("нельзя записаться" xabarining aslida shu edi). */}
      {!status?.already_doverenniy && status?.applied && status.status === 'approved' && (
        <div className="glass rounded-[24px] p-5 space-y-2"
          style={{ border: '1px solid rgba(26,19,16,0.2)' }}>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-[#6b5f4f]" />
            <span className="text-sm font-bold text-[#1A1310]">Право на эфир отозвано</span>
          </div>
          <p className="text-[11px] text-[#6b5f4f] leading-relaxed">
            Ранее заявка была одобрена, но статус ведущего был снят администратором. Вы можете подать заявку заново.
          </p>
        </div>
      )}

      {/* Apply form — ko'rsatiladi: hali ariza bo'lmagan, rad etilgan yoki
          tasdiqlangan-u keyin huquq olib qo'yilgan bo'lsa. Faqat "ko'rib
          chiqilmoqda" (pending) holatidagina yashiriladi. */}
      {!status?.already_doverenniy && !(status?.applied && status.status === 'pending') && (
        <>
          {/* Steps */}
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <div key={i} className="stitch-card rounded-2xl p-3 flex flex-col items-center text-center gap-1.5">
                <s.icon className="w-4 h-4 text-[#E0263A]" strokeWidth={1.8} />
                <div className="text-[9px] font-bold text-[#1A1310] uppercase tracking-wide">{s.title}</div>
                <div className="text-[8.5px] text-[#6b5f4f] leading-tight">{s.text}</div>
              </div>
            ))}
          </div>

          {/* Recording card */}
          <div className="glass rounded-[24px] p-5 space-y-4">
            <div className="text-[10px] font-bold tracking-[2px] text-[#6b5f4f] uppercase">
              Голосовое аудишен
            </div>

            {pendingBlob && previewUrl ? (
              <div className="rounded-2xl px-3 py-3 flex items-center gap-3"
                style={{ background: 'rgba(255,251,240,0.9)', border: '1px solid rgba(26,19,16,0.16)' }}>
                <button onClick={playPreview}
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center active:scale-90"
                  style={{ background: 'linear-gradient(135deg,#ff4f63,#E0263A)' }}>
                  <Play className="w-3.5 h-3.5 ml-0.5" fill="#F5EEDC" color="#F5EEDC" />
                </button>
                <div className="flex-1 flex items-center gap-[2px]" style={{ height: '20px' }}>
                  {[3, 6, 9, 6, 11, 7, 13, 9, 14, 10, 12, 8, 10, 6, 7, 4, 5].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}px`, background: 'rgba(224,38,58,0.5)', borderRadius: '2px' }} />
                  ))}
                </div>
                <button onClick={discardRecording}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:scale-90"
                  style={{ background: 'rgba(224,38,58,0.15)', border: '1px solid rgba(224,38,58,0.3)' }}>
                  <XCircle className="w-4 h-4 text-[#E0263A]" />
                </button>
              </div>
            ) : (
              <button
                onClick={toggleRecording}
                className="w-full rounded-2xl py-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                style={{
                  background: recording ? 'rgba(224,38,58,0.1)' : 'rgba(255,251,240,0.7)',
                  border: recording ? '1px solid rgba(224,38,58,0.4)' : '1px solid rgba(224,38,58,0.2)',
                  boxShadow: recording ? '0 0 20px rgba(224,38,58,0.25)' : '0 0 20px rgba(224,38,58,0.1)',
                }}
              >
                <svg width="18" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  strokeWidth={1.8} style={{ color: recording ? '#E0263A' : '#E0263A' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
                {recording ? (
                  <span className="text-sm font-bold text-[#E0263A] tabular-nums flex items-center gap-2">
                    <span className="relative w-2 h-2 shrink-0">
                      <span className="rift-rec-pulse absolute inset-0 rounded-full bg-[#E0263A]" />
                      <span className="absolute inset-0 rounded-full bg-[#E0263A]" />
                    </span>
                    {fmtSec(recSeconds)} · нажмите, чтобы остановить
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-[#E0263A]">Записать аудишен</span>
                )}
              </button>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Пара слов о себе (необязательно)..."
              rows={3}
              maxLength={500}
              className="rift-input-torn w-full px-3 py-2.5 text-sm text-[#1A1310] resize-none outline-none placeholder:text-[#6b5f4f]"
              style={{ background: 'rgba(255,251,240,0.6)' }}
            />

            <button
              onClick={submit}
              disabled={!pendingBlob || submitting}
              className="w-full h-12 rounded-xl text-sm font-bold text-[#F5EEDC] active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#ff4f63,#E0263A)', boxShadow: '0 4px 14px rgba(224,38,58,0.25)' }}
            >
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Отправить заявку'}
            </button>
          </div>
        </>
      )}

      <Toast message={message} variant={toastVariant} />
    </div>
  );
}
