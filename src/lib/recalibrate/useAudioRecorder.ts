'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { fixWebmDuration } from './fixWebmDuration';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  formattedDuration: string;
  volumeLevel: number;
  audioBlob: Blob | null;
  audioBase64: string | null;
  audioUrl: string | null;
  mimeType: string;
  error: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('audio/webm');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const elapsedMsRef = useRef<number>(0);

  // Format seconds to HH:MM:SS or MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Helper to determine optimal supported mimeType
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  // Clean up Web Audio analyser loop
  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumeLevel(0);
  }, []);

  // Clean up MediaStream hardware tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Clean up timer
  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setAudioBase64(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    elapsedMsRef.current = 0;

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup audio analysis for live waveform visualization
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            // Normalize to 0 - 100 with sensitivity curve
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            setVolumeLevel(normalized);
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (err) {
        console.warn('AudioContext visualization setup skipped:', err);
      }

      const selectedType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        ...(selectedType ? { mimeType: selectedType } : {}),
        audioBitsPerSecond: 24000, // 24 kbps speech-optimized bitrate (Opus mono)
      };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      setMimeType(mediaRecorder.mimeType || selectedType || 'audio/webm');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mime = mediaRecorder.mimeType || selectedType || 'audio/webm';
        const rawBlob = new Blob(chunksRef.current, { type: mime });

        // Calculate exact duration in ms
        const activeDurationMs = startTimeRef.current > 0 ? Date.now() - startTimeRef.current : 0;
        const totalDurationMs = Math.max(1000, elapsedMsRef.current + activeDurationMs);

        // Inject duration metadata into WebM header so Chrome can display duration and enable seeking!
        let finalBlob = rawBlob;
        if (mime.includes('webm')) {
          try {
            finalBlob = await fixWebmDuration(rawBlob, totalDurationMs);
          } catch (fixErr) {
            console.warn('fixWebmDuration skipped:', fixErr);
          }
        }

        setAudioBlob(finalBlob);
        setMimeType(mime);

        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);

        // Convert Blob to Base64 directly for API transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const base64Data = result.split(',')[1] || result;
          setAudioBase64(base64Data);
        };
        reader.readAsDataURL(finalBlob);

        stopAnalyser();
        stopStream();
        stopTimer();
      };

      // Request data every 1 second for smooth chunking
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      // Start elapsed timer
      stopTimer();
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Failed to access microphone:', err);
      stopAnalyser();
      stopStream();
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);
      const message = err instanceof Error ? err.message : 'Microphone access was denied or failed.';
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError('Microphone permission was denied. Please allow microphone access in your browser settings to record the interview.');
      } else {
        setError(`Failed to start recording: ${message}`);
      }
    }
  }, [audioUrl, stopAnalyser, stopStream, stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (startTimeRef.current > 0) {
        elapsedMsRef.current += Date.now() - startTimeRef.current;
        startTimeRef.current = 0;
      }
      stopTimer();
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend().catch(() => {});
      }
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now();
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      stopTimer();
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  }, [stopTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopAnalyser();
      stopStream();
      stopTimer();
    }
    setIsRecording(false);
    setIsPaused(false);
  }, [stopAnalyser, stopStream, stopTimer]);

  const resetRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setAudioBase64(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    setVolumeLevel(0);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl, stopRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAnalyser();
      stopStream();
      stopTimer();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, stopAnalyser, stopStream, stopTimer]);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration),
    volumeLevel,
    audioBlob,
    audioBase64,
    audioUrl,
    mimeType,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
