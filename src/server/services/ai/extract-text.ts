import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

const MIN_TEXT_LENGTH = 200;

export class ResumeUnreadableError extends Error {
  constructor(message = "Couldn't read this resume as text — it may be a scanned/image-only file. Please re-upload a text-based PDF or DOCX.") {
    super(message);
    this.name = 'ResumeUnreadableError';
  }
}

export async function extractResumeText(buffer: Buffer, contentType: string): Promise<string> {
  let text: string;

  if (contentType === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } else if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new Error(`Unsupported resume file type: ${contentType}`);
  }

  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ResumeUnreadableError();
  }

  return trimmed;
}
