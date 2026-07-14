import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { getStreamUrl, getPlaylist } from '../lib/api';
import type { AudioSegment, Language } from '../types';

interface UseAudioPlayerOptions {
  city: string;
  language: Language;
  useHls: boolean;
  streamUrl?: string | null;
  onError?: (message: string) => void;
}

export function useAudioPlayer({ city, language, useHls, streamUrl, onError }: UseAudioPlayerOptions) {
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
  const onErrorRef = useRef(onError);
  streamUrlRef.current = streamUrl;
  languageRef.current = language;
  onErrorRef.current = onError;

  const hlsRef = useRef<Hls | null>(null);
  const connectHlsRef = useRef<() => void>(() => {});

  const clearLoadingTimeout = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const disconnectHls = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) audioRef.current.src = '';
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!wantPlayingRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (!wantPlayingRef.current) return;
      connectHlsRef.current();
    }, 2000);
  }, []);

  const connectHls = useCallback(() => {
    const audio = audioRef.current;
    const hlsUrl = getStreamUrl(languageRef.current, streamUrlRef.current);
    if (!audio || !hlsUrl) {
      clearLoadingTimeout();
      setIsLoading(false);
      if (!hlsUrl) onErrorRef.current?.('Stream URL topilmadi (radio holati yuklanmagan)');
      return;
    }

    disconnectHls();

    // Safari/iOS — native HLS qo'llab-quvvatlaydi, hls.js shart emas
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = hlsUrl;
      audio.play().catch((err) => {
        clearLoadingTimeout();
        setIsLoading(false);
        onErrorRef.current?.(`Audio play xatosi: ${err?.name || err}`);
      });
      return;
    }

    if (!Hls.isSupported()) {
      clearLoadingTimeout();
      setIsLoading(false);
      onErrorRef.current?.('Bu brauzer/WebView HLS audio\'ni qo\'llab-quvvatlamaydi (MediaSource yo\'q)');
      return;
    }

    const hls = new Hls();
    hlsRef.current = hls;
    hls.loadSource(hlsUrl);
    hls.attachMedia(audio);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      audio.play().catch((err) => {
        clearLoadingTimeout();
        setIsLoading(false);
        onErrorRef.current?.(`Audio play xatosi: ${err?.name || err}`);
      });
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      setIsPlaying(false);
      onErrorRef.current?.(`HLS xatosi: ${data.type}/${data.details}`);
      scheduleReconnect();
    });
  }, [disconnectHls, scheduleReconnect]);

  useEffect(() => {
    connectHlsRef.current = connectHls;
  }, [connectHls]);

  // Audio element bir marta yaratiladi (playlist/HLS bir xil element)
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
      if (wantPlayingRef.current && audio.paused) {
        audio.play().catch(() => {
          clearLoadingTimeout();
          setIsLoading(false);
        });
      }
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.pause();
      audio.src = '';
      clearLoadingTimeout();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('canplay', onCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bir marta yaratiladi

  // Unmount bo'lganda HLS ulanishini yopamiz
  useEffect(() => {
    return () => disconnectHls();
  }, [disconnectHls]);

  // Playlist yuklash (non-HLS)
  useEffect(() => {
    if (!useHls) {
      getPlaylist(city).then(setPlaylist).catch(console.error);
    }
  }, [city, useHls]);

  // Til o'zgarganda — agar playing bo'lsa, yangi til oqimiga o'tamiz
  useEffect(() => {
    if (!useHls || !wantPlayingRef.current) return;
    connectHls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Foreground qaytganда tiklash
  useEffect(() => {
    if (!useHls) return;
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        wantPlayingRef.current &&
        audioRef.current?.paused
      ) {
        connectHls();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useHls]);

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
      if (useHls) {
        disconnectHls();
      } else {
        audio.pause();
      }
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
      if (useHls) {
        connectHls();
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
  }, [isPlaying, isLoading, useHls, connectHls, disconnectHls, volume, playlist, playNextSegment]);

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
