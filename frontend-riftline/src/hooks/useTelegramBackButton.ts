import { useEffect, useRef } from 'react';
import { getTelegram } from '../lib/config';

// Telegram'ning o'z tabiiy "orqaga" tugmasi — DOM ichidagi tugmalardan
// farqli o'laroq, uni Telegram'ning o'zi chizadi va boshqaradi, shuning
// uchun ilova tepasidagi native "Закрыть"/menyu paneli bilan hech qachon
// to'qnashmaydi (bosilishi doim kafolatlangan). Eski klient versiyalarida
// BackButton umuman bo'lmasligi mumkin — shu holda funksiya jim o'tkazib
// yuboradi, chaqiruvchi ekran o'zining DOM tugmasiga (fallback) tayanadi.
//
// MUAMMO (topilgan): tg.BackButton — BITTA global obyekt, lekin ilovada
// bir vaqtning o'zida bir nechta ekran/modal mustaqil ravishda shu hook'ni
// chaqirishi mumkin (masalan Radio ekrani ичида chat, uning ичида yana
// modal). Har biri o'z show()/hide()'sini mustaqil chaqirsa — ICHKI
// consumer unmount bo'lganda (yoki foydalanuvchi ekranlar orasida tez-tez
// almashganda, effektlar tartibsiz ishga tushganda) uning cleanup'i
// tugmani UMUMAN yashirib qo'yadi, garchi TASHQI ekran hali ham uni
// ko'rsatishni xohlasa ham. Tugma yashirilganda Telegram odatiy holda
// orqaga bosilganda MINI APP'NI BUTUNLAY YOPADI — shu sabab foydalanuvchi
// "orqaga tugmasi ilovani yopib qo'yayapti" deb his qilgan (ayniqsa admin
// panelda, u yerda ekranlar/modallar ko'proq — tugma holati chalkashishiga
// ko'proq imkoniyat).
//
// YECHIM: global "stack" — faqat eng tepadagi (oxirgi faollashgan)
// so'rovchining callback'i haqiqiy Telegram tugmasiga ulanadi. U
// (deactivate/unmount) bo'lganda avtomatik pastdagi consumer'ga qaytamiz;
// stack butunlay bo'shasa — tugma haqiqatan ham yashiriladi.
interface StackEntry {
  id: number;
  onBack: () => void;
}

let stack: StackEntry[] = [];
let nextId = 1;
let registeredHandler: (() => void) | null = null;

function syncNativeButton() {
  const tg = getTelegram();
  const btn = tg?.BackButton;
  if (!btn?.show) return;

  // Avval eskisini olib tashlaymiz — Telegram onClick() har chaqirilganda
  // qo'shimcha listener sifatida qo'shilishi mumkin (offClick bilan aniq
  // o'sha funksiya bo'yicha o'chiriladi), shu sabab bir vaqtda faqat BITTA
  // handler ro'yxatdan o'tgan bo'lishi kerak — aks holda ikkita ekran bir
  // vaqtda faol bo'lsa, orqaga bosilganda IKKALASI HAM ishga tushib,
  // kutilmagan navigatsiyaga olib keladi.
  if (registeredHandler) {
    try { btn.offClick(registeredHandler); } catch { /* noop */ }
    registeredHandler = null;
  }

  if (stack.length === 0) {
    try { btn.hide(); } catch { /* noop */ }
    return;
  }

  const top = stack[stack.length - 1];
  registeredHandler = top.onBack;
  try {
    btn.onClick(top.onBack);
    btn.show();
  } catch { /* eski versiya — BackButton mavjud emas */ }
}

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

    const id = nextId++;
    const entry: StackEntry = { id, onBack: () => cbRef.current() };
    stack.push(entry);
    syncNativeButton();

    return () => {
      stack = stack.filter((e) => e.id !== id);
      syncNativeButton();
    };
  }, [active]);
}
