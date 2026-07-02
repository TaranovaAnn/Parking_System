export type AccessDirection = 'Entry' | 'Exit';

export interface AccessEvent {
  id: string;
  vehiclePlate: string;
  direction: AccessDirection;
  timestamp: string;
  operatorUserId: string;
  zoneId: string;
  passId?: string;
  success: boolean;
  message?: string;
}
