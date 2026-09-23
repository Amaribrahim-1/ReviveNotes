"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonSecondaryClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type VoicePlayButtonProps = {
  itemId: string;
};

export default function VoicePlayButton({ itemId }: VoicePlayButtonProps) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  async function toggle() {
    setError(null);
    const current = audioRef.current;
    if (current && !current.paused) {
      current.pause();
      setPlaying(false);
      return;
    }
    if (current) {
      try {
        await current.play();
        setPlaying(true);
      } catch {
        setError(t("voice_play_error"));
      }
      return;
    }

    setLoading(true);
    try {
      const response = await api(`/items/${itemId}/file`);
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
      const bytes = await response.blob();
      const url = URL.createObjectURL(bytes);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => {
        setPlaying(false);
      };
      audioRef.current = audio;
      await audio.play();
      setPlaying(true);
    } catch {
      setError(t("voice_play_error"));
    } finally {
      setLoading(false);
    }
  }

  const label = playing ? t("voice_stop") : t("voice_play");

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        aria-label={label}
        disabled={loading}
        onClick={() => {
          void toggle();
        }}
        className={buttonSecondaryClass}
      >
        {loading ? t("loading") : playing ? t("voice_pause") : t("voice_play_short")}
      </button>
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
