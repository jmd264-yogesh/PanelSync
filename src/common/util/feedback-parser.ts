/**
 * Shared utility functions for parsing feedback data across features
 */

/**
 * Safely parses feedback JSON string, returning null if invalid or non-JSON
 * @param rawFeedback - Raw feedback string from database
 * @returns Parsed JSON object or null
 */
export function parseFeedbackSafely(rawFeedback: string | null | undefined) {
  if (!rawFeedback) return null;
  if (rawFeedback.trim().startsWith("{")) {
    try {
      return JSON.parse(rawFeedback);
    } catch {
      return null;
    }
  }
  return null;
}
