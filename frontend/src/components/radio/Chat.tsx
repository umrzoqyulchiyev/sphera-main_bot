import { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { RoomsButton } from './RoomsScreen';
import { useTranslation } from '../../hooks/useTranslation';
import type { ChatMessage as ChatMessageType, User } from '../../types';

interface ChatProps {
  messages: ChatMessageType[];
  currentUser: User | null;
  onSendMessage: (message: string, destination: 'chat' | 'studio') => void;
  onSendVoice: (blob: Blob) => void;
  onToast: (message: string) => void;
  city: string;
  // Berilsa — sarlavha yonida chiqish tugmasi ko'rsatiladi (asosiy "Живой
  // чат" ekranida BottomNav o'rniga shu orqali oldingi ekranga qaytiladi).
  onExit?: () => void;
}

export function Chat({
  messages,
  currentUser,
  onSendMessage,
  onSendVoice,
  onToast,
  city,
  onExit,
}: ChatProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="glass p-3 flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-center text-[11px] tracking-[2px] mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {onExit && (
            <button
              onClick={onExit}
              aria-label="Выйти из чата"
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 -ml-1"
              style={{ background: 'rgba(94,106,210,0.08)' }}
            >
              <svg className="w-4 h-4 text-[#5e6ad2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-[#5e6ad2] truncate">{t('chat_title')}</span>
        </div>
        <RoomsButton user={currentUser} />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-[60px] scroll-smooth"
           style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.map((msg) => (
          <ChatMessageComponent
            key={msg.id}
            message={msg}
            currentUser={currentUser}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendMessage={onSendMessage}
        onSendVoice={onSendVoice}
        onToast={onToast}
        city={city}
      />
    </div>
  );
}
