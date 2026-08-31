/**
 * Client-side Audio Downsampling & Compression Utility for Speech AI Transcription.
 * 
 * Takes any browser-supported audio source (live WebM/Opus recording, uploaded MP3, WAV, M4A, AAC, OGG)
 * and resamples it to a standardized 16kHz Mono audio stream before uploading.
 * 
 * 16kHz Mono captures 100% of human speech frequency information (up to 8kHz) while reducing
 * uncompressed stereo audio payloads by ~80-90%.
 */

export interface CompressedAudioResult {
  blob: Blob;
  base64: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  durationSeconds: number;
}

/**
 * Compresses and downsamples any audio File or Blob into 16kHz Mono PCM WAV format.
 */
export async function compressAudio(fileOrBlob: File | Blob): Promise<CompressedAudioResult> {
  const originalSize = fileOrBlob.size;

  const AudioCtxClass =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null;

  // Fallback for non-browser or unsupported environments
  if (!AudioCtxClass) {
    const base64 = await blobToBase64(fileOrBlob);
    return {
      blob: fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob]),
      base64,
      mimeType: fileOrBlob.type || 'audio/webm',
      originalSize,
      compressedSize: originalSize,
      durationSeconds: 0,
    };
  }

  const audioCtx = new AudioCtxClass();
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    const targetSampleRate = 16000; // Optimal 16kHz speech recognition standard
    const targetChannels = 1;       // 1 Channel = Mono
    const targetLength = Math.ceil(decoded.duration * targetSampleRate);

    // Fast offline hardware resampling
    const offlineCtx = new OfflineAudioContext(targetChannels, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(renderedBuffer);
    const base64 = await blobToBase64(wavBlob);

    return {
      blob: wavBlob,
      base64,
      mimeType: 'audio/wav',
      originalSize,
      compressedSize: wavBlob.size,
      durationSeconds: Math.round(decoded.duration),
    };
  } catch (err) {
    console.warn('Web Audio resampling fallback to direct base64 encoding:', err);
    const base64 = await blobToBase64(fileOrBlob);
    return {
      blob: fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob]),
      base64,
      mimeType: fileOrBlob.type || 'audio/webm',
      originalSize,
      compressedSize: originalSize,
      durationSeconds: 0,
    };
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Converts a Blob to a standard Base64 string (without the data URL prefix).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64Data = result.split(',')[1] || result;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes an AudioBuffer (16kHz Mono) into standard 16-bit PCM WAV binary format.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // Uncompressed PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = buffer.getChannelData(0);
  const dataSize = data.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM 16-bit audio samples with clipping protection
  let offset = 44;
  for (let i = 0; i < data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
