'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  User,
  Users,
  Mic,
  Upload,
  Sparkles,
  CheckCheck,
  Radio,
  FileAudio,
} from 'lucide-react';
import { SectionHeader } from '@/components/recalibrate/primitives';
import { formatTimestamp, type SpeakerRole, type TranscriptAnalysis } from '@/lib/transcript';
import type { AiTranscriptEvaluation, TranscriptDialogueTurn } from '@/lib/db';
import LiveAudioRecorder from './LiveAudioRecorder';
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
  onUploadAudio?: (audios: Array<{ audioBase64: string; mimeType: string }>, sourceType?: string) => Promise<void>;
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
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'upload' | 'teams'>('live');
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [graphAnalysis, setGraphAnalysis] = useState<TranscriptAnalysis | null>(null);

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
        await onUploadAudio([{ audioBase64: compressed.base64, mimeType: compressed.mimeType }], 'audio_upload');
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
    <div className="glass-card" style={{ padding: '1.15rem', border: '1px solid rgba(124, 58, 237, 0.25)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Card Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SectionHeader icon={<FileText size={14} />} title="Interview Audio & Transcript" />
          {hasTranscript && (
            <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', textTransform: 'none' }}>
              {transcriptSource === 'live_recording'
                ? 'Live Recorded'
                : transcriptSource === 'audio_upload'
                ? 'Audio File'
                : transcriptSource === 'graph_api'
                ? 'Teams Synced'
                : 'Ready'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isProcessingTranscript && <Loader2 size={13} className="animate-spin text-muted" />}
          <ChevronDown
            size={16}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Action Tabs: Record Live / Upload / Teams */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.4rem', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'live' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('live')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}
            >
              <Mic size={12} />
              <span>Record Live</span>
              {isLiveRecording && (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
                  }}
                />
              )}
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
                gap: '0.35rem',
                fontSize: '0.74rem',
                opacity: isLiveRecording ? 0.45 : 1,
                cursor: isLiveRecording ? 'not-allowed' : 'pointer',
              }}
            >
              <Upload size={12} />
              <span>Upload Audio / Text</span>
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
                gap: '0.35rem',
                fontSize: '0.74rem',
                opacity: isLiveRecording ? 0.45 : 1,
                cursor: isLiveRecording ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} />
              <span>Teams Sync</span>
            </button>
          </div>

          {/* Tab 1: Live Record */}
          {activeTab === 'live' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <LiveAudioRecorder
                candidateName={candidateName}
                roleTitle={roleTitle}
                isProcessing={isProcessingTranscript}
                onRecordingChange={setIsLiveRecording}
                onSubmitAudios={async (audios) => {
                  if (onUploadAudio) {
                    await onUploadAudio(audios, 'live_recording');
                  }
                }}
              />
            </div>
          )}

          {/* Tab 2: Upload Audio or Text File */}
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Upload Audio File (.mp3, .m4a, .webm, .wav) or Transcript (.txt, .vtt)
                </label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac,.txt,.vtt"
                  className="form-input"
                  onChange={handleFileUpload}
                  disabled={isProcessingTranscript || isCompressing}
                  style={{ fontSize: '0.76rem', padding: '0.4rem' }}
                />
                {isCompressing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem', fontSize: '0.72rem', color: '#c084fc' }}>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Compressing to 16kHz Mono for speech AI...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleManualUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Or Paste Transcript Text Directly</label>
                <textarea
                  className="form-input"
                  rows={3}
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
                  style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isProcessingTranscript ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>Evaluate Transcript</span>
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Teams Sync */}
          {activeTab === 'teams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Sync recorded meeting transcript directly from Microsoft Teams via Microsoft Graph API.
              </p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleTeamsSyncClick}
                disabled={isProcessingTranscript}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start' }}
              >
                {isProcessingTranscript ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>Fetch from Teams</span>
              </button>

              {syncError && (
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem',
                    fontSize: '0.74rem', lineHeight: 1.5, borderRadius: '8px',
                    borderLeft: '3px solid var(--warning, #f59e0b)',
                    background: 'var(--warning-glow, rgba(245,158,11,0.08))',
                  }}
                >
                  <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                  <span>{syncError}</span>
                </div>
              )}
            </div>
          )}



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
      )}
    </div>
  );
}
