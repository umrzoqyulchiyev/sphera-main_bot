import { useEffect, useRef } from 'react';
import { getTelegram } from '../lib/config';

// Telegram'ning o'z tabiiy "orqaga" tugmasi — DOM ichidagi tugmalardan
// farqli o'laroq, uni Telegram'ning o'zi chizadi va boshqaradi, shuning
// uchun ilova tepasidagi native "Закрыть"/menyu paneli bilan hech qachon
// to'qnashmaydi (bosilishi doim kafolatlangan). Eski klient versiyalarida
// BackButton umuman bo'lmasligi mumkin — shu holda funksiya jim o'tkazib
// yuboradi, chaqiruvchi ekran o'zining DOM tugmasiga (fallback) tayanadi.
export function useTelegramBackButton(active: boolean, onBack: () => void) {
  const cbRef = useRef(onBack);
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) return;
    const tg = getTelegram();
    const btn = tg?.BackButton;
    if (!btn?.show) return;

    const handler = () => cbRef.current();
    try {
      btn.onClick(handler);
      btn.show();
    } catch {
      /* eski versiya — BackButton mavjud emas */
    }

    return () => {
      try {
        btn.offClick(handler);
        btn.hide();
      } catch {
        /* eski versiya */
      }
    };
  }, [active]);
}
