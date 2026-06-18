import { useState, useEffect, useRef, useCallback } from 'react';
import { getStreamUrl, getPlaylist } from '../lib/api';
import type { AudioSegment, Language } from '../types';

interface UseAudioPlayerOptions {
  city: string;
  language: Language;
  useIcecast: boolean;
}

export function useAudioPlayer({ city, language, useIcecast }: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playlist, setPlaylist] = useState<AudioSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audioRef.current = audio;

    if (!useIcecast) {
      audio.addEventListener('ended', handleSegmentEnded);
    }

    return () => {
      audio.pause();
      audio.src = '';
      if (!useIcecast) {
        audio.removeEventListener('ended', handleSegmentEnded);
      }
    };
  }, [useIcecast]);

  // Load playlist for non-Icecast mode
  useEffect(() => {
    if (!useIcecast) {
      loadPlaylistData();
    }
  }, [city, useIcecast]);

  // Update stream URL when language changes (Icecast mode)
  useEffect(() => {
    if (useIcecast && audioRef.current) {
      const streamUrl = getStreamUrl(language);
      if (audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
        if (isPlaying) {
          audioRef.current.play().catch(console.error);
        }
      }
    }
  }, [language, useIcecast, isPlaying]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const loadPlaylistData = async () => {
    try {
      const data = await getPlaylist(city);
      setPlaylist(data);
    } catch (e) {
      console.error('Failed to load playlist:', e);
    }
  };

  const handleSegmentEnded = useCallback(() => {
    playNextSegment();
  }, [playlist, currentSegmentIndex]);

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
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (useIcecast) {
        // Icecast mode - use stream URL
        if (!audioRef.current.src) {
          audioRef.current.src = getStreamUrl(language);
        }
      } else {
        // Playlist mode
        if (!audioRef.current.src && playlist.length > 0) {
          playNextSegment();
          setIsPlaying(true);
          return;
        }
      }

      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Failed to play audio:', e);
        setIsPlaying(false);
      }
    }
  }, [isPlaying, useIcecast, language, playlist, playNextSegment]);

  const addSegment = useCallback((segment: AudioSegment) => {
    setPlaylist((prev) => [...prev, segment]);
    
    // Auto-play if nothing is playing
    if (!isPlaying && audioRef.current && (audioRef.current.paused || audioRef.current.ended)) {
      playNextSegment();
    }
  }, [isPlaying, playNextSegment]);

  return {
    isPlaying,
    volume,
    setVolume,
    togglePlay,
    addSegment,
    audioRef,
  };
}
