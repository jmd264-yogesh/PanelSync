export type TPanelistRole = 'L1' | 'L2';

export type TPanelist = {
  id: string;            // Microsoft Graph User ID
  displayName: string;
  email: string;
  roles: TPanelistRole[]; // L1 or L2 panel capabilities
  createdAt: string;
}
