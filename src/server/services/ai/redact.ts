// Strips obvious PII before resume text reaches the LLM. The panelist still sees
// the full resume via the viewer — only the AI extraction/generation pipeline sees this.
export function redactPII(text: string, name: string, email: string): string {
  let redacted = text;

  if (name.trim()) {
    const nameParts = name.trim().split(/\s+/).filter((p) => p.length > 1);
    for (const part of nameParts) {
      redacted = redacted.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), '[CANDIDATE]');
    }
  }

  if (email.trim()) {
    redacted = redacted.replaceAll(email.trim(), '[EMAIL]');
  }

  return redacted
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]')
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, '[PHONE]');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
