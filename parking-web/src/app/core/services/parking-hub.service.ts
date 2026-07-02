import { Signal } from '@angular/core';
import { AccessEvent } from '../models/access-event.model';

export type HubConnectionState = 'idle' | 'connecting' | 'connected' | 'offline';

export abstract class ParkingHubService {
  abstract readonly connectionState: Signal<HubConnectionState>;
  abstract readonly isConnected: Signal<boolean>;
  abstract readonly vehicleCount: Signal<number>;
  abstract readonly freeSpots: Signal<number>;
  abstract readonly totalCapacity: Signal<number>;
  abstract readonly todayEventCount: Signal<number>;
  abstract readonly recentEvents: Signal<AccessEvent[]>;
  abstract readonly events: Signal<AccessEvent[]>;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract addAccessEvent(event: Omit<AccessEvent, 'id'>): AccessEvent;
  abstract isVehicleInside(vehiclePlate: string): boolean;
}
