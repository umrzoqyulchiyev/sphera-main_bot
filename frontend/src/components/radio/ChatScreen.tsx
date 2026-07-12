import { useState, useEffect, useCallback } from 'react';
import { Chat } from './Chat';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../hooks/useToast';
import { useTranslation } from '../../hooks/useTranslation';
import { Toast } from '../ui/Toast';
import { getChatHistory, sendChatMessage } from '../../lib/api';
import { DEFAULT_CITY, LS_CITY } from '../../lib/config';
import type { User, ChatMessage } from '../../types';

interface ChatScreenProps {
  user: User | null;
  onPointsUpdate: (points: number) => void;
}

export function ChatScreen({ user, onPointsUpdate }: ChatScreenProps) {
  const { t, lang } = useTranslation();
  const { message, showToast } = useToast();
  const [city] = useState(localStorage.getItem(LS_CITY) || DEFAULT_CITY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const dedupe = (msgs: ChatMessage[]) =>
    msgs.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

  const loadHistory = useCallback(() => {
    getChatHistory(city).then((msgs) => setMessages(dedupe(msgs))).catch(() => {});
  }, [city]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function handleWSMessage(wsMessage: { type: string; data?: any }) {
    if (!wsMessage.data) return;
    switch (wsMessage.type) {
      case 'chat': {
        const newMsg = wsMessage.data;
        setMessages((prev) => {
          if (newMsg?.id && prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        break;
      }
      case 'balance':
        onPointsUpdate(wsMessage.data.points);
        break;
      case 'limit_exceeded':
        onPointsUpdate(wsMessage.data.points);
        showToast(t('toast_limit'));
        break;
      case 'studio_ack':
        onPointsUpdate(wsMessage.data.points);
        showToast(t('toast_sent_studio'));
        break;
      case 'studio_denied':
        showToast(t('studio_denied_role'));
        break;
    }
  }

  const { send: wsSend } = useWebSocket({ city, onMessage: handleWSMessage });

  const handleSendMessage = useCallback(
    async (msg: string, destination: 'chat' | 'studio') => {
      const sentViaWs = wsSend({ type: destination, message: msg, lang });
      if (sentViaWs) return;

      try {
        const res: any = await sendChatMessage(city, msg);
        if (res?.points !== undefined) onPointsUpdate(Number(res.points));
        showToast(destination === 'studio' ? t('toast_sent_studio') : t('toast_sent_chat'));
        loadHistory();
      } catch (e: any) {
        if (e?.status === 402) showToast(t('toast_limit'));
        else showToast(t('send_error'));
      }
    },
    [wsSend, lang, onPointsUpdate, showToast, t, city, loadHistory]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Chat
        messages={messages}
        currentUser={user}
        onSendMessage={handleSendMessage}
        onToast={showToast}
        city={city}
        language={lang}
        onPointsUpdate={onPointsUpdate}
      />
      <Toast message={message} />
    </div>
  );
}
