import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ParkingHubService } from '../../core/services/parking-hub.service';
import { AccessEvent } from '../../core/models/access-event.model';
import { ReferenceDataService } from '../../core/services/reference-data.service';

interface ZoneOccupancy {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  percent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly hub = inject(ParkingHubService);
  private readonly referenceData = inject(ReferenceDataService);

  readonly user = this.auth.currentUser;
  readonly connectionState = this.hub.connectionState;
  readonly isConnected = this.hub.isConnected;
  readonly vehicleCount = this.hub.vehicleCount;
  readonly freeSpots = this.hub.freeSpots;
  readonly totalCapacity = this.hub.totalCapacity;
  readonly todayEventCount = this.hub.todayEventCount;
  readonly recentEvents = computed(() => {
    const todayStart = startOfToday();

    return this.hub
      .events()
      .filter((event) => new Date(event.timestamp) >= todayStart)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 15);
  });

  readonly connectionLabel = computed(() => {
    switch (this.connectionState()) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Подключение...';
      default:
        return 'Нет live-связи';
    }
  });

  readonly occupancyPercent = computed(() => {
    const total = this.totalCapacity();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.vehicleCount() / total) * 100);
  });

  readonly zoneOccupancy = computed<ZoneOccupancy[]>(() => {
    const events = this.hub.events();
    return this.referenceData.zones().map((zone) => {
      const zoneEvents = events.filter((e) => e.success && e.zoneId === zone.id);
      const plates = new Set<string>();

      const sorted = [...zoneEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      for (const event of sorted) {
        if (event.direction === 'Entry') {
          plates.add(event.vehiclePlate);
        } else {
          plates.delete(event.vehiclePlate);
        }
      }

      const occupied = plates.size;
      return {
        id: zone.id,
        name: zone.name,
        capacity: zone.capacity,
        occupied,
        percent: zone.capacity ? Math.round((occupied / zone.capacity) * 100) : 0,
      };
    });
  });

  readonly displayedColumns = ['time', 'plate', 'direction', 'zone', 'operator', 'status'];

  getOperatorName(userId: string): string {
    return this.referenceData.getUserById(userId)?.fullName ?? '—';
  }

  getZoneName(zoneId: string): string {
    return this.referenceData.getZoneById(zoneId)?.name ?? '—';
  }

  directionLabel(direction: AccessEvent['direction']): string {
    return direction === 'Entry' ? 'Въезд' : 'Выезд';
  }

  directionIcon(direction: AccessEvent['direction']): string {
    return direction === 'Entry' ? 'login' : 'logout';
  }
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
