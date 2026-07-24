import { useState, useEffect } from "react";
import { Interview } from "@server/lib/db";

interface UseInterviewModalsProps {
  interviews: Interview[];
}

export function useInterviewModals({ interviews }: UseInterviewModalsProps) {
  // ── Modal Visibility States ────────────────────────────────────────────────
  const [showRepliedModal, setShowRepliedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "overview" | "panels" | "booking" | "feedback"
  >("overview");

  // ── Selected Interview States ──────────────────────────────────────────────
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(
    null,
  );
  const [selectedInterviewForConfig, setSelectedInterviewForConfig] =
    useState<Interview | null>(null);

  // ── Effect: Sync Selected Interviews ───────────────────────────────────────
  // When interviews array updates (e.g., after booking, updating dates),
  // ensure selectedInterview and selectedInterviewForConfig reflect the latest data
  useEffect(() => {
    if (selectedInterview) {
      const updated = interviews.find((i) => i.id === selectedInterview.id);
      setSelectedInterview(updated || null);
    }
    if (selectedInterviewForConfig) {
      const updated = interviews.find(
        (i) => i.id === selectedInterviewForConfig.id,
      );
      setSelectedInterviewForConfig(updated || null);
    }
  }, [interviews, selectedInterview, selectedInterviewForConfig]);

  // ── Helper Functions ───────────────────────────────────────────────────────
  const openRepliedModal = () => setShowRepliedModal(true);
  const closeRepliedModal = () => setShowRepliedModal(false);

  const openFeedbackModal = () => setShowFeedbackModal(true);
  const closeFeedbackModal = () => setShowFeedbackModal(false);

  const openCreateForm = () => {
    setShowCreateForm(true);
    setSelectedInterview(null);
  };
  const closeCreateForm = () => setShowCreateForm(false);

  const openInterviewModal = (interview: Interview) => {
    setSelectedInterview(interview);
    setShowInterviewModal(true);
    setDetailTab("overview");
  };
  const closeInterviewModal = () => {
    setShowInterviewModal(false);
    setSelectedInterview(null);
  };

  const openConfigModal = (interview: Interview) => {
    setSelectedInterviewForConfig(interview);
  };
  const closeConfigModal = () => {
    setSelectedInterviewForConfig(null);
  };

  return {
    // States
    showRepliedModal,
    setShowRepliedModal,
    showFeedbackModal,
    setShowFeedbackModal,
    showCreateForm,
    setShowCreateForm,
    showInterviewModal,
    setShowInterviewModal,
    detailTab,
    setDetailTab,
    selectedInterview,
    setSelectedInterview,
    selectedInterviewForConfig,
    setSelectedInterviewForConfig,

    // Helper functions
    openRepliedModal,
    closeRepliedModal,
    openFeedbackModal,
    closeFeedbackModal,
    openCreateForm,
    closeCreateForm,
    openInterviewModal,
    closeInterviewModal,
    openConfigModal,
    closeConfigModal,
  };
}
