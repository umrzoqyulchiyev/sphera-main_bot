import { Radio, Pause, Play } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface SlotHint {
  ready: boolean;
  text: string;
}

interface GoLiveButtonProps {
  isLive: boolean;
  remainingSec: number | null;
  onToggle: () => void;
  // Efirni vaqtincha to'xtatish (mikrofonni jim qilish, sessiya ochiq
  // qoladi) — masalan vediushiy bir necha daqiqaga chetlashsa.
  isPaused?: boolean;
  onTogglePause?: () => void;
  // Vediushiyning eng dolzarb bron qilingan sloti — hali efirga
  // chiqmagan bo'lsa ham, "bron qilinganmi yo'qmi" tushunarli bo'lsin.
  slot?: SlotHint | null;
}

const fmtRemaining = (sec: number) =>
  `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

// Holat (isLive, MediaRecorder, stream) Radio.tsx darajasidagi
// useLiveBroadcast hook'ida saqlanadi — shu komponent faqat ko'rsatadi,
// shuning uchun boshqa ekranga o'tib qaytish efirni to'xtatib qo'ymaydi.
export function GoLiveButton({ isLive, remainingSec, onToggle, isPaused, onTogglePause, slot }: GoLiveButtonProps) {
  const { t } = useTranslation();
  const isEndingSoon = remainingSec !== null && remainingSec <= 60;
  const hasSlot = !isLive && !!slot;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 items-center">
        {isLive && onTogglePause && (
          <button
            onClick={onTogglePause}
            aria-label={isPaused ? 'resume' : 'pause'}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-[0.95]"
            style={{
              background: isPaused ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.1)',
              border: `1px solid ${isPaused ? 'rgba(34,197,94,0.4)' : 'rgba(148,163,184,0.16)'}`,
              color: isPaused ? '#4ADE80' : '#94A3B8',
            }}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" fill="currentColor" /> : <Pause className="w-3.5 h-3.5" fill="currentColor" />}
          </button>
        )}
        <button
          onClick={onToggle}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
            isLive
              ? 'bg-[#EF4444] text-white'
              : hasSlot
              ? 'glass border-[rgba(34,197,94,0.4)] text-[#4ADE80] hover:border-[rgba(34,197,94,0.6)]'
              : 'glass border-[rgba(239,68,68,0.3)] text-[#FCA5A5] hover:border-[rgba(239,68,68,0.5)]'
          }`}
          style={
            isLive
              ? (isPaused ? {} : { animation: isEndingSoon ? 'liveGlow 0.8s ease-in-out infinite' : 'liveGlow 1.6s ease-in-out infinite' })
              : (hasSlot && slot!.ready ? { animation: 'liveGlowGreen 1.6s ease-in-out infinite' } : {})
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
      </div>

      {isLive && isPaused && (
        <div className="text-center text-[11px] font-semibold text-[#94A3B8]">
          ⏸ {t('broadcast_paused')}
        </div>
      )}
      {!isLive && slot && (
        <div className="text-center text-[11px] font-medium text-[#4ADE80]">
          {slot.text}
        </div>
      )}
    </div>
  );
}
