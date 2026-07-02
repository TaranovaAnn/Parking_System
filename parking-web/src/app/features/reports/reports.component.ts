import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { API_BASE_URL } from '../../core/config/api.config';
import { AccessEvent } from '../../core/models/access-event.model';
import { ReferenceDataService } from '../../core/services/reference-data.service';

interface ReportRow {
  plate: string;
  direction: string;
  zone: string;
  operator: string;
  time: string;
  result: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = this.fb.nonNullable.group({
    dateFrom: [new Date().toISOString().slice(0, 10)],
    dateTo: [new Date().toISOString().slice(0, 10)],
  });

  private readonly filterValues = signal(this.form.getRawValue());
  private readonly eventsSignal = signal<AccessEvent[]>([]);
  private readonly summarySignal = signal({
    totalEvents: 0,
    deniedEvents: 0,
    activePasses: 0,
  });

  readonly reportRows = computed<ReportRow[]>(() =>
    this.eventsSignal().map((event) => ({
      plate: event.vehiclePlate,
      direction: event.direction === 'Entry' ? 'Въезд' : 'Выезд',
      zone: this.referenceData.getZoneById(event.zoneId)?.name ?? '—',
      operator: this.referenceData.getUserById(event.operatorUserId)?.fullName ?? '—',
      time: event.timestamp,
      result: event.success ? 'Успешно' : event.message ?? 'Отказ',
    })),
  );

  readonly totalEvents = computed(() => this.summarySignal().totalEvents);
  readonly deniedEvents = computed(() => this.summarySignal().deniedEvents);
  readonly activePasses = computed(() => this.summarySignal().activePasses);

  readonly displayedColumns = ['time', 'plate', 'direction', 'zone', 'operator', 'result'];

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.filterValues.set(this.form.getRawValue());
      this.loadReport();
    });
    this.loadReport();
  }

  exportCsv(): void {
    const params = this.createQueryParams();
    this.http
      .get(`${API_BASE_URL}/reports/export/csv${params}`, { responseType: 'blob' })
      .subscribe((blob) => {
        this.downloadFile(blob, 'report.csv');
        this.snackBar.open('CSV отчёт сформирован', 'OK', { duration: 2500 });
      });
  }

  private loadReport(): void {
    const params = this.createQueryParams();
    this.http.get<{ totalEvents: number; deniedEvents: number; activePasses: number }>(
      `${API_BASE_URL}/reports/summary${params}`,
    ).subscribe((summary) => this.summarySignal.set(summary));

    this.http.get<AccessEvent[]>(`${API_BASE_URL}/reports/events${params}`).subscribe((events) => {
      this.eventsSignal.set(events);
    });
  }

  private createQueryParams(): string {
    const { dateFrom, dateTo } = this.filterValues();
    const from = `${dateFrom}T00:00:00Z`;
    const to = `${dateTo}T23:59:59Z`;
    return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  private downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
