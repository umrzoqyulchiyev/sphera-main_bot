import { useState, useEffect, useRef, useCallback } from 'react';
import { getStreamUrl, getPlaylist } from '../lib/api';
import type { AudioSegment, Language } from '../types';

interface UseAudioPlayerOptions {
  city: string;
  language: Language;
  useWebrtc: boolean;
  streamUrl?: string | null;
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // Ba'zi tarmoqlarda ICE gathering sekin — cheksiz kutmaymiz.
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 3000);
  });
}

export function useAudioPlayer({ city, language, useWebrtc, streamUrl }: UseAudioPlayerOptions) {
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const whepLocationRef = useRef<string | null>(null);
  const connectWebrtcRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const clearLoadingTimeout = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  // WHEP session'ni yopadi (PeerConnection + serverdagi resurs, best-effort).
  const disconnectWebrtc = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const pc = pcRef.current;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.close();
      pcRef.current = null;
    }
    const location = whepLocationRef.current;
    whepLocationRef.current = null;
    if (location) {
      fetch(location, { method: 'DELETE' }).catch(() => {});
    }
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const scheduleReconnect = useCallback((connect: () => void) => {
    if (!wantPlayingRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (!wantPlayingRef.current) return;
      connect();
    }, 2000);
  }, []);

  const connectWebrtc = useCallback(async () => {
    const audio = audioRef.current;
    const whepUrl = getStreamUrl(languageRef.current, streamUrlRef.current);
    if (!audio || !whepUrl) {
      clearLoadingTimeout();
      setIsLoading(false);
      return;
    }

    disconnectWebrtc();

    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      if (audioRef.current) audioRef.current.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearLoadingTimeout();
        setIsLoading(false);
        setIsPlaying(true);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setIsPlaying(false);
        if (wantPlayingRef.current) {
          scheduleReconnect(() => { connectWebrtcRef.current().catch(() => {}); });
        }
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      const resp = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp || '',
      });
      if (!resp.ok) throw new Error(`WHEP POST failed: ${resp.status}`);

      whepLocationRef.current = resp.headers.get('Location');
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      await audio.play();
    } catch (e) {
      console.error('connectWebrtc error:', e);
      disconnectWebrtc();
      clearLoadingTimeout();
      setIsLoading(false);
      scheduleReconnect(() => { connectWebrtcRef.current().catch(() => {}); });
    }
  }, [disconnectWebrtc, scheduleReconnect]);

  useEffect(() => {
    connectWebrtcRef.current = connectWebrtc;
  }, [connectWebrtc]);

  // Audio element bir marta yaratiladi (playlist/webrtc bir xil element)
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audio.preload = 'none';
    (audio as any).playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audioRef.current = audio;

    const onPause = () => {
      setIsPlaying(false);
    };
    const onCanPlay = () => {
      // Playlist rejimida brauzer tayyor bo'lganda play qilamiz
      if (wantPlayingRef.current && audio.paused) {
        audio.play().catch(() => {
          clearLoadingTimeout();
          setIsLoading(false);
        });
      }
    };

    audio.addEventListener('pause', onPause);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.pause();
      audio.src = '';
      audio.srcObject = null;
      clearLoadingTimeout();
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('canplay', onCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bir marta yaratiladi

  // Unmount bo'lganda WebRTC ulanishini yopamiz
  useEffect(() => {
    return () => disconnectWebrtc();
  }, [disconnectWebrtc]);

  // Playlist yuklash (non-WebRTC)
  useEffect(() => {
    if (!useWebrtc) {
      getPlaylist(city).then(setPlaylist).catch(console.error);
    }
  }, [city, useWebrtc]);

  // Til o'zgarganda — agar playing bo'lsa, yangi til oqimiga o'tamiz
  useEffect(() => {
    if (!useWebrtc || !wantPlayingRef.current) return;
    connectWebrtc().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Foreground qaytganда tiklash
  useEffect(() => {
    if (!useWebrtc) return;
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        wantPlayingRef.current &&
        pcRef.current?.connectionState !== 'connected'
      ) {
        connectWebrtc().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebrtc]);

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
      if (useWebrtc) {
        disconnectWebrtc();
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
      if (useWebrtc) {
        await connectWebrtc();
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
  }, [isPlaying, isLoading, useWebrtc, connectWebrtc, disconnectWebrtc, volume, playlist, playNextSegment]);

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
