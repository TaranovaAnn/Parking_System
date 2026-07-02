import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ParkingZone } from '../models/zone.model';

export interface UpdateZoneRequest {
  name: string;
  capacity: number;
  description?: string;
}

export abstract class ZoneService {
  abstract readonly zones: Signal<ParkingZone[]>;

  abstract load(): void;
  abstract updateZone(zoneId: string, request: UpdateZoneRequest): ParkingZone;
  abstract updateZoneRequest(zoneId: string, request: UpdateZoneRequest): Observable<ParkingZone>;
  abstract getOccupiedCount(zoneId: string): number;
}
