"use client";

import React from "react";

interface ModalContainerProps {
  children: React.ReactNode;
  maxWidth?: string;
  onBackdropClick?: () => void;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
  children,
  maxWidth = "900px",
  onBackdropClick,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onBackdropClick}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          width: "90%",
          maxWidth,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
