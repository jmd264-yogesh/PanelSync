const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB

const SIGNATURES: { contentType: string; bytes: number[] }[] = [
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4b, 0x03, 0x04] }, // DOCX (zip)
];

export class InvalidResumeFileError extends Error {}

// Sniffs magic bytes rather than trusting the client-supplied extension/MIME type.
export function validateResumeFile(buffer: Buffer): { contentType: string } {
  if (buffer.length === 0) {
    throw new InvalidResumeFileError('The uploaded file is empty.');
  }
  if (buffer.length > MAX_RESUME_BYTES) {
    throw new InvalidResumeFileError('Resume files must be 10MB or smaller.');
  }

  const match = SIGNATURES.find((sig) => sig.bytes.every((b, i) => buffer[i] === b));
  if (!match) {
    throw new InvalidResumeFileError('Only PDF or DOCX resumes are supported.');
  }

  return { contentType: match.contentType };
}
