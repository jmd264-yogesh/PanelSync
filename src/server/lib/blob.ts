import { put } from '@vercel/blob';

export interface StoredResumeBlob {
  fileKey: string; // full blob URL — resolved server-side only, never sent to the client
  contentType: string;
}

class BlobService {
  async uploadResume(candidateId: string, buffer: Buffer, filename: string, contentType: string): Promise<StoredResumeBlob> {
    const blob = await put(`resumes/${candidateId}/${Date.now()}-${filename}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return { fileKey: blob.url, contentType };
  }

  async fetchResume(fileKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await fetch(fileKey);
    if (!res.ok) {
      throw new Error(`Failed to fetch resume blob (${res.status})`);
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }
}

export const blob = new BlobService();
