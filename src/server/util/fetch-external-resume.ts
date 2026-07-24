import dns from 'dns/promises';
import net from 'net';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB, matches file-validate.ts

export class ExternalResumeFetchError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
}

// Downloads a recruiter-supplied resume URL server-side (from the bulk Excel
// upload's "Resume Link" column). Guards against SSRF: only http(s), resolved
// hostname must not land on a private/loopback/link-local address, and
// redirects are rejected outright rather than followed to a second host.
export async function fetchExternalResume(url: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ExternalResumeFetchError('Resume link is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ExternalResumeFetchError('Resume link must be an http(s) URL.');
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new ExternalResumeFetchError('Could not resolve the resume link host.');
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ExternalResumeFetchError('Resume link points to a disallowed host.');
  }

  const res = await fetch(parsed.toString(), { redirect: 'error' });
  if (!res.ok) {
    throw new ExternalResumeFetchError(`Failed to download resume link (status ${res.status}).`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new ExternalResumeFetchError('The file at this resume link is larger than 10MB.');
  }

  return Buffer.from(arrayBuffer);
}
