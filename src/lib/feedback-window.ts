// When a panelist may submit or change interview feedback.
//
// A panel's `status` becomes SUBMITTED, and `submittedAt` is stamped, when the panelist
// picks a slot — long before the interview happens. "Feedback has been given" therefore
// means a decision exists, and the edit window runs from the moment that decision was
// first recorded (submitPanelFeedback stamps `submittedAt` at that point). Treating
// `status === 'SUBMITTED'` as "already gave feedback" made the first feedback fail with
// "the 2-hour window expired" for any interview held more than 2 hours after booking.

export const FEEDBACK_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

export type FeedbackEditState = 'first' | 'editable' | 'expired';

export function feedbackEditState(
  panel: { decision?: string | null; submittedAt?: string | Date | null },
  now: number = Date.now(),
): FeedbackEditState {
  if (!panel.decision) return 'first';
  if (!panel.submittedAt) return 'editable';
  const elapsed = now - new Date(panel.submittedAt).getTime();
  return elapsed > FEEDBACK_EDIT_WINDOW_MS ? 'expired' : 'editable';
}
