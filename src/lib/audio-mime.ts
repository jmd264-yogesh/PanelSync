// Interview audio is uploaded by the browser and later served back from the app's own
// origin, so its content type is user-controlled input. If it were echoed back as-is, a
// panelist could store "audio" that is really text/html and have it run as a page on the
// app origin for the next person who opens it. Only these real audio types are accepted,
// and anything else is rejected at upload and downgraded to a download when served.

const AUDIO_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

/** The canonical audio type for `raw` (parameters like ";codecs=opus" dropped), or null if it isn't a supported audio type. */
export function normalizeAudioMime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  return base in AUDIO_TYPES ? base : null;
}

export function extensionForAudioMime(mime: string): string {
  return AUDIO_TYPES[mime] ?? 'bin';
}
