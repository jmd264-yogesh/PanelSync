'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  User,
  Users,
  Mic,
  Upload,
  Sparkles,
  CheckCheck,
  Radio,
  FileAudio,
  Volume2,
  Trash2,
} from 'lucide-react';
import { SectionHeader } from '@/components/recalibrate/primitives';
import { formatTimestamp, type SpeakerRole, type TranscriptAnalysis } from '@/lib/transcript';
import type { AiTranscriptEvaluation, TranscriptDialogueTurn } from '@/lib/db';
import LiveAudioRecorder, { type CapturedAudioSummary } from './LiveAudioRecorder';
import { compressAudio } from '@/lib/recalibrate/audioCompressor';

interface TranscriptPanelProps {
  interviewId: string;
  candidateName: string;
  roleTitle: string;
  transcriptText?: string | null;
  transcriptTurns?: TranscriptDialogueTurn[] | null;
  aiEvaluation?: AiTranscriptEvaluation | null;
  transcriptFetchedAt?: string | null;
  transcriptSource?: string | null;
  isProcessingTranscript?: boolean;
  onFetchFromTeams?: () => Promise<void>;
  onUploadTranscript?: (text: string) => Promise<void>;
  onUploadAudio?: (audios: Array<{ audioBase64: string; mimeType: string; duration?: string; startingTimestamp?: string }>, sourceType?: string) => Promise<void>;
  onAcceptAllAiScores?: () => Promise<void>;
  onAcceptSingleQuestionScore?: (questionId: string, score: number) => void;
  onApplyAiSummaryToNotes?: () => void;
  questions?: Array<{ id: string; question: string; category: string }>;
}

const ROLE_STYLE: Record<SpeakerRole, { color: string; label: string }> = {
  candidate: { color: 'var(--rc-brand, #7c3aed)', label: 'Candidate' },
  panelist: { color: 'var(--info, #0ea5e9)', label: 'Panel' },
  unknown: { color: 'var(--text-muted)', label: 'Dialogue' },
};

