import { Radio } from 'lucide-react';

interface SiriOrbProps {
  isActive: boolean;
  onClick?: () => void;
}

export function SiriOrb({ isActive, onClick }: SiriOrbProps) {
  return (
    <>
      <button
        onClick={onClick}
        className="relative w-16 h-16 cursor-pointer group"
      >
        {/* Outer glow atmosphere - multiple layers */}
        <div className="absolute inset-[-12px]">
          <div className="siri-atmosphere-1 absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(56,225,255,0.15) 0%, transparent 70%)',
              filter: 'blur(18px)',
            }}
          />
          <div className="siri-atmosphere-2 absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(0,200,255,0.12) 0%, transparent 65%)',
              filter: 'blur(22px)',
            }}
          />
          <div className="siri-atmosphere-3 absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(46,168,255,0.1) 0%, transparent 60%)',
              filter: 'blur(28px)',
            }}
          />
        </div>
        
        {/* Pulsing energy rings */}
        <div className="absolute inset-[-6px]">
          <div className="siri-energy-ring-1 absolute inset-0 rounded-full border-2 border-cyan-400/20" />
          <div className="siri-energy-ring-2 absolute inset-0 rounded-full border-2 border-blue-400/15" />
        </div>
        
        {/* Main orb container */}
        <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-all duration-500 ${
          isActive ? 'scale-[1.15]' : 'group-hover:scale-105'
        }`}>
          {/* Multi-layer rotating gradients for depth */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            {/* Layer 1: Fast rotation */}
            <div className="siri-gradient-1 absolute inset-[-50%]"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  transparent 0deg,
                  rgba(56,225,255,0.4) 90deg,
                  transparent 180deg,
                  rgba(46,168,255,0.3) 270deg,
                  transparent 360deg
                )`,
              }}
            />
            {/* Layer 2: Medium rotation */}
            <div className="siri-gradient-2 absolute inset-[-50%]"
              style={{
                background: `conic-gradient(
                  from 180deg,
                  transparent 0deg,
                  rgba(0,217,255,0.35) 90deg,
                  transparent 180deg,
                  rgba(0,200,255,0.25) 270deg,
                  transparent 360deg
                )`,
              }}
            />
            {/* Layer 3: Slow rotation */}
            <div className="siri-gradient-3 absolute inset-[-50%]"
              style={{
                background: `conic-gradient(
                  from 90deg,
                  transparent 0deg,
                  rgba(38,225,255,0.3) 120deg,
                  transparent 240deg,
                  rgba(0,188,255,0.2) 300deg,
                  transparent 360deg
                )`,
              }}
            />
          </div>
          
          {/* Main morphing orb */}
          <div 
            className="siri-morph-complex absolute w-14 h-14 z-10"
            style={{
              background: `
                radial-gradient(
                  circle at 30% 30%,
                  rgba(255,255,255,0.15) 0%,
                  transparent 50%
                ),
                linear-gradient(135deg, 
                  #00e5ff 0%, 
                  #00d0ff 20%,
                  #00b8ff 40%,
                  #0099ff 60%,
                  #00b0ff 80%,
                  #00d5ff 100%
                )
              `,
              boxShadow: isActive
                ? `
                  0 0 60px rgba(56,225,255,0.9), 
                  0 0 120px rgba(46,168,255,0.5),
                  0 0 180px rgba(0,200,255,0.3),
                  inset 0 0 40px rgba(255,255,255,0.25),
                  inset 0 -10px 30px rgba(0,150,255,0.3)
                `
                : `
                  0 0 50px rgba(56,225,255,0.7), 
                  0 0 100px rgba(46,168,255,0.4),
                  0 0 150px rgba(0,200,255,0.2),
                  inset 0 0 35px rgba(255,255,255,0.2),
                  inset 0 -10px 25px rgba(0,150,255,0.25)
                `,
            }}
          />
          
          {/* Liquid surface effect */}
          <div className="siri-liquid absolute inset-[3px] rounded-full overflow-hidden z-20">
            <div 
              className="absolute inset-[-100%]"
              style={{
                background: `
                  radial-gradient(
                    ellipse 80% 60% at 20% 30%,
                    rgba(255,255,255,0.5) 0%,
                    rgba(255,255,255,0.15) 40%,
                    transparent 70%
                  )
                `,
              }}
            />
          </div>
          
          {/* Multiple shimmer passes */}
          <div className="absolute inset-0 rounded-full overflow-hidden z-20">
            <div className="siri-shimmer-1 absolute inset-0"
              style={{
                background: 'linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.6) 50%, transparent 80%)',
              }}
            />
            <div className="siri-shimmer-2 absolute inset-0"
              style={{
                background: 'linear-gradient(70deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
              }}
            />
          </div>
          
          {/* Depth layers with subtle movement */}
          <div className="siri-depth-1 absolute inset-[6px] rounded-full z-15"
            style={{
              background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.25), transparent 55%)',
            }}
          />
          <div className="siri-depth-2 absolute inset-[8px] rounded-full z-15"
            style={{
              background: 'radial-gradient(circle at 60% 65%, rgba(0,100,200,0.15), transparent 50%)',
            }}
          />
          
          {/* Energy particles with trails */}
          <div className="absolute inset-0 z-25">
            <div className="siri-particle-1 absolute w-2 h-2 rounded-full" 
              style={{ 
                top: '12%', 
                left: '18%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(100,220,255,0.4))',
                boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                filter: 'blur(0.5px)',
              }} 
            />
            <div className="siri-particle-2 absolute w-1.5 h-1.5 rounded-full" 
              style={{ 
                top: '70%', 
                right: '20%',
                background: 'radial-gradient(circle, rgba(200,240,255,0.8), rgba(0,200,255,0.3))',
                boxShadow: '0 0 6px rgba(200,240,255,0.5)',
                filter: 'blur(0.5px)',
              }} 
            />
            <div className="siri-particle-3 absolute w-1.5 h-1.5 rounded-full" 
              style={{ 
                bottom: '18%', 
                left: '12%',
                background: 'radial-gradient(circle, rgba(180,230,255,0.7), rgba(46,168,255,0.3))',
                boxShadow: '0 0 7px rgba(180,230,255,0.4)',
                filter: 'blur(0.5px)',
              }} 
            />
            <div className="siri-particle-4 absolute w-1 h-1 rounded-full" 
              style={{ 
                top: '45%', 
                right: '8%',
                background: 'radial-gradient(circle, rgba(220,245,255,0.6), rgba(0,180,255,0.2))',
                boxShadow: '0 0 5px rgba(220,245,255,0.3)',
                filter: 'blur(0.5px)',
              }} 
            />
          </div>
        </div>
        
        {/* Center icon with advanced effects */}
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="relative">
            {/* Icon glow behind */}
            <div className="siri-icon-glow absolute inset-[-4px]">
              <Radio 
                className="w-6 h-6 text-white/30 blur-md" 
                strokeWidth={2.5}
              />
            </div>
            {/* Main icon */}
            <Radio 
              className="siri-icon-main relative w-6 h-6 text-white" 
              strokeWidth={2.5}
              style={{ 
                filter: `
                  drop-shadow(0 2px 8px rgba(0,0,0,0.5)) 
                  drop-shadow(0 0 12px rgba(255,255,255,0.4))
                  drop-shadow(0 0 20px rgba(56,225,255,0.3))
                `,
              }}
            />
          </div>
        </div>
      </button>
      
      <style>{`
        /* Complex morphing with bezier curves for organic feel */
        @keyframes siri-morph-complex {
          0% { 
            border-radius: 63% 37% 54% 46% / 55% 48% 52% 45%;
            transform: rotate(0deg);
          }
          14% { 
            border-radius: 40% 60% 54% 46% / 49% 60% 40% 51%;
          }
          28% { 
            border-radius: 54% 46% 38% 62% / 49% 70% 30% 51%;
          }
          42% { 
            border-radius: 61% 39% 55% 45% / 61% 38% 62% 39%;
          }
          56% { 
            border-radius: 61% 39% 67% 33% / 70% 50% 50% 30%;
          }
          70% { 
            border-radius: 50% 50% 34% 66% / 56% 68% 32% 44%;
          }
          84% { 
            border-radius: 46% 54% 50% 50% / 35% 61% 39% 65%;
          }
          100% { 
            border-radius: 63% 37% 54% 46% / 55% 48% 52% 45%;
            transform: rotate(360deg);
          }
        }
        
        /* Multi-layer gradient rotations at different speeds */
        @keyframes siri-gradient-1 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes siri-gradient-2 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        
        @keyframes siri-gradient-3 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(180deg); }
        }
        
        /* Atmospheric breathing */
        @keyframes siri-atmosphere-1 {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.5; 
          }
          33% { 
            transform: scale(1.15); 
            opacity: 0.3; 
          }
          66% { 
            transform: scale(0.95); 
            opacity: 0.6; 
          }
        }
        
        @keyframes siri-atmosphere-2 {
          0%, 100% { 
            transform: scale(1) rotate(0deg); 
            opacity: 0.4; 
          }
          50% { 
            transform: scale(1.2) rotate(180deg); 
            opacity: 0.2; 
          }
        }
        
        @keyframes siri-atmosphere-3 {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.3; 
          }
          50% { 
            transform: scale(1.3); 
            opacity: 0.1; 
          }
        }
        
        /* Energy rings expansion */
        @keyframes siri-energy-ring-1 {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.3; 
          }
          50% { 
            transform: scale(1.4); 
            opacity: 0; 
          }
        }
        
        @keyframes siri-energy-ring-2 {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.25; 
          }
          50% { 
            transform: scale(1.5); 
            opacity: 0; 
          }
        }
        
        /* Liquid surface movement */
        @keyframes siri-liquid {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg); 
          }
          25% { 
            transform: translate(3px, -2px) rotate(5deg); 
          }
          50% { 
            transform: translate(-2px, 3px) rotate(-3deg); 
          }
          75% { 
            transform: translate(2px, 2px) rotate(4deg); 
          }
        }
        
        /* Dual shimmer passes */
        @keyframes siri-shimmer-1 {
          0% { 
            transform: translateX(-120%) translateY(-120%); 
            opacity: 0; 
          }
          10% { 
            opacity: 0.6; 
          }
          90% { 
            opacity: 0.6; 
          }
          100% { 
            transform: translateX(120%) translateY(120%); 
            opacity: 0; 
          }
        }
        
        @keyframes siri-shimmer-2 {
          0% { 
            transform: translateX(-130%) translateY(-100%); 
            opacity: 0; 
          }
          15% { 
            opacity: 0.4; 
          }
          85% { 
            opacity: 0.4; 
          }
          100% { 
            transform: translateX(130%) translateY(100%); 
            opacity: 0; 
          }
        }
        
        /* Depth layer subtle movements */
        @keyframes siri-depth-1 {
          0%, 100% { 
            transform: translate(0, 0); 
            opacity: 1; 
          }
          50% { 
            transform: translate(2px, -1px); 
            opacity: 0.8; 
          }
        }
        
        @keyframes siri-depth-2 {
          0%, 100% { 
            transform: translate(0, 0); 
            opacity: 1; 
          }
          50% { 
            transform: translate(-1px, 2px); 
            opacity: 0.7; 
          }
        }
        
        /* Organic particle floating with easing */
        @keyframes siri-float-1 {
          0%, 100% { 
            transform: translate(0, 0) scale(1); 
            opacity: 0.8; 
          }
          25% { 
            transform: translate(4px, -6px) scale(1.3); 
            opacity: 1; 
          }
          50% { 
            transform: translate(2px, -2px) scale(0.9); 
            opacity: 0.6; 
          }
          75% { 
            transform: translate(-3px, 4px) scale(1.1); 
            opacity: 0.9; 
          }
        }
        
        @keyframes siri-float-2 {
          0%, 100% { 
            transform: translate(0, 0) scale(1); 
            opacity: 0.7; 
          }
          30% { 
            transform: translate(-5px, 5px) scale(1.2); 
            opacity: 0.9; 
          }
          60% { 
            transform: translate(3px, -3px) scale(0.8); 
            opacity: 0.5; 
          }
          90% { 
            transform: translate(2px, 2px) scale(1.15); 
            opacity: 0.8; 
          }
        }
        
        @keyframes siri-float-3 {
          0%, 100% { 
            transform: translate(0, 0) scale(1); 
            opacity: 0.6; 
          }
          20% { 
            transform: translate(5px, 4px) scale(0.85); 
            opacity: 0.8; 
          }
          45% { 
            transform: translate(-2px, -5px) scale(1.25); 
            opacity: 0.5; 
          }
          80% { 
            transform: translate(-4px, 3px) scale(1.1); 
            opacity: 0.7; 
          }
        }
        
        @keyframes siri-float-4 {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg); 
            opacity: 0.5; 
          }
          35% { 
            transform: translate(3px, -4px) scale(1.4) rotate(120deg); 
            opacity: 0.9; 
          }
          70% { 
            transform: translate(-4px, -2px) scale(0.9) rotate(240deg); 
            opacity: 0.6; 
          }
        }
        
        /* Icon effects */
        @keyframes siri-icon-main {
          0%, 100% { 
            transform: scale(1) rotate(0deg); 
          }
          25% { 
            transform: scale(1.03) rotate(1deg); 
          }
          75% { 
            transform: scale(0.98) rotate(-1deg); 
          }
        }
        
        @keyframes siri-icon-glow {
          0%, 100% { 
            opacity: 0.3; 
            transform: scale(1); 
          }
          50% { 
            opacity: 0.6; 
            transform: scale(1.15); 
          }
        }
        
        /* Apply all animations */
        .siri-morph-complex {
          animation: siri-morph-complex 7s ease-in-out infinite;
        }
        
        .siri-gradient-1 {
          animation: siri-gradient-1 12s linear infinite;
        }
        
        .siri-gradient-2 {
          animation: siri-gradient-2 16s linear infinite;
        }
        
        .siri-gradient-3 {
          animation: siri-gradient-3 20s linear infinite;
        }
        
        .siri-atmosphere-1 {
          animation: siri-atmosphere-1 4s ease-in-out infinite;
        }
        
        .siri-atmosphere-2 {
          animation: siri-atmosphere-2 5s ease-in-out infinite 0.5s;
        }
        
        .siri-atmosphere-3 {
          animation: siri-atmosphere-3 6s ease-in-out infinite 1s;
        }
        
        .siri-energy-ring-1 {
          animation: siri-energy-ring-1 2.5s ease-out infinite;
        }
        
        .siri-energy-ring-2 {
          animation: siri-energy-ring-2 2.5s ease-out infinite 0.4s;
        }
        
        .siri-liquid > div {
          animation: siri-liquid 8s ease-in-out infinite;
        }
        
        .siri-shimmer-1 {
          animation: siri-shimmer-1 4s ease-in-out infinite;
        }
        
        .siri-shimmer-2 {
          animation: siri-shimmer-2 5s ease-in-out infinite 0.5s;
        }
        
        .siri-depth-1 {
          animation: siri-depth-1 6s ease-in-out infinite;
        }
        
        .siri-depth-2 {
          animation: siri-depth-2 7s ease-in-out infinite 0.8s;
        }
        
        .siri-particle-1 {
          animation: siri-float-1 5s ease-in-out infinite;
        }
        
        .siri-particle-2 {
          animation: siri-float-2 6s ease-in-out infinite 0.3s;
        }
        
        .siri-particle-3 {
          animation: siri-float-3 5.5s ease-in-out infinite 0.7s;
        }
        
        .siri-particle-4 {
          animation: siri-float-4 4.5s ease-in-out infinite 1s;
        }
        
        .siri-icon-main {
          animation: siri-icon-main 4s ease-in-out infinite;
        }
        
        .siri-icon-glow {
          animation: siri-icon-glow 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
