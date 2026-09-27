"use client";

import { TEXT_MAX_LENGTH, VOICE_MAX_SECONDS } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonClass, fieldClass, labelClass } from "@/lib/ui-classes";
import { formatVoiceDuration } from "@/components/items/format-voice-duration";
import { Mic, Square, Loader2 } from "lucide-react";
import { useRecorder } from "./use-recorder";
import { translateIssue, useT } from "@/lib/use-t";

const WAVE_BARS = [
  30, 45, 60, 50, 70, 85, 60, 40,
  55, 75, 90, 80, 65, 50, 40, 60,
  70, 85, 75, 50, 40, 55, 70, 60,
  45, 30, 50, 75, 60, 40, 50, 80
];

type RecorderMime = "audio/webm" | "audio/ogg";

function recorderMime(): RecorderMime | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  if (MediaRecorder.isTypeSupported("audio/ogg")) {
    return "audio/ogg";
  }
  return null;
}

export default function VoiceCapture() {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const recording = useRecorder((state) => state.recording);
  const elapsedSeconds = useRecorder((state) => state.elapsedSeconds);
  const setRecording = useRecorder((state) => state.setRecording);
  const setElapsedSeconds = useRecorder((state) => state.setElapsedSeconds);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const stoppingRef = useRef(false);
  const cancelRef = useRef(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Dev mode runs this cleanup once on startup. The next run must be allowed to record.
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      setRecording(false);
      setElapsedSeconds(0);
    };
  }, [setElapsedSeconds, setRecording]);

  function stopRecording() {
    if (stoppingRef.current) {
      return;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }
    stoppingRef.current = true;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorder.stop();
  }

  async function upload(blob: Blob, mime: RecorderMime) {
    const extension = mime === "audio/ogg" ? "ogg" : "webm";
    const form = new FormData();
    form.append("audio", new File([blob], `clip.${extension}`, { type: mime }));
    form.append("duration_seconds", String(elapsedRef.current));
    const note = noteInputRef.current?.value ?? "";
    if (note.trim() !== "") {
      form.append("note", note);
    }
    setUploading(true);
    const toastId = toast.loading(t("saving"));
    try {
      const response = await api("/items/voice", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    } finally {
      setUploading(false);
      stoppingRef.current = false;
    }

    elapsedRef.current = 0;
    setElapsedSeconds(0);
    if (noteInputRef.current) {
      noteInputRef.current.value = "";
    }
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    toast.success(t("saved"), { id: toastId });
  }

  async function startRecording() {
    if (recording || uploading || stoppingRef.current) {
      return;
    }
    setError(null);
    const mime = recorderMime();
    if (!mime) {
      const message = t("voice_unsupported");
      setError(message);
      toast.error(message);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      const message = t("voice_mic_denied");
      setError(message);
      toast.error(message);
      return;
    }
    if (cancelRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    // 32 kbps keeps a 10-minute clip near 2.4 MB, under VOICE_MAX_BYTES.
    const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      if (cancelRef.current) {
        stoppingRef.current = false;
        return;
      }
      const blob = new Blob(chunks, { type: mime });
      void upload(blob, mime);
    };

    recorderRef.current = recorder;
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setRecording(true);
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      const message = t("voice_unsupported");
      setError(message);
      toast.error(message);
      return;
    }

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      if (seconds >= VOICE_MAX_SECONDS) {
        elapsedRef.current = VOICE_MAX_SECONDS;
        setElapsedSeconds(VOICE_MAX_SECONDS);
        stopRecording();
        return;
      }
      elapsedRef.current = seconds;
      setElapsedSeconds(seconds);
    }, 200);
  }

  let buttonLabel = t("voice_start");
  if (recording) {
    buttonLabel = t("voice_stop_save");
  }
  if (uploading) {
    buttonLabel = t("saving");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="capture-voice-note">
          {t("note_optional")}
        </label>
        <textarea
          ref={noteInputRef}
          id="capture-voice-note"
          rows={3}
          maxLength={TEXT_MAX_LENGTH}
          disabled={uploading}
          dir="auto"
          className={fieldClass}
        />
      </div>
      <div className="flex w-full items-center gap-3 rounded-xl bg-rn-note-ink/5 p-2" dir="ltr">
        <button
          type="button"
          aria-label={buttonLabel}
          disabled={uploading}
          onClick={() => {
            if (recording) {
              stopRecording();
              return;
            }
            void startRecording();
          }}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-50 ${recording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-rn-accent hover:bg-rn-accent/90"}`}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : recording ? (
            <Square className="size-4 fill-current" />
          ) : (
            <Mic className="size-5" />
          )}
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
            style={{ clipPath: `inset(0 ${100 - (elapsedSeconds / VOICE_MAX_SECONDS) * 100}% 0 0)` }}
          >
            {WAVE_BARS.map((h, i) => (
              <div key={i} className={`w-1 rounded-full ${recording ? "bg-red-500" : "bg-rn-accent"}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="shrink-0 text-right text-xs font-medium text-rn-note-ink/70 tabular-nums">
          {formatVoiceDuration(elapsedSeconds)} / {formatVoiceDuration(VOICE_MAX_SECONDS)}
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
