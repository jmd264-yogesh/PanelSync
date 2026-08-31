'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  Volume2,
  Radio,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAudioRecorder } from '@/lib/recalibrate/useAudioRecorder';

export interface SavedAudioClip {
  id: string;
  title: string;
  duration: string;
  size: string;
  url: string;
  base64: string;
  mimeType: string;
}

interface LiveAudioRecorderProps {
  candidateName: string;
  roleTitle: string;
  isProcessing: boolean;
  onSubmitAudios: (audios: Array<{ audioBase64: string; mimeType: string }>) => Promise<void>;
  onRecordingChange?: (isRecording: boolean) => void;
  onCancel?: () => void;
}

export default function LiveAudioRecorder({
  candidateName,
  roleTitle,
  isProcessing,
  onSubmitAudios,
  onRecordingChange,
  onCancel,
}: LiveAudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    formattedDuration,
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
  } = useAudioRecorder();

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  const [savedClips, setSavedClips] = useState<SavedAudioClip[]>([]);

  // Multi-bar visualizer heights based on volume level
  const visualizerBars = [0.4, 0.7, 1.0, 0.85, 1.2, 0.6, 0.95, 1.1, 0.75, 0.5, 0.9, 0.65];

  const getFileSizeFormatted = (blob: Blob | null) => {
    if (!blob) return '0 KB';
    const sizeMb = blob.size / (1024 * 1024);
    if (sizeMb >= 1) {
      return `${sizeMb.toFixed(2)} MB`;
    }
    return `${(blob.size / 1024).toFixed(0)} KB`;
  };

  // Add the currently recorded live clip to the saved clips list and reset recorder for next take
  const handleSaveCurrentClipAndRecordMore = () => {
    if (!audioBlob || !audioBase64) return;

    const clipUrl = URL.createObjectURL(audioBlob);

    const newClip: SavedAudioClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Live Recording (Part ${savedClips.length + 1})`,
      duration: formattedDuration,
      size: getFileSizeFormatted(audioBlob),
      url: clipUrl,
      base64: audioBase64,
      mimeType,
    };

    setSavedClips((prev) => [...prev, newClip]);
    resetRecording();
  };

  const handleRemoveClip = (id: string) => {
    setSavedClips((prev) => prev.filter((c) => c.id !== id));
  };

  // Submit all collected audio clips (saved clips + current active clip if finished)
  const handleTranscribeAll = async () => {
    const allAudios: Array<{ audioBase64: string; mimeType: string }> = [];

    // Add previously saved clips
    for (const clip of savedClips) {
      allAudios.push({
        audioBase64: clip.base64,
        mimeType: clip.mimeType,
      });
    }

    // Add current live clip if not yet added to list
    if (audioBase64) {
      allAudios.push({
        audioBase64,
        mimeType,
      });
    }

    if (allAudios.length === 0) return;
    await onSubmitAudios(allAudios);
  };

  const totalAudioCount = savedClips.length + (audioBlob && audioBase64 ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.55 }}>
        Record the interview live directly from your microphone. You can record in multiple takes (e.g. Part 1, Part 2) and transcribe all parts together at once into a unified candidate evaluation.
      </p>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            padding: '0.75rem 0.9rem',
            borderRadius: '8px',
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: '#ef4444',
            fontSize: '0.82rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* List of Queued / Saved Audio Takes */}
      {savedClips.length > 0 && (
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            background: 'var(--bg-card)',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Volume2 size={13} className="text-primary" />
              <span>Recorded Parts ({savedClips.length})</span>
            </span>
            <span className="text-xs text-muted">Will transcribe in sequence</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
            {savedClips.map((clip, idx) => (
              <div
                key={clip.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  padding: '0.45rem 0.7rem',
                  borderRadius: '8px',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-glass)',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(124, 58, 237, 0.15)',
                      color: '#c084fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Part {idx + 1}</span>
                    <span className="text-xs text-muted" style={{ marginLeft: '0.4rem' }}>
                      ({clip.duration} • {clip.size})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <audio src={clip.url} controls style={{ height: '28px', width: '160px' }} />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleRemoveClip(clip.id)}
                    disabled={isProcessing}
                    title="Remove part"
                    style={{ padding: '0.25rem 0.45rem', color: '#ef4444', border: '1px solid rgba(220,38,38,0.2)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State 1: IDLE / READY TO RECORD */}
      {!isRecording && !audioBlob && (
        <div
          style={{
            border: '2px dashed var(--border-glass)',
            borderRadius: '16px',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(37, 99, 235, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <button
            type="button"
            onClick={startRecording}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563EB, #7c3aed)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.06)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(124, 58, 237, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.35)';
            }}
          >
            <Mic size={32} />
          </button>

          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {savedClips.length > 0 ? `Click to Record Part ${savedClips.length + 1}` : 'Click to Start Live Recording'}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              Microphone audio is captured locally and compressed in real time using Opus.
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              padding: '0.3rem 0.65rem',
              background: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border-glass)',
            }}
          >
            <Radio size={12} className="text-primary" />
            <span>Ready for {candidateName}</span>
          </div>
        </div>
      )}

      {/* State 2: ACTIVELY RECORDING OR PAUSED */}
      {isRecording && (
        <div
          style={{
            borderRadius: '16px',
            padding: '1.75rem 1.5rem',
            background: 'linear-gradient(180deg, rgba(220, 38, 38, 0.04) 0%, rgba(124, 58, 237, 0.03) 100%)',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          {/* Status Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isPaused ? '#f59e0b' : '#ef4444',
                boxShadow: isPaused ? 'none' : '0 0 10px rgba(239, 68, 68, 0.8)',
                animation: isPaused ? 'none' : 'pulse 1.5s infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: isPaused ? '#f59e0b' : '#ef4444',
              }}
            >
              {isPaused
                ? `Recording Paused ${savedClips.length > 0 ? `(Part ${savedClips.length + 1})` : ''}`
                : `Recording Live ${savedClips.length > 0 ? `(Part ${savedClips.length + 1})` : 'Interview'}`}
            </span>
          </div>

          {/* Large Digital Timer */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '2.5rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-main)',
              lineHeight: 1,
            }}
          >
            {formattedDuration}
          </div>

          {/* Dynamic Frequency / Volume Bar Visualizer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              height: '36px',
              padding: '0 1rem',
            }}
          >
            {visualizerBars.map((multiplier, idx) => {
              const baseHeight = isPaused ? 4 : Math.max(4, Math.min(32, Math.round((volumeLevel * multiplier * 0.35) + 4)));
              return (
                <div
                  key={idx}
                  style={{
                    width: '5px',
                    height: `${baseHeight}px`,
                    borderRadius: '3px',
                    background: isPaused
                      ? '#94a3b8'
                      : `linear-gradient(180deg, #7c3aed, #2563EB)`,
                    transition: 'height 0.08s ease-out',
                  }}
                />
              );
            })}
          </div>

          {/* Live Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            {isPaused ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={resumeRecording}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem' }}
              >
                <Play size={14} className="text-success" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                onClick={pauseRecording}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem' }}
              >
                <Pause size={14} />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm"
              onClick={stopRecording}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                background: 'rgba(220, 38, 38, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                fontWeight: 600,
              }}
            >
              <Square size={13} fill="currentColor" />
              <span>Finish Recording</span>
            </button>
          </div>
        </div>
      )}

      {/* State 3: RECORDING FINISHED / PREVIEW & ACTIONS */}
      {!isRecording && audioBlob && (
        <div
          style={{
            borderRadius: '16px',
            padding: '1.5rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(220, 38, 38, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Volume2 size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  {savedClips.length > 0 ? `Part ${savedClips.length + 1} Audio Captured` : 'Interview Audio Captured'}
                </div>
                <div className="text-xs text-muted">
                  Duration: {formattedDuration} • Size: {getFileSizeFormatted(audioBlob)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={resetRecording}
                disabled={isProcessing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
              >
                <RotateCcw size={12} />
                <span>Discard & Retake</span>
              </button>
            </div>
          </div>

          {/* Native Audio Playback Controls */}
          {audioUrl && (
            <div style={{ width: '100%' }}>
              <audio
                controls
                src={audioUrl}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Multi-Take Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleSaveCurrentClipAndRecordMore}
              disabled={isProcessing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: 'rgba(124, 58, 237, 0.1)',
                color: '#c084fc',
                border: '1px solid rgba(124, 58, 237, 0.25)',
              }}
            >
              <Plus size={13} />
              <span>+ Add & Record Another Part</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {onCancel && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onCancel}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={totalAudioCount === 0 || isProcessing}
                onClick={handleTranscribeAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 1rem' }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Transcribing & Scoring {totalAudioCount} Part{totalAudioCount > 1 ? 's' : ''}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>
                      Transcribe & Auto-Score {totalAudioCount > 1 ? `(${totalAudioCount} Parts)` : 'with AI'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle state bottom buttons if clips already exist in queue */}
      {!isRecording && !audioBlob && savedClips.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.25rem' }}>
          {onCancel && (
            <button type="button" className="btn btn-sm" onClick={onCancel} disabled={isProcessing}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isProcessing}
            onClick={handleTranscribeAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 1rem' }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Transcribing & Scoring {savedClips.length} Parts...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Transcribe & Auto-Score ({savedClips.length} Parts)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Idle / Initial Cancel button when queue is empty */}
      {!isRecording && !audioBlob && savedClips.length === 0 && onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
