import { Radio, Pause, Play } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { hapticNotify, hapticImpact } from '../../lib/telegram';

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

  // Haptic синхронизирован с самим переключением (глитч-момент старта/
  // стопа/паузы эфира) — просто оборачивает существующий колбэк, сама
  // логика (onToggle/onTogglePause) не меняется и не переопределяется.
  const handleToggle = () => {
    hapticNotify(isLive ? 'warning' : 'success');
    onToggle();
  };
  const handleTogglePause = () => {
    hapticImpact('medium');
    onTogglePause?.();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 items-center">
        {isLive && onTogglePause && (
          <button
            onClick={handleTogglePause}
            aria-label={isPaused ? 'resume' : 'pause'}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-[0.95]"
            style={{
              background: isPaused ? 'rgba(57,255,106,0.15)' : 'rgba(200,255,203,0.1)',
              border: `1px solid ${isPaused ? 'rgba(57,255,106,0.4)' : 'rgba(200,255,203,0.16)'}`,
              color: isPaused ? '#7dffa0' : '#6f9c72',
            }}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" fill="currentColor" /> : <Pause className="w-3.5 h-3.5" fill="currentColor" />}
          </button>
        )}
        <button
          onClick={handleToggle}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
            isLive
              ? 'bg-[#FF2FD0] text-white'
              : hasSlot
              ? 'glass border-[rgba(57,255,106,0.4)] text-[#7dffa0] hover:border-[rgba(57,255,106,0.6)]'
              : 'glass border-[rgba(255,47,208,0.3)] text-[#ff6ee0] hover:border-[rgba(255,47,208,0.5)]'
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
        <div className="text-center text-[11px] font-semibold text-[#6f9c72]">
          ⏸ {t('broadcast_paused')}
        </div>
      )}
      {!isLive && slot && (
        <div className="text-center text-[11px] font-medium text-[#7dffa0]">
          {slot.text}
        </div>
      )}
    </div>
  );
}
