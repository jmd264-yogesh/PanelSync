export const getCollegeNameFromRole = (role: string): string => {
  const parts = role.split(" - ");
  return parts.length > 1 ? parts[1].trim() : "";
};

export const isFromActiveDrive = (
  role: string,
  activeDrive: { collegeName: string } | null
): boolean => {
  if (!activeDrive || !activeDrive.collegeName) return false;
  const college = getCollegeNameFromRole(role);
  return college.toLowerCase() === activeDrive.collegeName.toLowerCase();
};

export const getRoleBadgeStyle = (role: string) => {
  const isL1Role = role.toLowerCase().includes("l1");
  const isL2Role = role.toLowerCase().includes("l2");
  const isLateralRole = role.toLowerCase().includes("lateral");

  if (isL1Role) {
    return {
      background: "var(--badge-l1-bg)",
      border: "1px solid var(--badge-l1-border)",
      color: "var(--badge-l1-text)",
      label: "L1 Round",
      borderCol: "#0ea5e9",
    };
  } else if (isL2Role) {
    return {
      background: "var(--badge-l2-bg)",
      border: "1px solid var(--badge-l2-border)",
      color: "var(--badge-l2-text)",
      label: "L2 Round",
      borderCol: "#7c3aed",
    };
  } else if (isLateralRole) {
    return {
      background: "rgba(245, 158, 11, 0.08)",
      border: "1px solid rgba(245, 158, 11, 0.25)",
      color: "#f59e0b",
      label: "Lateral Hiring",
      borderCol: "#f59e0b",
    };
  }
  return {
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "var(--primary)",
    label: "General Round",
    borderCol: "var(--primary)",
  };
};

export const formatDriveDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};
