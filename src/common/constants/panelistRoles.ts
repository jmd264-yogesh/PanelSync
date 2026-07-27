export const PANELIST_ROLES = ['L1', 'L2'] as const;
export type PanelistRole = typeof PANELIST_ROLES[number];

export const PANELIST_ROLE_LABELS: Record<PanelistRole, { title: string; description: string }> = {
  L1: {
    title: 'L1 Panelist',
    description: 'Technical screening / coding',
  },
  L2: {
    title: 'L2 Panelist',
    description: 'System design / management',
  },
};
