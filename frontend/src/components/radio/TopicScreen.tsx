import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, Sparkles, Users, MessageSquare, Mic, Send } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../ui/Toast';
import {
  getCurrentTopic, sendOpinionText, sendOpinionVoice, type CurrentTopic,
} from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User } from '../../types';

interface TopicScreenProps {
  user?: User | null;
  onPointsUpdate: (points: number) => void;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    title: 'Тема эфира', no_topic: 'Сейчас нет активной темы', wait: 'Скоро откроется новая тема для обсуждения',
    your_opinion: 'Ваше мнение', placeholder: 'Напишите своё мнение по теме...',
    send: 'Отправить', opinions: 'мнений собрано', sent_ok: 'Мнение отправлено! 🎉',
    sent_fail: 'Не удалось отправить', no_points: 'Недостаточно поинтов', empty: 'Напишите что-нибудь',
    recording: 'Идёт запись...', voice_sent: 'Голосовое отправлено! 🎤', ai_info: 'ИИ соберёт все мнения и создаст эфир',
    stream_active: 'ПОТОК АКТИВЕН', level: 'УРОВЕНЬ',
  },
  en: {
    title: 'Broadcast Topic', no_topic: 'No active topic now', wait: 'A new topic will open soon',
    your_opinion: 'Your opinion', placeholder: 'Write your opinion on the topic...',
    send: 'Send', opinions: 'opinions collected', sent_ok: 'Opinion sent! 🎉',
    sent_fail: 'Failed to send', no_points: 'Not enough points', empty: 'Write something',
    recording: 'Recording...', voice_sent: 'Voice sent! 🎤', ai_info: 'AI will collect all opinions and create a broadcast',
    stream_active: 'STREAM ACTIVE', level: 'LEVEL',
  },
  lt: {
    title: 'Eterio tema', no_topic: 'Šiuo metu nėra aktyvios temos', wait: 'Netrukus atsiras nauja tema',
    your_opinion: 'Jūsų nuomonė', placeholder: 'Parašykite savo nuomonę...',
    send: 'Siųsti', opinions: 'nuomonių surinkta', sent_ok: 'Nuomonė išsiųsta! 🎉',
    sent_fail: 'Nepavyko išsiųsti', no_points: 'Nepakanka taškų', empty: 'Parašykite ką nors',
    recording: 'Įrašoma...', voice_sent: 'Balso žinutė išsiųsta! 🎤', ai_info: 'DI surinks visas nuomones ir sukurs eterį',
    stream_active: 'SRAUTAS AKTYVUS', level: 'LYGIS',
  },
};

// Waveform bars (Stitch dizayni — doira ichida)
const BAR_HEIGHTS = [10, 15, 25, 40, 60, 30, 70, 45, 55, 20, 35, 15, 10];

