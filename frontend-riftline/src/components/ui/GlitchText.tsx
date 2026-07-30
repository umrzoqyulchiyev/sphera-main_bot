import { useEffect, useRef, useState } from 'react';
import { hapticImpact } from '../../lib/telegram';

interface GlitchTextProps {
  text: string;
  tag?: 'h1' | 'h2' | 'h3' | 'span' | 'div';
  className?: string;
}

// Хроматическая аберрация на заголовке — в покое лёгкий несведённый
// смаз (см. .rift-glitch в index.css), при наведении/появлении в
// вьюпорте — короткий (160ms) RGB-джиттер через .jitter, который сам
// снимается по окончании CSS-анимации. prefers-reduced-motion —
// джиттер вообще не запускаем (сам .rift-glitch::before/after остаются
// статичными, это не анимация, а просто смещённый слой).
export function GlitchText({ text, tag = 'h2', className = '' }: GlitchTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [jitter, setJitter] = useState(false);
  const firedRef = useRef(false);

  const fire = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setJitter(true);
    hapticImpact('light');
    window.setTimeout(() => setJitter(false), 180);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || firedRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            fire();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = tag as any;
  return (
    <Tag
      ref={ref}
      data-text={text}
      onMouseEnter={fire}
      className={`rift-glitch ${jitter ? 'jitter' : ''} ${className}`}
    >
      {text}
    </Tag>
  );
}
