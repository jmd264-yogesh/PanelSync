/**
 * Slot Validation Utilities
 *
 * Functions for validating time slots in interview scheduling
 */

import { TimeSlot, SlotValidationResult } from "@/common/types/availability";

/**
 * Checks if a slot's start time is in the past
 * @param slot - The time slot to check
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns true if the slot has expired
 */
export function isSlotExpired(
  slot: TimeSlot,
  currentTime: number = Date.now()
): boolean {
  const startTime = new Date(slot.startTime).getTime();
  return startTime < currentTime;
}

/**
 * Validates that a slot has valid date/time parameters
 * @param slot - The time slot to validate
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns Validation result with reason if invalid
 */
export function validateSlotTime(
  slot: TimeSlot,
  currentTime: number = Date.now()
): SlotValidationResult {
  const startObj = new Date(slot.startTime);
  const endObj = new Date(slot.endTime);

  // Check for valid date objects
  if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
    return { valid: false, reason: "Invalid date or time parameters." };
  }

  // Check if slot is in the past
  if (startObj.getTime() < currentTime) {
    return { valid: false, reason: "Cannot add available slots in the past." };
  }

  // Check that end time is after start time
  if (endObj.getTime() <= startObj.getTime()) {
    return { valid: false, reason: "End time must be after start time." };
  }

  return { valid: true };
}

/**
 * Validates that a slot falls within the allowed date range
 * @param slot - The time slot to validate
 * @param minDate - Minimum allowed date (ISO string)
 * @param maxDate - Maximum allowed date (ISO string)
 * @returns Validation result with reason if invalid
 */
export function validateSlotRange(
  slot: TimeSlot,
  minDate: string,
  maxDate: string
): SlotValidationResult {
  const startObj = new Date(slot.startTime);
  const endObj = new Date(slot.endTime);

  const startOfDay = new Date(minDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(maxDate);
  endOfDay.setHours(23, 59, 59, 999);

  if (
    startObj.getTime() < startOfDay.getTime() ||
    endObj.getTime() > endOfDay.getTime()
  ) {
    const minDateStr = new Date(minDate).toLocaleDateString("en-US");
    const maxDateStr = new Date(maxDate).toLocaleDateString("en-US");
    return {
      valid: false,
      reason: `Slots must be within the recruiter's requested date range (${minDateStr} to ${maxDateStr}).`,
    };
  }

  return { valid: true };
}

/**
 * Validates that a slot duration meets the minimum required duration
 * @param slot - The time slot to validate
 * @param minDurationMins - Minimum required duration in minutes
 * @returns Validation result with reason if invalid
 */
export function validateSlotDuration(
  slot: TimeSlot,
  minDurationMins: number
): SlotValidationResult {
  const startObj = new Date(slot.startTime);
  const endObj = new Date(slot.endTime);

  const durationMin = (endObj.getTime() - startObj.getTime()) / (60 * 1000);

  if (durationMin < minDurationMins) {
    return {
      valid: false,
      reason: `The selected slot duration (${durationMin} mins) is shorter than the required interview duration (${minDurationMins} mins).`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive slot validation combining all checks
 * @param slot - The time slot to validate
 * @param minDate - Minimum allowed date (ISO string)
 * @param maxDate - Maximum allowed date (ISO string)
 * @param minDurationMins - Minimum required duration in minutes
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns Validation result with reason if invalid
 */
export function validateSlot(
  slot: TimeSlot,
  minDate: string,
  maxDate: string,
  minDurationMins: number,
  currentTime: number = Date.now()
): SlotValidationResult {
  // Check time validity
  const timeValidation = validateSlotTime(slot, currentTime);
  if (!timeValidation.valid) {
    return timeValidation;
  }

  // Check range validity
  const rangeValidation = validateSlotRange(slot, minDate, maxDate);
  if (!rangeValidation.valid) {
    return rangeValidation;
  }

  // Check duration validity
  const durationValidation = validateSlotDuration(slot, minDurationMins);
  if (!durationValidation.valid) {
    return durationValidation;
  }

  return { valid: true };
}