export default function TranscriptPanel({
  interviewId,
  candidateName,
  roleTitle,
  transcriptText,
  transcriptTurns,
  aiEvaluation,
  transcriptFetchedAt,
  transcriptSource,
  isProcessingTranscript = false,
  onFetchFromTeams,
  onUploadTranscript,
  onUploadAudio,
  onAcceptAllAiScores,
  onAcceptSingleQuestionScore,
  onApplyAiSummaryToNotes,
  questions = [],
}: TranscriptPanelProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'upload' | 'teams'>('live');
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [graphAnalysis, setGraphAnalysis] = useState<TranscriptAnalysis | null>(null);
  const [capturedAudio, setCapturedAudio] = useState<CapturedAudioSummary | null>(null);

  // Load any existing Graph VTT analysis on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}/transcript`);
        const json = await res.json();
        if (!cancelled && res.ok && json.analysis) {
          setGraphAnalysis(json.analysis);
        }
      } catch {
        // Fallback silently if not available
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId]);

  const hasTranscript = Boolean((transcriptText && transcriptText.trim().length > 0) || (transcriptTurns && transcriptTurns.length > 0));

  const turns: TranscriptDialogueTurn[] = transcriptTurns && transcriptTurns.length > 0
    ? transcriptTurns
    : (transcriptText
      ? transcriptText.split('\n').filter((l) => l.trim().length > 0).map((l): TranscriptDialogueTurn => ({ speaker: 'Dialogue', text: l }))
      : []);

  const handleManualUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || !onUploadTranscript) return;
    await onUploadTranscript(manualText);
    setManualText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);

    // Audio file upload
    if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.m4a') || file.name.endsWith('.wav') || file.name.endsWith('.webm') || file.name.endsWith('.ogg') || file.name.endsWith('.aac')) {
      if (!onUploadAudio) return;
      setIsCompressing(true);
      try {
        const compressed = await compressAudio(file);
        await onUploadAudio([{
          audioBase64: compressed.base64,
          mimeType: compressed.mimeType,
          startingTimestamp: new Date(file.lastModified || Date.now()).toISOString(),
        }], 'audio_upload');
      } catch (err) {
        console.error('Failed to compress audio file:', err);
      } finally {
        setIsCompressing(false);
      }
    } else {
      // Text / VTT file
      const text = await file.text();
      if (onUploadTranscript && text.trim()) {
        await onUploadTranscript(text);
      }
    }
  };

  const handleTeamsSyncClick = async () => {
    setSyncError(null);
    try {
      if (onFetchFromTeams) {
        await onFetchFromTeams();
      } else {
        const res = await fetch(`/api/interviews/${interviewId}/transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'graph' }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not fetch the transcript from Teams.');
        if (json.analysis) setGraphAnalysis(json.analysis);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Could not fetch the transcript.');
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.4rem 1.25rem',
        border: '1px solid rgba(124, 58, 237, 0.28)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        minHeight: '420px',
        overflowX: 'hidden',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              flexShrink: 0,
            }}
          >
            <FileText size={15} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
              Interview Audio & Transcript
            </h4>
          </div>
        </div>
        {isProcessingTranscript && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <Loader2 size={13} className="animate-spin text-muted" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, maxWidth: '100%', flex: 1 }}>
          {/* Action Tabs: Record / Upload / Teams aligned in 3 equal columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.35rem',
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              padding: '0.3rem',
              minWidth: 0,
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'live' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('live')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.5rem 0.25rem',
                borderRadius: '7px',
                whiteSpace: 'nowrap',
                minWidth: 0,
                width: '100%',
              }}
            >
              <Mic size={13} style={{ flexShrink: 0 }} />
              <span>Record</span>
              {isLiveRecording ? (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
                    flexShrink: 0,
                  }}
                />
              ) : (capturedAudio && capturedAudio.totalCount > 0) ? (
                <span
                  style={{
                    background: activeTab === 'live' ? 'rgba(255, 255, 255, 0.25)' : 'var(--rc-brand, #7c3aed)',
                    color: '#fff',
                    borderRadius: '999px',
                    padding: '0.02rem 0.35rem',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {capturedAudio.totalCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : ''}`}
              onClick={() => !isLiveRecording && setActiveTab('upload')}
              disabled={isLiveRecording}
              title={isLiveRecording ? 'Live recording is in progress' : 'Upload Audio / Text'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.5rem 0.25rem',
                borderRadius: '7px',
                opacity: isLiveRecording ? 0.45 : 1,
                cursor: isLiveRecording ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                minWidth: 0,
                width: '100%',
              }}
            >
              <Upload size={13} style={{ flexShrink: 0 }} />
              <span>Upload</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'teams' ? 'btn-primary' : ''}`}
              onClick={() => !isLiveRecording && setActiveTab('teams')}
              disabled={isLiveRecording}
              title={isLiveRecording ? 'Live recording is in progress' : 'Teams Sync'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.5rem 0.25rem',
                borderRadius: '7px',
                opacity: isLiveRecording ? 0.45 : 1,
                cursor: isLiveRecording ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                minWidth: 0,
                width: '100%',
              }}
            >
              <RefreshCw size={13} style={{ flexShrink: 0 }} />
              <span>Teams</span>
            </button>
          </div>

          {/* Tab 1: Live Record (kept mounted so recording state and clips never disappear on tab switch) */}
          <div style={{ display: activeTab === 'live' ? 'flex' : 'none', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
            <LiveAudioRecorder
              candidateName={candidateName}
              roleTitle={roleTitle}
              isProcessing={isProcessingTranscript}
              onRecordingChange={setIsLiveRecording}
              onAudioCapturedChange={setCapturedAudio}
              onSubmitAudios={async (audios) => {
                if (onUploadAudio) {
                  await onUploadAudio(audios, 'live_recording');
                }
              }}
            />
          </div>

          {/* Tab 2: Upload Audio or Text File */}
          <div style={{ display: activeTab === 'upload' ? 'flex' : 'none', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              style={{
                border: '2px dashed var(--border-glass)',
                borderRadius: '14px',
                padding: '1.25rem 1rem',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(124, 58, 237, 0.12)',
                  color: 'var(--rc-brand, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Upload size={18} />
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Audio or Transcript File</div>
              <div className="text-xs text-muted">Supports MP3, M4A, WAV, WebM, TXT, VTT</div>
              <label
                className="btn btn-sm btn-primary"
                style={{
                  cursor: isProcessingTranscript || isCompressing ? 'not-allowed' : 'pointer',
                  marginTop: '0.35rem',
                  fontSize: '0.76rem',
                  padding: '0.4rem 0.9rem',
                }}
              >
                Choose File
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac,.txt,.vtt"
                  onChange={handleFileUpload}
                  disabled={isProcessingTranscript || isCompressing}
                  style={{ display: 'none' }}
                />
              </label>
              {isCompressing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem', fontSize: '0.72rem', color: '#c084fc' }}>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Compressing to 16kHz Mono for speech AI...</span>
                </div>
              )}
            </div>

            <form onSubmit={handleManualUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Or Paste Transcript Text Directly</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Paste interview notes or transcript text here..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                disabled={isProcessingTranscript}
                style={{ fontSize: '0.78rem' }}
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={!manualText.trim() || isProcessingTranscript}
                style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem' }}
              >
                {isProcessingTranscript ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Evaluate Transcript</span>
              </button>
            </form>
          </div>

          {/* Tab 3: Teams Sync */}
          <div
            style={{
              display: activeTab === 'teams' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '0.85rem',
              border: '1px solid var(--border-glass)',
              borderRadius: '14px',
              padding: '1.25rem 1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Microsoft Teams Sync</div>
              <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0', lineHeight: 1.5, maxWidth: '240px' }}>
                Pull recorded meeting transcript directly via Microsoft Graph API.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleTeamsSyncClick}
              disabled={isProcessingTranscript}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.78rem' }}
            >
              {isProcessingTranscript ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>Fetch from Teams</span>
            </button>

            {syncError && (
              <div
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem',
                  fontSize: '0.74rem', lineHeight: 1.5, borderRadius: '8px',
                  borderLeft: '3px solid var(--warning, #f59e0b)',
                  background: 'var(--warning-glow, rgba(245,158,11,0.08))',
                  textAlign: 'left',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span>{syncError}</span>
              </div>
            )}
          </div>



          {/* Teams Talk-Time Metrics (if available) */}
          {/* {graphAnalysis && graphAnalysis.segments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-glass)' }}>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                  Candidate talk time
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {graphAnalysis.candidateTalkShare !== null ? `${Math.round(graphAnalysis.candidateTalkShare * 100)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                  Duration
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {formatTimestamp(graphAnalysis.durationMs)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                  Total Words
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {graphAnalysis.totalWords}
                </div>
              </div>
            </div>
          )} */}

          {/* Directly Embedded Transcript Stream */}
          {/* {hasTranscript && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Transcript ({turns.length} dialogue turns)
                </span>
                {transcriptFetchedAt && (
                  <span className="text-xs text-muted" style={{ fontSize: '0.68rem' }}>
                    {new Date(transcriptFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                paddingRight: '0.3rem',
                fontSize: '0.78rem',
                lineHeight: 1.55,
              }}>
                {turns.map((turn, i) => {
                  const isCand = turn.speaker.toLowerCase().includes(candidateName.toLowerCase().split(' ')[0]) || turn.speaker.toLowerCase().includes('candidate');
                  const speakerColor = isCand ? 'var(--rc-brand, #a855f7)' : 'var(--info, #0ea5e9)';
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
                        {turn.timestamp && (
                          <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                            [{turn.timestamp}]
                          </span>
                        )}
                        <strong style={{ color: speakerColor }}>{turn.speaker}:</strong>
                      </div>
                      <p style={{ margin: 0, paddingLeft: '0.3rem', color: 'var(--text-main)' }}>
                        {turn.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )} */}
        </div>
    </div>
  );
}