export function TopicScreen({ user, onPointsUpdate }: TopicScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const { message, showToast } = useToast();

  const [topic, setTopic] = useState<CurrentTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadTopic = useCallback(async () => {
    try {
      const t = await getCurrentTopic();
      setTopic(t);
    } catch (e) {
      console.error('loadTopic:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopic();
    const iv = setInterval(loadTopic, 15000);
    return () => clearInterval(iv);
  }, [loadTopic]);

  const handleSendText = async () => {
    const t = text.trim();
    if (!t) { showToast(tx('empty')); return; }
    setSending(true);
    try {
      const res = await sendOpinionText(t);
      if (res?.points !== undefined) onPointsUpdate(Number(res.points));
      setText('');
      showToast(tx('sent_ok'));
      loadTopic();
    } catch (e: any) {
      if (e.status === 402) showToast(tx('no_points'));
      else showToast(tx('sent_fail'));
    } finally {
      setSending(false);
    }
  };

  const handleVoice = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const tgApp = (window as any).Telegram?.WebApp;
      if (tgApp?.requestMicrophoneAccess) {
        const granted: boolean = await new Promise(r => tgApp.requestMicrophoneAccess((ok: boolean) => r(ok)));
        if (!granted) { showToast(tx('sent_fail')); return; }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 800) { showToast(tx('empty')); return; }
        try {
          const res = await sendOpinionVoice(blob);
          if (res?.points !== undefined) onPointsUpdate(Number(res.points));
          showToast(tx('voice_sent'));
          loadTopic();
        } catch (e: any) {
          if (e.status === 402) showToast(tx('no_points'));
          else showToast(tx('sent_fail'));
        }
      };
      rec.start();
      setIsRecording(true);
      showToast(tx('recording'));
    } catch {
      showToast(tx('sent_fail'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader className="w-10 h-10 text-[#6e78e1] animate-spin" />
      </div>
    );
  }

  const lvl = user?.level ?? 1;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Status text (Stitch) */}
      <div className="flex flex-col items-center gap-1 text-center mt-2">
        <span className="font-mono text-[12px] text-[#9a9fa8]/70 tracking-[0.15em] uppercase">
          {tx('level')} {lvl}
        </span>
        <span className="font-mono text-[12px] text-[#6e78e1] tracking-[0.15em] uppercase">
          {tx('stream_active')}
        </span>
      </div>

      {/* Circular waveform visualization (Stitch) */}
      <div className="waveform-ring">
        <div className="flex items-center justify-center h-20 px-8">
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="waveform-bar"
              style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Mavzu kartasi */}
      {topic ? (
        <div className="stitch-card-bordered p-5 w-full"
          style={{ background: 'linear-gradient(135deg, rgba(123,133,232,0.1), rgba(124,92,255,0.05))' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(94,106,210,0.15)' }}>
              <Sparkles size={18} className="text-[#6e78e1]" />
            </div>
            <span className="text-[10px] font-bold tracking-[2px] text-[#9a9fa8]/70 uppercase font-mono">{tx('title')}</span>
          </div>
          <h2 className="text-[19px] font-extrabold text-[#d5d6dc] leading-tight mb-2">{topic.title}</h2>
          {topic.description && (
            <p className="text-[13px] text-[#9a9fa8] leading-relaxed mb-3">{topic.description}</p>
          )}
          <div className="flex items-center gap-2 text-[#6e78e1]">
            <Users size={16} />
            <span className="text-[12px] font-bold tabular-nums font-mono">{topic.opinion_count}</span>
            <span className="text-[11px] text-[#7d818a]">{tx('opinions')}</span>
          </div>
        </div>
      ) : (
        <div className="stitch-card p-8 text-center w-full">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(94,106,210,0.08)' }}>
            <MessageSquare size={28} className="text-[#7d818a]" />
          </div>
          <p className="text-sm text-[#d5d6dc] font-semibold">{tx('no_topic')}</p>
          <p className="text-xs text-[#7d818a] mt-1">{tx('wait')}</p>
        </div>
      )}

      {/* Fikr yuborish */}
      {topic && (
        <div className="stitch-card p-4 w-full flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-[#6e78e1] uppercase font-mono">{tx('your_opinion')}</span>
            <span className="text-[9px] text-[#7d818a] font-mono">text: 0.001 · voice: 0.005</span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tx('placeholder')}
            rows={3}
            className="w-full rounded-2xl px-3 py-2.5 text-sm text-[#d5d6dc] resize-none outline-none placeholder:text-[#7d818a]"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(94,106,210,0.2)' }}
          />

          <div className="flex gap-2">
            {/* Ovoz tugmasi */}
            <button
              onClick={handleVoice}
              className="h-12 w-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform shrink-0"
              style={{
                background: isRecording ? 'rgba(239,68,68,0.18)' : 'rgba(25,30,45,0.6)',
                border: `1px solid ${isRecording ? 'rgba(239,68,68,0.5)' : 'rgba(94,106,210,0.2)'}`,
              }}
            >
              <Mic
                size={22}
                className={isRecording ? 'text-[#ef4444]' : 'text-[#6e78e1]'}
                style={{ animation: isRecording ? 'pulse-glow 1s infinite' : 'none' }}
              />
            </button>

            {/* Yuborish */}
            <button
              onClick={handleSendText}
              disabled={sending || !text.trim()}
              className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold btn-primary-glow disabled:opacity-40"
            >
              {sending
                ? <Loader className="w-4 h-4 animate-spin" />
                : <Send size={18} />}
              {tx('send')}
            </button>
          </div>
        </div>
      )}

      {/* AI info */}
      <div className="stitch-card px-4 py-3 flex items-center gap-3 w-full"
        style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.15)' }}>
        <Sparkles size={18} className="text-[#a78bfa] shrink-0" />
        <span className="text-[11px] text-[#9a9fa8] leading-relaxed">{tx('ai_info')}</span>
      </div>

      <Toast message={message} />
    </div>
  );
}
