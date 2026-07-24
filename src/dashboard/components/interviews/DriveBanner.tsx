import React from "react";
import { Compass, Clock } from "lucide-react";
import { Drive } from "@server/lib/db";
import { formatDateRange } from "@common/util/date";

interface DriveBannerProps {
  drives: Drive[];
  selectedDriveId: string;
  onDriveChange: (driveId: string) => void;
  selectedDrive: Drive | null;
  activeDrive: Drive | null;
  activeHiringTab: "CAMPUS" | "LATERAL";
}

export const DriveBanner: React.FC<DriveBannerProps> = ({
  drives,
  selectedDriveId,
  onDriveChange,
  selectedDrive,
  activeDrive,
  activeHiringTab,
}) => {
  // Only render for Campus hiring
  if (activeHiringTab !== "CAMPUS") {
    return null;
  }

  return (
    <section className="drive-banner">
      <span className="drive-banner-label">
        <Compass size={16} /> Viewing Drive
      </span>
      <select
        className="drive-select"
        value={selectedDriveId}
        onChange={(e) => onDriveChange(e.target.value || "all")}
      >
        <option value="all">All Drives</option>
        {drives.map((d) => (
          <option key={d.id} value={d.id}>
            {d.collegeName}
            {d.status === "CLOSED" ? " (Closed)" : ""}
          </option>
        ))}
      </select>
      {selectedDrive ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <Clock size={13} style={{ color: "var(--info)" }} />
          <span>
            {formatDateRange(selectedDrive.startDate, selectedDrive.endDate)}
          </span>
          {selectedDrive.status === "CLOSED" && (
            <span className="badge badge-danger" style={{ fontSize: "10px" }}>
              Closed
            </span>
          )}
          {activeDrive?.id === selectedDrive.id && (
            <span className="badge badge-success" style={{ fontSize: "10px" }}>
              Active
            </span>
          )}
        </span>
      ) : (
        <span style={{ fontSize: "13px" }}>
          Showing interviews across all drives.
        </span>
      )}
    </section>
  );
};
