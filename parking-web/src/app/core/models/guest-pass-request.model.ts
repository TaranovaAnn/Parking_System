export type GuestRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface GuestPassRequest {
  id: string;
  vehiclePlate: string;
  zoneId: string;
  durationHours: number;
  guestFullName?: string;
  notes?: string;
  status: GuestRequestStatus;
  createdAt: string;
  requestedByUserId: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdPassId?: string;
}
