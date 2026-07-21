import { Radio } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface GoLiveButtonProps {
  isLive: boolean;
  remainingSec: number | null;
  onToggle: () => void;
}

const fmtRemaining = (sec: number) =>
  `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

// Holat (isLive, MediaRecorder, stream) Radio.tsx darajasidagi
// useLiveBroadcast hook'ida saqlanadi — shu komponent faqat ko'rsatadi,
// shuning uchun boshqa ekranga o'tib qaytish efirni to'xtatib qo'ymaydi.
export function GoLiveButton({ isLive, remainingSec, onToggle }: GoLiveButtonProps) {
  const { t } = useTranslation();
  const isEndingSoon = remainingSec !== null && remainingSec <= 60;

  return (
    <button
      onClick={onToggle}
      className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
        isLive
          ? 'bg-[#EF4444] text-white'
          : 'glass border-[rgba(239,68,68,0.3)] text-[#FCA5A5] hover:border-[rgba(239,68,68,0.5)]'
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
