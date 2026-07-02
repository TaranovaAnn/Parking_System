import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccessDirection } from '../../core/models/access-event.model';
import { ParkingHubService } from '../../core/services/parking-hub.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';

type DirectionFilter = AccessDirection | 'All';
type SuccessFilter = 'All' | 'Success' | 'Failed';

@Component({
  selector: 'app-access-log',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './access-log.component.html',
  styleUrl: './access-log.component.scss',
})
export class AccessLogComponent {
  private readonly hub = inject(ParkingHubService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly fb = inject(FormBuilder);

  readonly filters = this.fb.nonNullable.group({
    search: [''],
    direction: this.fb.nonNullable.control<DirectionFilter>('All'),
    success: this.fb.nonNullable.control<SuccessFilter>('All'),
    date: [''],
  });

  private readonly filterValues = signal(this.filters.getRawValue());

  readonly filteredEvents = computed(() => {
    const events = [...this.hub.events()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const { search, direction, success, date } = this.filterValues();
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      if (query && !event.vehiclePlate.toLowerCase().includes(query)) {
        return false;
      }

      if (direction !== 'All' && event.direction !== direction) {
        return false;
      }

      if (success === 'Success' && !event.success) {
        return false;
      }

      if (success === 'Failed' && event.success) {
        return false;
      }

      if (date) {
        const eventDate = new Date(event.timestamp).toISOString().slice(0, 10);
        if (eventDate !== date) {
          return false;
        }
      }

      return true;
    });
  });

  readonly displayedColumns = [
    'timestamp',
    'plate',
    'direction',
    'zone',
    'operator',
    'status',
    'message',
  ];

  constructor() {
    this.filters.patchValue({ date: new Date().toISOString().slice(0, 10) });

    this.filters.valueChanges.subscribe(() => {
      this.filterValues.set(this.filters.getRawValue());
    });
  }

  setTodayFilter(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.filters.patchValue({ date: today });
  }

  clearFilters(): void {
    this.filters.reset({
      search: '',
      direction: 'All',
      success: 'All',
      date: '',
    });
  }

  getOperatorName(userId: string): string {
    return this.referenceData.getUserById(userId)?.fullName ?? '—';
  }

  getZoneName(zoneId: string): string {
    return this.referenceData.getZoneById(zoneId)?.name ?? '—';
  }

  directionLabel(direction: AccessDirection): string {
    return direction === 'Entry' ? 'Въезд' : 'Выезд';
  }
}
