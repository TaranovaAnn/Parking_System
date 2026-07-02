import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ParkingZone } from '../models/zone.model';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';
import { UpdateZoneRequest, ZoneService } from './zone.service';

interface ZoneApiRow extends ParkingZone {
  occupied: number;
  free: number;
  percent: number;
}

@Injectable()
export class HttpZoneService extends ZoneService {
  private readonly zonesSignal = signal<ParkingZone[]>([]);
  private readonly occupancySignal = signal<Record<string, number>>({});

  readonly zones = this.zonesSignal.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {
    super();
  }

  load(): void {
    const request$ =
      this.auth.userRole() === 'Admin'
        ? this.http.get<ZoneApiRow[]>(`${API_BASE_URL}/zones`)
        : this.http.get<ParkingZone[]>(`${API_BASE_URL}/lookups/zones`);

    request$.subscribe({
      next: (zones) => {
        if (this.auth.userRole() === 'Admin') {
          const rows = zones as ZoneApiRow[];
          this.zonesSignal.set(rows);
          this.occupancySignal.set(
            Object.fromEntries(rows.map((zone) => [zone.id, zone.occupied])),
          );
          return;
        }

        this.zonesSignal.set(zones as ParkingZone[]);
        this.occupancySignal.set({});
      },
      error: () => {
        this.zonesSignal.set([]);
        this.occupancySignal.set({});
      },
    });
  }

  updateZone(zoneId: string, request: UpdateZoneRequest): ParkingZone {
    throw new Error('Use updateZoneRequest() for async API call');
  }

  updateZoneRequest(zoneId: string, request: UpdateZoneRequest) {
    return this.http.put<ParkingZone>(`${API_BASE_URL}/zones/${zoneId}`, request).pipe(
      tap(() => this.load()),
    );
  }

  getOccupiedCount(zoneId: string): number {
    return this.occupancySignal()[zoneId] ?? 0;
  }
}
