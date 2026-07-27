/**
 * Availability Types
 *
 * Type definitions for the availability submission and slot booking flows
 */

/**
 * Represents a time slot with optional UI state
 */
export interface TimeSlot {
  id?: string;
  startTime: string; // ISO 8601 datetime string
  endTime: string; // ISO 8601 datetime string
  selected?: boolean; // UI state for selection
  expired?: boolean; // Whether the slot is in the past
}

/**
 * Request payload for submitting availability (Flow B)
 */
export interface AvailabilitySubmission {
  token: string;
  slots: TimeSlot[];
}

/**
 * Request payload for booking selected slots (Flow A)
 */
export interface SlotBookingRequest {
  token: string;
  slots: TimeSlot[];
}

/**
 * Represents a booked meeting slot with Teams meeting info
 */
export interface BookedSlot {
  startTime: string; // ISO 8601 datetime string
  endTime: string; // ISO 8601 datetime string
  joinUrl: string; // Teams meeting join URL
  candidateName: string; // Name of candidate (or "Pending Assignment")
}

/**
 * Request payload for rejecting a panel nomination
 */
export interface RejectionRequest {
  token: string;
  reason: string;
}

/**
 * Validation result for slot operations
 */
export interface SlotValidationResult {
  valid: boolean;
  reason?: string;
}
