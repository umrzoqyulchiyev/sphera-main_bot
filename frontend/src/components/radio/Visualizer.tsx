interface VisualizerProps {
  isPlaying: boolean;
  // Konteyner o'lchami (px) — standart 280, EfirScreen'da tinglovchilar
  // sonini tepasida ko'rsatish uchun kichikroq variant ishlatiladi.
  size?: number;
}

export function Visualizer({ isPlaying, size = 280 }: VisualizerProps) {
  // Oddiy waveform chiziqlari (rasmdagidek)
  const bars = [3, 5, 8, 12, 17, 24, 31, 37, 41, 37, 31, 24, 17, 12, 8, 5, 3];
  const scale = size / 280;
  const ringSize = Math.round(240 * scale);
  const waveW = Math.round(180 * scale);
  const waveH = Math.round(80 * scale);
  const barW = Math.max(3, Math.round(5 * scale));
  const gap = Math.max(2, Math.round(5 * scale));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>

      {/* Asosiy tashqi halqa (katta ko'k — rasmdagi) */}
      <div
        className="absolute"
        style={{
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          border: '2px solid #F97316',
          boxShadow: '0 0 16px rgba(249,115,22,0.4), inset 0 0 12px rgba(249,115,22,0.08)',
          animation: 'ringPulse 2.5s ease-in-out infinite',
        }}
      />

      {/* Waveform — markazda */}
      <div className="absolute flex items-center justify-center" style={{ width: waveW, height: waveH, gap }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              width: barW,
              height: `${Math.max(2, h * scale)}px`,
              background: 'linear-gradient(180deg, #ffffff 10%, #F97316 70%, #FB923C 100%)',
              borderRadius: '4px',
              boxShadow: '0 0 4px rgba(249,115,22,0.5)',
              animation: isPlaying ? `wave ${0.8 + (i % 2) * 0.2}s ease-in-out ${i * 0.08}s infinite` : 'none',
              opacity: isPlaying ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%       { transform: scale(1.02); opacity: 1; }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
          50%       { transform: scaleY(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
