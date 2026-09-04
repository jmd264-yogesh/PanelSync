import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.AWS_ENDPOINT_URL?.trim() || undefined;
const region = process.env.AWS_REGION?.trim() || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim() || 'panel-sync-audio';

// Configure S3 client (supports local Floci/LocalStack or real AWS in production)
export const s3Client = new S3Client({
  region,
  ...(endpoint ? { endpoint } : {}),
  // When using a custom local endpoint like Floci (http://localhost:4566), force path-style URLs
  // so requests go to http://localhost:4566/bucket instead of http://bucket.localhost:4566
  forcePathStyle: Boolean(endpoint),
  ...(accessKeyId && secretAccessKey
    ? {
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }
    : {}),
});

export function isS3Configured(): boolean {
  return Boolean(
    endpoint ||
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  );
}

export interface UploadAudioResult {
  key: string;
  bucket: string;
  location: string;
}

/**
 * Upload an interview audio buffer to S3 / Floci emulator.
 */
export async function uploadInterviewAudio({
  interviewId,
  buffer,
  mimeType,
  fileName,
}: {
  interviewId: string;
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
}): Promise<UploadAudioResult> {
  const safeName = (fileName || `${Date.now()}-recording.webm`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `interviews/${interviewId}/${safeName}`;
  const contentType = mimeType || 'audio/webm';

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (err: any) {
    // If running against local Floci/LocalStack and bucket was not yet created, auto-create it
    if ((err?.name === 'NoSuchBucket' || err?.Code === 'NoSuchBucket') && endpoint) {
      console.log(`[S3] Bucket "${bucketName}" not found on local endpoint. Creating bucket automatically...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
    } else {
      throw err;
    }
  }

  return {
    key,
    bucket: bucketName,
    location: `s3://${bucketName}/${key}`,
  };
}

/**
 * Convenience helper to upload base64 audio data directly to S3.
 */
export async function uploadAudioBase64({
  interviewId,
  audioBase64,
  mimeType,
  fileName,
}: {
  interviewId: string;
  audioBase64: string;
  mimeType?: string;
  fileName?: string;
}): Promise<UploadAudioResult> {
  // Strip optional data URI header (e.g. data:audio/webm;base64,...)
  const cleanBase64 = audioBase64.includes(',')
    ? audioBase64.split(',')[1]
    : audioBase64;

  const buffer = Buffer.from(cleanBase64, 'base64');
  return uploadInterviewAudio({
    interviewId,
    buffer,
    mimeType,
    fileName,
  });
}

/**
 * Generate a pre-signed download / streaming URL for an audio file stored in S3.
 */
export async function getAudioPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
