"use client";

import { TEXT_MAX_LENGTH, VOICE_MAX_SECONDS } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonClass, fieldClass, labelClass } from "@/lib/ui-classes";
import { formatVoiceDuration } from "@/components/items/format-voice-duration";
import { useRecorder } from "./use-recorder";

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
    const toastId = toast.loading("بنحفظ...");
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
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
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
    toast.success("اتحفظت", { id: toastId });
  }

  async function startRecording() {
    if (recording || uploading || stoppingRef.current) {
      return;
    }
    setError(null);
    const mime = recorderMime();
    if (!mime) {
      const message = "المتصفح مش بيدعم التسجيل";
      setError(message);
      toast.error(message);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      const message = "المتصفح منع الميكروفون";
      setError(message);
      toast.error(message);
      return;
    }
    if (cancelRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: mime });
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
      const message = "المتصفح مش بيدعم التسجيل";
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

  let buttonLabel = "سجّل";
  if (recording) {
    buttonLabel = "إيقاف وحفظ";
  }
  if (uploading) {
    buttonLabel = "بنحفظ...";
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="capture-voice-note">
          ملاحظة (اختياري)
        </label>
        <textarea
          ref={noteInputRef}
          id="capture-voice-note"
          rows={3}
          maxLength={TEXT_MAX_LENGTH}
          disabled={uploading}
          className={fieldClass}
        />
      </div>
      <p>
        المدة <span dir="ltr">{formatVoiceDuration(elapsedSeconds)}</span>
      </p>
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={uploading}
        onClick={() => {
          if (recording) {
            stopRecording();
            return;
          }
          void startRecording();
        }}
        className={buttonClass}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
