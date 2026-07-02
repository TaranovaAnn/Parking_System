export type PassType = 'Permanent' | 'Temporary' | 'Guest';
export type PassStatus = 'Draft' | 'Active' | 'Expired' | 'Blocked';

export interface Pass {
  id: string;
  vehiclePlate: string;
  type: PassType;
  status: PassStatus;
  validFrom: string;
  validTo: string;
  zoneId?: string;
  ownerUserId: string;
  createdByUserId: string;
  notes?: string;
}
