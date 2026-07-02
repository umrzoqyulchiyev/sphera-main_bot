import { useState, useEffect, useRef, useCallback } from 'react';
import { getStreamUrl, getPlaylist } from '../lib/api';
import type { AudioSegment, Language } from '../types';

interface UseAudioPlayerOptions {
  city: string;
  language: Language;
  useIcecast: boolean;
  streamUrl?: string | null;
}

export function useAudioPlayer({ city, language, useIcecast, streamUrl }: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playlist, setPlaylist] = useState<AudioSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);

  const wantPlayingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrlRef = useRef(streamUrl);
  const languageRef = useRef(language);
  streamUrlRef.current = streamUrl;
  languageRef.current = language;

  const buildStreamUrl = useCallback(() => {
    const base = getStreamUrl(languageRef.current, streamUrlRef.current);
    // ?t= cache bypass (har ulanishда yangi)
    return `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, []);

  const clearLoadingTimeout = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  // Audio element bir marta yaratiladi (playlist/icecast bir xil element)
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audio.preload = 'none';
    (audio as any).playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audioRef.current = audio;

    const onPlaying = () => {
      clearLoadingTimeout();
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onCanPlay = () => {
      // Brauzer tayyor — agar foydalanuvchi xohlagan bo'lsa, play qilamiz
      if (wantPlayingRef.current && audio.paused) {
        audio.play().catch(() => {
          clearLoadingTimeout();
          setIsLoading(false);
        });
      }
    };
    const onError = () => {
      console.warn('audio error');
      clearLoadingTimeout();
      setIsLoading(false);
      setIsPlaying(false);
      if (useIcecast && wantPlayingRef.current) {
        // Qayta urinish
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!wantPlayingRef.current) return;
          audio.src = buildStreamUrl();
          audio.load();
          audio.play().catch(() => {});
        }, 2000);
      }
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onError);

    return () => {
      audio.pause();
      audio.src = '';
      clearLoadingTimeout();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bir marta yaratiladi

  // Playlist yuklash (non-Icecast)
  useEffect(() => {
    if (!useIcecast) {
      getPlaylist(city).then(setPlaylist).catch(console.error);
    }
  }, [city, useIcecast]);

  // Til o'zgarganda — agar playing bo'lsa, yangi til oqimiga o'tamiz
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !useIcecast || !wantPlayingRef.current) return;
    audio.src = buildStreamUrl();
    audio.load();
    audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Foreground qaytganда tiklash
  useEffect(() => {
    if (!useIcecast) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wantPlayingRef.current && audioRef.current?.paused) {
        const a = audioRef.current;
        a.src = buildStreamUrl();
        a.load();
        a.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useIcecast]);

  const playNextSegment = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentSegmentIndex + 1) % playlist.length;
    const segment = playlist[nextIndex];
    if (audioRef.current && segment) {
      audioRef.current.src = segment.url.startsWith('http')
        ? segment.url
        : `${location.origin}${segment.url}`;
      audioRef.current.play().catch(console.error);
      setCurrentSegmentIndex(nextIndex);
    }
  }, [playlist, currentSegmentIndex]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // STOP
    if (isPlaying || isLoading) {
      wantPlayingRef.current = false;
      clearLoadingTimeout();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      audio.pause();
      if (useIcecast) audio.src = '';
      setIsLoading(false);
      setIsPlaying(false);
      return;
    }

    // START
    wantPlayingRef.current = true;
    setIsLoading(true);

    // AudioContext resume — Telegram WebView ba'zan audio context'ni bloklaydi
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (_) { /* baribir davom etamiz */ }

    // Volume ishonchli 
    audio.muted = false;
    audio.volume = volume / 100;

    // Loading timeout — 12 sekundda ulanmasa, spinner'ni o'chiramiz
    clearLoadingTimeout();
    loadingTimeoutRef.current = setTimeout(() => {
      if (!isPlaying) {
        console.warn('Audio loading timeout');
        setIsLoading(false);
        wantPlayingRef.current = false;
      }
    }, 12000);

    try {
      if (useIcecast) {
        audio.src = buildStreamUrl();
        audio.load();
        await audio.play();
        // 'playing' event setIsPlaying chaqiradi
      } else {
        if (!audio.src && playlist.length > 0) {
          playNextSegment();
        } else if (audio.src) {
          await audio.play();
        }
      }
    } catch (e) {
      console.error('togglePlay error:', e);
      clearLoadingTimeout();
      setIsLoading(false);
      wantPlayingRef.current = false;
    }
  }, [isPlaying, isLoading, useIcecast, buildStreamUrl, playlist, playNextSegment]);

  const addSegment = useCallback((segment: AudioSegment) => {
    setPlaylist((prev) => [...prev, segment]);
    if (!isPlaying && audioRef.current && (audioRef.current.paused || audioRef.current.ended)) {
      playNextSegment();
    }
  }, [isPlaying, playNextSegment]);

  return {
    isPlaying,
    isLoading,
    volume,
    setVolume,
    togglePlay,
    addSegment,
    audioRef,
  };
}
