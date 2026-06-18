import { useEffect, useRef } from 'react';

interface AIOrbProps {
  isActive?: boolean;
  size?: number;
}

export function AIOrb({ isActive = false, size = 68 }: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = size * 0.35;
    
    let animationId: number;
    let frame = 0;

    // Gradient colors like Apple Siri
    const colors = [
      { r: 0, g: 217, b: 255 },    // Cyan
      { r: 138, g: 92, b: 246 },   // Purple
      { r: 236, g: 72, b: 153 },   // Pink
      { r: 251, g: 146, b: 60 },   // Orange
      { r: 34, g: 197, b: 94 },    // Green
    ];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame += 0.02;

      // Draw multiple animated wave layers
      for (let layer = 0; layer < 5; layer++) {
        const layerRadius = baseRadius + (layer * 8);
        const waveAmplitude = isActive ? 8 + layer * 2 : 3;
        const waveFrequency = 6 + layer;
        const opacity = isActive ? 0.6 - layer * 0.1 : 0.3 - layer * 0.05;

        ctx.beginPath();
        
        for (let angle = 0; angle <= Math.PI * 2; angle += 0.02) {
          const wave = Math.sin(angle * waveFrequency + frame + layer) * waveAmplitude;
          const radius = layerRadius + wave;
          
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();

        // Create gradient for each layer
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, layerRadius + 20
        );
        
        const color = colors[layer % colors.length];
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
        gradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Add glow
        ctx.shadowBlur = isActive ? 20 : 10;
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
      }

      // Core sphere
      const coreGradient = ctx.createRadialGradient(
        centerX, centerY - 5, 0,
        centerX, centerY, baseRadius * 0.8
      );
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGradient.addColorStop(0.3, 'rgba(0, 217, 255, 0.8)');
      coreGradient.addColorStop(1, 'rgba(0, 136, 255, 0.6)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.shadowBlur = isActive ? 30 : 15;
      ctx.shadowColor = 'rgba(0, 217, 255, 0.8)';
      ctx.fill();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background glow */}
      <div 
        className="absolute inset-0 rounded-full blur-2xl transition-opacity duration-500"
        style={{
          background: isActive 
            ? 'radial-gradient(circle, rgba(0,217,255,0.4) 0%, rgba(138,92,246,0.3) 50%, transparent 100%)'
            : 'radial-gradient(circle, rgba(0,217,255,0.2) 0%, transparent 70%)',
          animation: 'pulse-slow 4s ease-in-out infinite',
        }}
      />
      
      {/* Canvas for animated orb */}
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        className="absolute inset-0"
        style={{
          width: size,
          height: size,
        }}
      />
      
      {/* Reflection overlay */}
      <div 
        className="absolute top-[15%] left-[20%] right-[20%] h-[30%] rounded-full opacity-40 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.6), transparent)',
          filter: 'blur(6px)',
        }}
      />

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
