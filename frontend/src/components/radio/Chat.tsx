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
}

export function Chat({
  messages,
  currentUser,
  onSendMessage,
  onSendVoice,
  onToast,
  city,
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
        <span className="text-[#5e6ad2]">{t('chat_title')}</span>
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
