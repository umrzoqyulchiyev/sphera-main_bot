import { useState, useEffect, useCallback, useRef } from 'react';
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
  // O'zimiz optimistik qo'shgan (hali serverdan tasdiqlanmagan) xabarlar —
  // WS orqali xuddi shu matn qaytib kelganda ular bilan almashtiriladi
  // (Telegram uslubidagi 1/2 galochka uchun kerak).
  const pendingRef = useRef<{ tempId: number; content: string }[]>([]);

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

          // Shu matnni kutayotgan optimistik xabar bo'lsa — o'shani asl
          // xabar bilan almashtiramiz (dublikat qo'shmaymiz, 2-galochka).
          const pendingIdx = pendingRef.current.findIndex((p) => p.content === (newMsg.message || ''));
          if (pendingIdx !== -1) {
            const { tempId } = pendingRef.current[pendingIdx];
            pendingRef.current.splice(pendingIdx, 1);
            return prev.map((m) => (m.id === tempId ? { ...newMsg, status: 'delivered' as const } : m));
          }
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
      // Faqat "chat" uchun darhol ko'rsatamiz — Telegram kabi bosilgan
      // zahoti xabar chatda ko'rinadi (server javobini kutmasdan).
      let tempId: number | null = null;
      if (destination === 'chat') {
        tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
        pendingRef.current.push({ tempId, content: msg });
        setMessages((prev) => [
          ...prev,
          {
            id: tempId!,
            username: user?.username ?? null,
            display_name: user?.display_name || user?.full_name || null,
            message: msg,
            message_type: 'text',
            voice_url: null,
            created_at: new Date().toISOString(),
            status: 'sending',
          },
        ]);
      }
      const markSent = () => {
        if (tempId === null) return;
        const id = tempId;
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'sent' as const } : m)));
      };
      const rollback = () => {
        if (tempId === null) return;
        const id = tempId;
        pendingRef.current = pendingRef.current.filter((p) => p.tempId !== id);
        setMessages((prev) => prev.filter((m) => m.id !== id));
      };

      const sentViaWs = wsSend({ type: destination, message: msg, lang });
      if (sentViaWs) {
        markSent();
        return;
      }

      try {
        const res: any = await sendChatMessage(city, msg);
        if (res?.points !== undefined) onPointsUpdate(Number(res.points));
        showToast(destination === 'studio' ? t('toast_sent_studio') : t('toast_sent_chat'));
        // WS ulanmagan bo'lsa echo kelmaydi — tarixni qayta yuklab, optimistik
        // yozuvni asl (server) versiyasi bilan almashtiramiz.
        loadHistory();
      } catch (e: any) {
        rollback();
        if (e?.status === 402) showToast(t('toast_limit'));
        else showToast(t('send_error'));
      }
    },
    [wsSend, lang, onPointsUpdate, showToast, t, city, loadHistory, user]
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
