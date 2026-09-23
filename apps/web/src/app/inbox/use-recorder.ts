"use client";

import { create } from "zustand";

type RecorderState = {
  recording: boolean;
  elapsedSeconds: number;
  setRecording: (recording: boolean) => void;
  setElapsedSeconds: (elapsedSeconds: number) => void;
};

export const useRecorder = create<RecorderState>((set) => ({
  recording: false,
  elapsedSeconds: 0,
  setRecording: (recording) => set({ recording }),
  setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds }),
}));
