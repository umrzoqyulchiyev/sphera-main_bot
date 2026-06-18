import { Play, Volume2 } from 'lucide-react';
import { Visualizer } from './Visualizer';

interface AudioPlayerProps {
  isPlaying: boolean;
  volume: number;
  broadcasterName: string;
  userId: number;
  listenersCount?: number;
  onTogglePlay: () => void;
  onVolumeChange: (volume: number) => void;
}

export function AudioPlayer({
  isPlaying,
  volume,
  broadcasterName,
  userId,
  onTogglePlay,
  onVolumeChange,
}: AudioPlayerProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Orb — bosilganda play/pause (markazda tugma yo'q, faqat jonli to'lqin) */}
      <button
        onClick={onTogglePlay}
        className="relative flex items-center justify-center active:scale-95 transition-transform"
        aria-label={isPlaying ? 'pause' : 'play'}
      >
        <Visualizer isPlaying={isPlaying} />

        {/* Play belgisi faqat to'xtatilganda (markazda kichik, yarim shaffof) */}
        {!isPlaying && (
          <span className="absolute z-10 w-12 h-12 rounded-full flex items-center justify-center bg-[rgba(6,10,20,0.45)] backdrop-blur-sm">
            <Play className="w-6 h-6 text-[#38e1ff] ml-0.5" strokeWidth={2.5} />
          </span>
        )}
      </button>

      {/* Broadcaster info */}
      <div className="text-center">
        <div className="text-[10px] text-[#6b7c9e] tracking-wider">
          ID: {userId}
        </div>
        <div className="text-sm font-bold text-[#38e1ff] text-glow mt-0.5">
          {broadcasterName}
        </div>
      </div>

      {/* Volume control */}
      <div className="w-full max-w-[260px] glass px-4 py-2.5 rounded-2xl flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-[#38e1ff] shrink-0" strokeWidth={1.8} />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none outline-none cursor-pointer"
          style={{
            background: `linear-gradient(90deg, #38e1ff 0%, #38e1ff ${volume}%, rgba(46,168,255,0.15) ${volume}%, rgba(46,168,255,0.15) 100%)`,
          }}
        />
        <span className="text-[10px] text-[#6b7c9e] w-7 text-right">{volume}%</span>
      </div>
    </div>
  );
}
