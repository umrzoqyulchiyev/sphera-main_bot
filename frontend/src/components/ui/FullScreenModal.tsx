import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface FullScreenModalProps {
  children: ReactNode;
  zIndex?: number;
  background?: string;
}

// To'liq ekranli modallar (efir chat, guruhlar) uchun umumiy wrapper.
//
// Muammo: `.glass` klassi `backdrop-filter` ishlatadi, bu esa CSS
// spetsifikatsiyasiga ko'ra shu elementni ichidagi `position: fixed`
// bolalar uchun yangi "containing block" qiladi — natijada modal endi
// haqiqiy viewport'ga emas, balki shu glass kartaga nisbatan joylashadi
// va uning stacking context'i ichida qamalib qoladi (z-index qancha
// baland bo'lmasin, BottomNav kabi tashqi elementlar ustidan chiqolmaydi,
// desktop'da esa kartaning kengligiga qarab noto'g'ri o'lchamda chiqadi).
//
// Yechim: React Portal orqali to'g'ridan-to'g'ri <body>'ga chiqaramiz —
// shunda ota-komponentlarning stacking context/containing-block
// muammolaridan butunlay qochamiz, va ichini ilovaning umumiy
// max-width kartasi bilan bir xil kenglikka cheklaymiz (desktop'da
// butun ekranga cho'zilib ketmasin).
export function FullScreenModal({ children, zIndex = 9999, background = '#050506' }: FullScreenModalProps) {
  return createPortal(
    <div
      className="fixed flex flex-col"
      style={{ top: 0, left: 0, right: 0, bottom: 0, background, zIndex, isolation: 'isolate' }}
    >
      <div className="w-full max-w-[460px] sm:max-w-[480px] lg:max-w-[520px] mx-auto flex flex-col flex-1 min-h-0">
        {children}
      </div>
    </div>,
    document.body
  );
}
