/**
 * useRejection Hook
 *
 * Manages rejection state and actions for panel nominations
 */

import { useState } from "react";
import { InterviewPanel } from "@server/lib/db";

interface UseRejectionProps {
  panel: InterviewPanel;
  onError: (msg: string) => void;
}

interface UseRejectionReturn {
  isRejected: boolean;
  rejectReason: string;
  showRejectForm: boolean;
  isRejecting: boolean;
  setRejectReason: (reason: string) => void;
  setShowRejectForm: (show: boolean) => void;
  handleRejectRequest: () => Promise<void>;
}

export function useRejection({
  panel,
  onError,
}: UseRejectionProps): UseRejectionReturn {
  const [isRejected, setIsRejected] = useState(panel.status === "REJECTED");
  const [rejectReason, setRejectReason] = useState(panel.feedback || "");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleRejectRequest = async () => {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    onError("");

    try {
      const res = await fetch("/api/availability/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          reason: rejectReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline request.");
      }

      setIsRejected(true);
    } catch (err) {
      console.error(err);
      onError(
        (err as Error).message ||
          "An error occurred while declining the request."
      );
    } finally {
      setIsRejecting(false);
    }
  };

  return {
    isRejected,
    rejectReason,
    showRejectForm,
    isRejecting,
    setRejectReason,
    setShowRejectForm,
    handleRejectRequest,
  };
}
