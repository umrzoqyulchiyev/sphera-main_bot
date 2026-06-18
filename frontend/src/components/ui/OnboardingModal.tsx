import { Headphones, MessageSquare, Mic } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const steps = [
    { icon: Headphones, text: t('onb_1') },
    { icon: MessageSquare, text: t('onb_2') },
    { icon: Mic, text: t('onb_3') },
  ];

  return (
    <div className="fixed inset-0 bg-[rgba(3,7,16,0.85)] backdrop-blur-sm flex items-center justify-center z-[3000] p-5">
      <div className="w-full max-w-[380px] glass rounded-3xl p-7 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-[radial-gradient(circle,rgba(56,225,255,0.08),transparent_70%)] pointer-events-none" />

        <div className="relative text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[rgba(56,225,255,0.1)] flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-8 h-8 text-[#38e1ff]" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-[#dbe9ff] mb-5">
            {t('onb_title')}
          </h2>

          {/* Steps */}
          <div className="flex flex-col gap-3.5 text-left mb-6">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 glass rounded-xl p-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(56,225,255,0.08)] flex items-center justify-center shrink-0">
                  <step.icon className="w-4.5 h-4.5 text-[#38e1ff]" strokeWidth={1.8} />
                </div>
                <span className="text-sm text-[#dbe9ff] leading-snug">{step.text}</span>
              </div>
            ))}
          </div>

          {/* Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-[#060a14] transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #2ea8ff, #38e1ff)',
              boxShadow: '0 0 24px rgba(56,225,255,0.4)',
            }}
          >
            {t('onb_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
