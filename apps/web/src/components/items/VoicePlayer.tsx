"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { alertClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";
import { formatVoiceDuration } from "./format-voice-duration";

const WAVE_BARS = [
  30, 45, 60, 50, 70, 85, 60, 40,
  55, 75, 90, 80, 65, 50, 40, 60,
  70, 85, 75, 50, 40, 55, 70, 60,
  45, 30, 50, 75, 60, 40, 50, 80
];

type VoicePlayerProps = {
  itemId: string;
  durationSeconds: number;
};

export default function VoicePlayer({ itemId, durationSeconds }: VoicePlayerProps) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    
    const current = audioRef.current;
    if (current && !current.paused) {
      current.pause();
      setPlaying(false);
      return;
    }
    if (current) {
      try {
        if (current.currentTime >= current.duration) {
          current.currentTime = 0;
        }
        await current.play();
        setPlaying(true);
      } catch {
        setError(t("voice_play_error"));
      }
      return;
    }

    setLoading(true);
    try {
      // API call includes credentials automatically in api()
      const response = await api(`/items/${itemId}/file`);
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
      const bytes = await response.blob();
      const url = URL.createObjectURL(bytes);
      urlRef.current = url;
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        setPlaying(false);
      });

      await audio.play();
      setPlaying(true);
    } catch {
      setError(t("voice_play_error"));
    } finally {
      setLoading(false);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }

  const duration = durationSeconds;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const label = playing ? t("voice_pause") : t("voice_play");

  return (
    <div 
      className="flex w-full flex-col gap-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex w-full items-center gap-3 rounded-xl bg-rn-note-ink/5 p-2" dir="ltr">
        <button
          type="button"
          aria-label={label}
          disabled={loading}
          onClick={toggle}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rn-accent text-white shadow-sm hover:bg-rn-accent/90 disabled:opacity-50"
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-1" />}
        </button>

        <div className="relative flex h-10 flex-1 items-center">
          {/* Waves background */}
          <div className="absolute inset-0 flex items-center justify-between gap-[2px]">
            {WAVE_BARS.map((h, i) => (
              <div key={i} className="w-1 rounded-full bg-rn-note-ink/20" style={{ height: `${h}%` }} />
            ))}
          </div>
          
          {/* Active waves */}
          <div 
            className="absolute inset-0 flex items-center justify-between gap-[2px]"
            style={{ clipPath: `inset(0 ${100 - progressPercent}% 0 0)` }}
          >
            {WAVE_BARS.map((h, i) => (
              <div key={i} className="w-1 rounded-full bg-rn-accent" style={{ height: `${h}%` }} />
            ))}
          </div>

          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            onClick={(e) => { e.stopPropagation(); }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="shrink-0 text-right text-xs font-medium text-rn-note-ink/70 tabular-nums">
          {formatVoiceDuration(currentTime)} / {formatVoiceDuration(duration)}
        </div>
      </div>
      
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
