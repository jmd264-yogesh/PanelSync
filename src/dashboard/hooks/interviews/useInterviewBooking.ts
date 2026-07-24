import { useState } from "react";
import { Interview } from "@server/lib/db";
import { toast } from "sonner";

interface UseInterviewBookingProps {
  selectedInterview: Interview | null;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  setSelectedInterview: React.Dispatch<React.SetStateAction<Interview | null>>;
}

interface UseInterviewBookingReturn {
  // Booking state
  selectedSlot: { start: string; end: string } | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<{ start: string; end: string } | null>>;
  bookingDescription: string;
  setBookingDescription: React.Dispatch<React.SetStateAction<string>>;
  isBooking: boolean;
  isCancellingBooking: boolean;

  // Actions
  bookSlot: () => Promise<void>;
  cancelBooking: () => Promise<void>;
}

export function useInterviewBooking(
  props: UseInterviewBookingProps
): UseInterviewBookingReturn {
  const { selectedInterview, interviews, setInterviews, setSelectedInterview } = props;

  // ── Booking State ──────────────────────────────────────────────────────────
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [bookingDescription, setBookingDescription] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const bookSlot = async () => {
    if (!selectedInterview || !selectedSlot) return;
    setIsBooking(true);
    try {
      const res = await fetch("/api/interviews/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          description: bookingDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to book meeting");
      }
      setInterviews(
        interviews.map((i) =>
          i.id === selectedInterview.id
            ? {
                ...i,
                status: "SCHEDULED" as const,
                scheduledSlotStart: selectedSlot.start,
                scheduledSlotEnd: selectedSlot.end,
              }
            : i,
        ),
      );
      setSelectedSlot(null);
      setBookingDescription("");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error scheduling meeting");
    } finally {
      setIsBooking(false);
    }
  };

  const cancelBooking = async () => {
    if (!selectedInterview) return;
    setIsCancellingBooking(true);
    try {
      const res = await fetch("/api/interviews/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: selectedInterview.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel booking");
      }
      const data = await res.json();
      setInterviews(
        interviews.map((i) =>
          i.id === selectedInterview.id ? data.interview : i,
        ),
      );
      setSelectedInterview(data.interview);
      toast.success(
        "Successfully cancelled meeting and removed scheduled slot.",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error cancelling meeting");
    } finally {
      setIsCancellingBooking(false);
    }
  };

  return {
    selectedSlot,
    setSelectedSlot,
    bookingDescription,
    setBookingDescription,
    isBooking,
    isCancellingBooking,
    bookSlot,
    cancelBooking,
  };
}
