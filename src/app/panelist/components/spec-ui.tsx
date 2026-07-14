// Shared chip-picker UI for the spec-driven question generation form (role grade,
// tracks, platforms, topics) — used by both AiCopilotPanel and RecalibratePanel.
import React from 'react';

export function toggleInArray<T>(arr: T[], value: T, keepAtLeastOne = false): T[] {
  if (arr.includes(value)) {
    if (keepAtLeastOne && arr.length <= 1) return arr;
    return arr.filter((v) => v !== value);
  }
  return [...arr, value];
}

export function SpecChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="badge"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: active ? 'var(--info-glow)' : 'transparent',
        color: active ? 'var(--info)' : 'var(--text-muted)',
        border: active ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid var(--border-glass)',
      }}
    >
      {label}
    </button>
  );
}
