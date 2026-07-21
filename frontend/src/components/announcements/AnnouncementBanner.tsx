import { Megaphone } from 'lucide-react';
import type { Announcement } from '../../types';

interface AnnouncementBannerProps {
  announcement: Announcement;
}

export function AnnouncementBanner({ announcement }: AnnouncementBannerProps) {
  return (
    <div className="glass rounded-2xl flex gap-3.5 p-3.5 items-center hover:border-[rgba(249,115,22,0.28)] transition-all duration-200">
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
          announcement.image_url ? 'bg-cover bg-center' : 'bg-[rgba(249,115,22,0.1)]'
        }`}
        style={
          announcement.image_url
            ? { backgroundImage: `url('${announcement.image_url}')` }
            : {}
        }
      >
        {!announcement.image_url && (
          <Megaphone className="w-6 h-6 text-[var(--accent)]" strokeWidth={1.8} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[var(--text)] mb-0.5 truncate">
          {announcement.title}
        </div>
        <div className="text-[11px] text-[var(--muted)] leading-relaxed line-clamp-2">
          {announcement.text}
        </div>
      </div>
    </div>
  );
}
