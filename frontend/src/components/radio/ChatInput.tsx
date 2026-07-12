import { useState, useRef } from 'react';
import { Mic, Send, MessageSquare, Paperclip, X } from 'lucide-react';
import { sendVoiceMessage, uploadFile } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import type { Language } from '../../types';

interface ChatInputProps {
  onSendMessage: (message: string, destination: 'chat' | 'studio') => void;
  onToast: (message: string) => void;
  city: string;
  language: Language;
  onPointsUpdate: (points: number) => void;
}

export function ChatInput({ onSendMessage, onToast, city, language, onPointsUpdate }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoice, setPendingVoice] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (destination: 'chat' | 'studio') => {
    if (pendingVoice) {
      sendVoice(destination);
      return;
    }

    const message = text.trim();
    if (!message) {
      onToast(t('toast_short'));
      return;
    }

    onSendMessage(message, destination);
    setText('');
    onToast(destination === 'studio' ? t('toast_sent_studio') : t('toast_sent_chat'));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
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
        setPendingVoice(blob);
        onToast(t('voice_ready'));
      };

      mediaRecorder.start();
      setIsRecording(true);
      onToast(t('toast_recording'));
    } catch (e) {
      console.error('Mic error:', e);
      onToast(t('toast_mic_denied'));
    }
  };

  const sendVoice = async (destination: 'chat' | 'studio') => {
    if (!pendingVoice) return;
    onToast(t('toast_processing'));

    try {
      await sendVoiceMessage(city, pendingVoice, destination, language);
      onToast(destination === 'studio' ? t('toast_sent_studio') : t('toast_sent_chat'));
    } catch (error: any) {
      if (error.status === 403) {
        onToast(t('studio_denied_role'));
      } else if (error.status === 402) {
        const data = await error.response?.json().catch(() => ({}));
        if (data?.detail?.points !== undefined) {
          onPointsUpdate(data.detail.points);
        }
        onToast(t('toast_limit'));
      } else {
        onToast(t('send_error'));
      }
    } finally {
      setPendingVoice(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onToast('⚠️ Max 20MB');
      return;
    }
    onToast(t('toast_processing'));
    try {
      await uploadFile(city, file);
      onToast(t('toast_sent_chat'));
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

  return (
    <div className="flex flex-col gap-3">
      {/* Voice preview banner */}
      {pendingVoice && (
        <div className="glass px-4 py-3 rounded-2xl flex items-center justify-between border border-dashed border-[#5e6ad2]">
          <span className="text-xs text-[#5e6ad2]">{t('voice_ready')}</span>
          <button onClick={() => setPendingVoice(null)} className="text-[#8a8f98] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Text input row */}
      <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
        {/* Attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#8a8f98] hover:text-[#5e6ad2] hover:bg-[rgba(94,106,210,0.08)] transition-all"
        >
          <Paperclip className="w-4.5 h-4.5" strokeWidth={1.8} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />

        {/* Text field */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend('chat')}
          placeholder={t('chat_placeholder')}
          className="flex-1 min-w-0 bg-transparent text-sm text-[#ededef] placeholder-[#4a5568] outline-none"
        />

        {/* Mic */}
        <button
          onClick={toggleRecording}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-[#ff4d6d] text-white animate-pulse'
              : 'text-[#8a8f98] hover:text-[#5e6ad2] hover:bg-[rgba(94,106,210,0.08)]'
          }`}
        >
          <Mic className="w-4.5 h-4.5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Send buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => handleSend('chat')}
          className="glass py-3 px-4 rounded-2xl flex items-center justify-center gap-2 hover:border-[rgba(94,106,210,0.3)] transition-all active:scale-[0.97]"
        >
          <MessageSquare className="w-4 h-4 text-[#5e6ad2]" strokeWidth={1.8} />
          <span className="text-xs font-semibold text-[#ededef]">{t('send_to_chat')}</span>
        </button>
        <button
          onClick={() => handleSend('studio')}
          className="py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, rgba(123,133,232,0.9), rgba(94,106,210,0.9))',
            boxShadow: '0 0 20px rgba(94,106,210,0.3)',
          }}
        >
          <Send className="w-4 h-4 text-[#050506]" strokeWidth={2} />
          <span className="text-xs font-bold text-[#050506]">{t('send_to_studio')}</span>
        </button>
      </div>
    </div>
  );
}
