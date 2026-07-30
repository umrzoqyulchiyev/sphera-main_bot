import { useState, useRef } from 'react';
import { Mic, Send, Paperclip } from 'lucide-react';
import { uploadFile } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { hapticImpact } from '../../lib/telegram';

interface ChatInputProps {
  onSendMessage: (message: string, destination: 'chat' | 'studio') => void;
  // Yozib bo'lingan ovoz shu callback'ga uzatiladi — yuborish, optimistik
  // ko'rsatish va status (bitta/ikkita galochka) hammasi chaqiruvchi
  // ekranda (ChatScreen/RoomChatModal) boshqariladi, xuddi matn kabi.
  onSendVoice: (blob: Blob) => void;
  onToast: (message: string) => void;
  city: string;
  // O'zi hozir prямой эфирда bo'lsa — mikrofon band (broadcast uchun
  // ishlatilyapti), shuning uchun ovozli xabar yozib bo'lmaydi. Matn
  // yuborish esa bunga bog'liq emas, davom etaveradi.
  micDisabled?: boolean;
}

// Bu input faqat CHAT'ga yuborish uchun — studiyaga yuborish Efir ekranida
// alohida joylashgan. Tugma Telegram uslubida: matn bo'lsa yuborish
// belgisi, bo'lmasa mikrofon — bitta doira tugma, matn maydonidan tashqarida.
export function ChatInput({ onSendMessage, onSendVoice, onToast, city, micDisabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendText = () => {
    const message = text.trim();
    if (!message) return;
    onSendMessage(message, 'chat');
    setText('');
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // To'xtatish — ovoz darhol yuboriladi (Telegram kabi, oraliq
      // tasdiqlashsiz: mediaRecorder.onstop ichida onSendVoice chaqiriladi).
      hapticImpact('medium');
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (micDisabled) {
      onToast(t('toast_mic_live'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Telegram WebView (iOS) webm'ni ijro eta olmaydi — mp4/mpeg ni afzal ko'ramiz
      const preferredTypes = [
        'audio/mp4',
        'audio/mpeg',
        'audio/ogg',
        'audio/webm',
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const actualType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualType });
        if (blob.size < 1000) {
          onToast(t('toast_short'));
          return;
        }
        onSendVoice(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      hapticImpact('light');
    } catch (e) {
      console.error('Mic error:', e);
      onToast(t('toast_mic_denied'));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onToast('⚠️ Max 20MB');
      return;
    }
    try {
      await uploadFile(city, file);
    } catch (error: any) {
      if (error.status === 402) {
        onToast(t('toast_limit'));
      } else {
        onToast(t('send_error'));
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasText = text.trim().length > 0;

  const handleActionClick = () => {
    if (isRecording || hasText) {
      isRecording ? toggleRecording() : handleSendText();
    } else {
      toggleRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Text input row — Telegram uslubida pill */}
      <div className="flex-1 glass rounded-full px-3 py-2 flex items-center gap-2 min-w-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[rgba(255,47,208,0.08)] transition-all"
        >
          <Paperclip className="w-4.5 h-4.5" strokeWidth={1.8} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          placeholder={t('chat_placeholder')}
          disabled={isRecording}
          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text)] placeholder-[#9a9791] outline-none disabled:opacity-50"
        />
      </div>

      {/* Doira tugma — Telegram kabi: matn bo'lsa yuborish, bo'lmasa mikrofon.
          Yozib turganda qizil rangga o'zgaradi, tashqi halqa animate-ping bilan
          urib turadi (button'ning o'zi/ikonkasi hech qachon xira bo'lmaydi). */}
      <div className="relative shrink-0">
        {isRecording && (
          <span className="rift-rec-pulse absolute inset-0 rounded-full bg-[var(--danger)] opacity-60" />
        )}
        <button
          onClick={handleActionClick}
          aria-label={isRecording ? 'Остановить и отправить' : hasText ? 'Отправить' : 'Записать голосовое'}
          className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{
            background: isRecording
              ? '#ff3b5c'
              : micDisabled && !hasText
                ? 'rgba(237,234,227,0.15)'
                : 'linear-gradient(135deg, #ff6ee0, #FF2FD0)',
            boxShadow: isRecording
              ? '0 0 18px rgba(255,59,92,0.6)'
              : micDisabled && !hasText
                ? 'none'
                : '0 0 16px rgba(255,47,208,0.4)',
          }}
        >
          {hasText && !isRecording ? (
            <Send className="w-4.5 h-4.5 text-white ml-[-1px]" strokeWidth={2} fill="white" />
          ) : (
            <Mic className={`w-5 h-5 ${micDisabled ? 'text-[#9a9791]' : 'text-white'}`} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
