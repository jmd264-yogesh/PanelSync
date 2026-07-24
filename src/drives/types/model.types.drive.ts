export type TDriveStatus = 'OPEN' | 'CLOSED';

export type TDrive = {
  id: string;
  collegeName: string;
  startDate: string;
  endDate: string;
  status: TDriveStatus;
  isActive: boolean;
  createdAt: string;
}
